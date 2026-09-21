import { createVM, runTx, type VM } from '@ethereumjs/vm';
import { createCustomCommon, Mainnet, Hardfork } from '@ethereumjs/common';
import { createLegacyTx } from '@ethereumjs/tx';
import { createBlock } from '@ethereumjs/block';
import { createAccount, createAddressFromString, hexToBytes, bytesToHex } from '@ethereumjs/util';
import { ContractFactory, Interface, Wallet, Signature, parseUnits, type HDNodeWallet } from 'ethers';
import token from '../generated/token.json';
import { CHAIN_ID, TOKEN_NAME, PERMIT_FIELDS, type ChainState, type ExecutionReceipt, type PermitPayload, type PermitRecord, type ProbeResult, type Eip1193Provider } from './types';
import { capturePermit } from './recorder';

const iface = new Interface(token.abi);
const common = () => createCustomCommon({ chainId: CHAIN_ID, name: 'PermitScope isolated EVM' }, Mainnet, { hardfork: Hardfork.Cancun });

/** DEMO: real Solidity bytecode on an isolated browser EVM, with ephemeral accounts and valueless tokens.
 * No remote chain, asset custody, backend, private-key import, or public-network protection is implied.
 */
export class PermitSandbox {
  readonly sessionId = crypto.randomUUID();
  readonly owner: HDNodeWallet = Wallet.createRandom();
  readonly spender: HDNodeWallet = Wallet.createRandom();
  readonly checkout: HDNodeWallet = Wallet.createRandom();
  readonly receipts: ExecutionReceipt[] = [];
  private readonly signatures = new Map<string, string>();
  private vm!: VM;
  tokenAddress = '';
  block = 0;
  timestamp = Math.floor(Date.now() / 1000);

  static async create() {
    const sandbox = new PermitSandbox();
    sandbox.vm = await createVM({ common: common() });
    for (const wallet of [sandbox.owner, sandbox.spender, sandbox.checkout]) {
      await sandbox.vm.stateManager.putAccount(createAddressFromString(wallet.address), createAccount({ balance: parseUnits('100', 18), nonce: 0n }));
    }
    const deploy = await new ContractFactory(token.abi, token.bytecode).getDeployTransaction(sandbox.owner.address);
    const result = await sandbox.execute(sandbox.owner, deploy.data, 'Deploy test token', false);
    if (!result.createdAddress) throw new Error('Test token could not be deployed.');
    sandbox.tokenAddress = result.createdAddress.toString();
    return sandbox;
  }

  private header() {
    return createBlock({ header: {
      number: BigInt(this.block), timestamp: BigInt(this.timestamp), gasLimit: 30_000_000n,
      baseFeePerGas: 7n, difficulty: 0n,
    } }, { common: this.vm.common, skipConsensusFormatValidation: true });
  }

  private async execute(wallet: HDNodeWallet, data: string, label: string, toToken = true, persist = true) {
    const address = createAddressFromString(wallet.address);
    const account = await this.vm.stateManager.getAccount(address);
    const tx = createLegacyTx({
      nonce: account?.nonce || 0n, gasLimit: 5_000_000n, gasPrice: 10n,
      data: data as `0x${string}`, ...(toToken ? { to: this.tokenAddress as `0x${string}` } : {}),
    }, { common: this.vm.common }).sign(hexToBytes(wallet.privateKey as `0x${string}`));
    this.block += 1;
    const result = await runTx(this.vm, { tx, block: this.header() });
    const error = result.execResult.exceptionError;
    let reason: string | undefined = error?.error;
    if (error && result.execResult.returnValue.length) {
      try { reason = iface.parseError(bytesToHex(result.execResult.returnValue))?.name || reason; } catch { /* Unknown EVM revert remains a revert. */ }
    }
    const receipt: ExecutionReceipt = {
      id: crypto.randomUUID(), label, hash: bytesToHex(tx.hash()), block: this.block, timestamp: this.timestamp,
      status: error ? 'reverted' : 'success', gasUsed: result.totalGasSpent.toString(),
      ...(reason ? { error: reason } : {}), context: 'isolated-browser-evm',
    };
    if (persist) this.receipts.unshift(receipt);
    return { ...result, receipt, createdAddress: result.createdAddress };
  }

