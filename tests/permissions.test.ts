import { describe, it, expect } from 'vitest';
import { PermitSandbox } from '../src/core/sandbox';
import { assess } from '../src/core/status';
import { capturePermit, parseImport } from '../src/core/recorder';
import { CHAIN_ID, type Eip1193Provider, type PermitRecord } from '../src/core/types';

const discard = async () => {};

describe('Real EVM permission lifecycle', () => {
  it('proves a zero-allowance permit can spend, then invalidates and rejects its replay', async () => {
    const evm = await PermitSandbox.create();
    const record = await evm.record('Swap demo', discard);
    const before = await evm.state();
    expect(before.allowance).toBe('0');
    expect(assess(record, before).signature).toBe('ready');
    const probe = await evm.probe(record);
    expect(probe.permitAccepted).toBe(true);
    expect(probe.transferAccepted).toBe(true);
    expect(probe.balanceBefore).not.toBe(probe.balanceAfter);
    expect(await evm.state()).toMatchObject({ nonce: before.nonce, allowance: '0', balance: before.balance, block: before.block });
    const closed = await evm.close(record);
    expect(closed.receipt.status).toBe('success');
    expect(assess(record, closed.state)).toMatchObject({ signature: 'invalidated', allowance: 'zero', needsAction: false });
    const replay = await evm.replay(record);
    expect(replay.status).toBe('reverted');
    expect((await evm.probe(record)).transferAccepted).toBe(false);
    expect((await evm.state()).balance).toBe(before.balance);
  });

  it('does not treat a used or expired signature as a revoked on-chain allowance', async () => {
    const evm = await PermitSandbox.create();
    const record = await evm.record('Swap demo', discard, { duration: 60 });
    expect((await evm.activate(record)).status).toBe('success');
    evm.advanceTime(120);
    expect(assess(record, await evm.state())).toMatchObject({ signature: 'invalidated', allowance: 'open', needsAction: true });
    const probe = await evm.probe(record);
    expect(probe.permitAccepted).toBe(false);
    expect(probe.transferAccepted).toBe(true);
    await evm.close(record);
    expect((await evm.probe(record)).transferAccepted).toBe(false);
  });

  it('expires an unused permit without claiming every future nonce is cancelled', async () => {
    const evm = await PermitSandbox.create();
    const expired = await evm.record('Swap demo', discard, { duration: 1 });
    evm.advanceTime(2);
    expect(assess(expired, await evm.state()).signature).toBe('expired');
    expect((await evm.probe(expired)).permitAccepted).toBe(false);
    const future = await evm.record('Swap demo', discard, { nonceOffset: 2 });
    expect(assess(future, await evm.state()).signature).toBe('future');
    await expect(evm.close(future)).rejects.toThrow('Future-nonce');
  });

  it('supports two distinct dApp contexts and preserves separate spender allowances', async () => {
    const evm = await PermitSandbox.create();
    const swap = await evm.record('Swap demo', discard);
    const checkout = await evm.record('Checkout demo', discard);
    await evm.activate(checkout);
    expect((await evm.state(checkout.payload.message.spender)).allowance).not.toBe('0');
    expect(assess(swap, await evm.state())).toMatchObject({ signature: 'invalidated', allowance: 'zero' });
    await evm.close(checkout);
    expect((await evm.state(checkout.payload.message.spender)).allowance).toBe('0');
  });
});

describe('Recorder trust boundaries', () => {
  it('does not persist raw signatures, rejected requests, or changed-wallet responses', async () => {
    const evm = await PermitSandbox.create();
    const records: PermitRecord[] = [];
    const save = async (record: PermitRecord) => { records.push(record); };
    const context = { app: 'Test', origin: 'https://example.test', sessionId: evm.sessionId, allowedToken: evm.tokenAddress, chainId: CHAIN_ID };
    const result = await capturePermit(evm.provider(), await evm.payload(), context, save);
    expect(JSON.stringify(records)).not.toContain(result.signature);
    expect(JSON.stringify(records)).not.toContain(evm.owner.privateKey);
    const rejected: Eip1193Provider = { request: (args) => args.method === 'eth_signTypedData_v4' ? Promise.reject(new Error('User rejected')) : evm.provider().request(args) };
    await expect(capturePermit(rejected, await evm.payload(), context, save)).rejects.toThrow('User rejected');
    let switched = false;
    const changed: Eip1193Provider = { request: async args => {
      if (args.method === 'eth_accounts' && switched) return [evm.spender.address];
      const result = await evm.provider().request(args);
      if (args.method === 'eth_signTypedData_v4') switched = true;
      return result;
    } };
    await expect(capturePermit(changed, await evm.payload(), context, save)).rejects.toThrow('changed');
    expect(records).toHaveLength(1);
  });

  it('treats imported, stale, wrong-chain and wrong-spender records as unknown', async () => {
    const evm = await PermitSandbox.create();
    const record = await evm.record('Swap demo', discard);
    const state = await evm.state();
    for (const change of [{ stale: true }, { chainId: 1 }, { spender: evm.checkout.address }, { sessionId: 'another' }])
      expect(assess(record, { ...state, ...change }).signature).toBe('unknown');
    const imported = parseImport(JSON.stringify({ format: 'permitscope-receipts-v1', records: [{ ...record, signature: 'SECRET', privateKey: 'SECRET' }] }));
    expect(imported[0].verification).toBe('imported-unverified');
    expect(assess(imported[0], state).signature).toBe('unknown');
    expect(JSON.stringify(imported)).not.toContain('SECRET');
    await expect(evm.close(imported[0])).rejects.toThrow('verified');
  });
});