  private async call(name: string, args: unknown[]): Promise<bigint> {
    const result = await this.vm.evm.runCall({
      to: createAddressFromString(this.tokenAddress), caller: createAddressFromString(this.owner.address),
      data: hexToBytes(iface.encodeFunctionData(name, args) as `0x${string}`),
      gasLimit: 1_000_000n, isStatic: true, block: this.header(),
    });
    if (result.execResult.exceptionError) throw new Error('The contract read failed. State is unknown.');
    return iface.decodeFunctionResult(name, bytesToHex(result.execResult.returnValue))[0];
  }

  async state(spender = this.spender.address): Promise<ChainState> {
    this.timestamp = Math.max(this.timestamp, Math.floor(Date.now() / 1000));
    const nonce = await this.call('nonces', [this.owner.address]);
    const allowance = await this.call('allowance', [this.owner.address, spender]);
    const balance = await this.call('balanceOf', [this.owner.address]);
    return { sessionId: this.sessionId, chainId: CHAIN_ID, token: this.tokenAddress, owner: this.owner.address,
      spender, nonce: nonce.toString(), allowance: allowance.toString(), balance: balance.toString(),
      timestamp: this.timestamp, block: this.block, checkedAt: Date.now(), stale: false };
  }

  async payload(amount = '750', spender = this.spender.address, duration = 86400, nonceOffset = 0): Promise<PermitPayload> {
    const nonce = await this.call('nonces', [this.owner.address]);
    return {
      domain: { name: TOKEN_NAME, version: '1', chainId: CHAIN_ID, verifyingContract: this.tokenAddress },
      primaryType: 'Permit', types: { Permit: PERMIT_FIELDS },
      message: { owner: this.owner.address, spender, value: parseUnits(amount, 18).toString(),
        nonce: (nonce + BigInt(nonceOffset)).toString(), deadline: String(this.timestamp + duration) },
    };
  }

  provider(): Eip1193Provider {
    return { request: async ({ method, params }) => {
      if (method === 'eth_chainId') return '0x' + CHAIN_ID.toString(16);
      if (method === 'eth_accounts') return [this.owner.address];
      if (method === 'eth_signTypedData_v4') {
        if (String(params?.[0]).toLowerCase() !== this.owner.address.toLowerCase()) throw new Error('Wrong signing account.');
        const payload: PermitPayload = JSON.parse(String(params?.[1]));
        return this.owner.signTypedData(payload.domain, payload.types, payload.message);
      }
      throw new Error('Method not available in the isolated demo.');
    } };
  }

  async record(app: 'Swap demo' | 'Checkout demo', save: (record: PermitRecord) => Promise<void>, options: { duration?: number; nonceOffset?: number } = {}) {
    const payload = await this.payload(app === 'Swap demo' ? '750' : '120', app === 'Swap demo' ? this.spender.address : this.checkout.address, options.duration ?? 86400, options.nonceOffset ?? 0);
    const { record, signature } = await capturePermit(this.provider(), payload, {
      app, origin: typeof window !== 'undefined' ? window.location.origin : 'isolated-test-harness',
      sessionId: this.sessionId, allowedToken: this.tokenAddress, chainId: CHAIN_ID,
    }, save);
    // DEMO ONLY: keep this test signature in ephemeral memory to reproduce activation/replay.
    // The production recorder and IndexedDB never retain it.
    this.signatures.set(record.id, signature);
    return record;
  }

  private assertRecord(record: PermitRecord) {
    if (record.sessionId !== this.sessionId || record.verification !== 'verified-at-capture' ||
      record.payload.domain.chainId !== CHAIN_ID || record.payload.domain.verifyingContract.toLowerCase() !== this.tokenAddress.toLowerCase() ||
      record.payload.message.owner.toLowerCase() !== this.owner.address.toLowerCase() || !this.signatures.has(record.id))
      throw new Error('Only a verified permission from this active demo can be executed.');
  }

  private permitData(payload: PermitPayload, signature: string) {
    const s = Signature.from(signature), m = payload.message;
    return iface.encodeFunctionData('permit', [m.owner, m.spender, m.value, m.deadline, s.v, s.r, s.s]);
  }

  async activate(record: PermitRecord) {
    this.assertRecord(record);
    const result = await this.execute(this.spender, this.permitData(record.payload, this.signatures.get(record.id)!), 'Activate recorded permit');
    result.receipt.permissionId = record.id;
    return result.receipt;
  }

  async close(record: PermitRecord) {
    this.assertRecord(record);
    const state = await this.state(record.payload.message.spender);
    if (BigInt(record.payload.message.nonce) > BigInt(state.nonce) && BigInt(record.payload.message.deadline) >= BigInt(state.timestamp))
      throw new Error('Future-nonce permits require a separate recovery plan. No cancellation was submitted.');
    let receipt: ExecutionReceipt;
    if (state.nonce === record.payload.message.nonce && BigInt(record.payload.message.deadline) >= BigInt(state.timestamp)) {
      const payload = await this.payload('0', record.payload.message.spender, 600);
      const signature = await this.owner.signTypedData(payload.domain, payload.types, payload.message);
      receipt = (await this.execute(this.owner, this.permitData(payload, signature), 'Cancel permit · zero allowance')).receipt;
    } else {
      receipt = (await this.execute(this.owner, iface.encodeFunctionData('approve', [record.payload.message.spender, 0]), 'Revoke active allowance')).receipt;
    }
    receipt.permissionId = record.id;
    if (receipt.status !== 'success') throw new Error('Cancellation reverted. Refresh state before retrying.');
    const after = await this.state(record.payload.message.spender);
    if (after.allowance !== '0') throw new Error('Transaction executed, but allowance is still open.');
    return { receipt, state: after };
  }

  async probe(record: PermitRecord): Promise<ProbeResult> {
    this.assertRecord(record);
    const originalBlock = this.block;
    // Run both permit activation and transfer on a state checkpoint, then discard every change.
    await this.vm.stateManager.checkpoint();
    try {
      const before = await this.state(record.payload.message.spender);
      const permit = await this.execute(this.spender, this.permitData(record.payload, this.signatures.get(record.id)!), 'Probe permit', true, false);
      const wallet = record.payload.message.spender.toLowerCase() === this.checkout.address.toLowerCase() ? this.checkout : this.spender;
      const transfer = await this.execute(wallet, iface.encodeFunctionData('transferFrom', [this.owner.address, wallet.address, record.payload.message.value]), 'Probe transfer', true, false);
      const after = await this.state(record.payload.message.spender);
      return {
        permitAccepted: permit.receipt.status === 'success', transferAccepted: transfer.receipt.status === 'success',
        balanceBefore: before.balance, balanceAfter: after.balance,
        reason: transfer.receipt.status === 'success' ? 'The spender could transfer test tokens in this discarded branch.' : (permit.receipt.error || transfer.receipt.error || 'Transfer rejected.'),
        checkedAt: Date.now(),
      };
    } finally { await this.vm.stateManager.revert(); this.block = originalBlock; }
  }

  async replay(record: PermitRecord) {
    this.assertRecord(record);
    const receipt = (await this.execute(this.spender, this.permitData(record.payload, this.signatures.get(record.id)!), 'Replay original signature')).receipt;
    receipt.permissionId = record.id;
    return receipt;
  }

  advanceTime(seconds: number) { this.timestamp += seconds; }
}
