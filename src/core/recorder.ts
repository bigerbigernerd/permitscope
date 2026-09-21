import { getAddress, TypedDataEncoder, verifyTypedData } from 'ethers';
import { PERMIT_FIELDS, type Eip1193Provider, type PermitPayload, type PermitRecord } from './types';

export function parsePermit(value: unknown): PermitPayload {
  if (!value || typeof value !== 'object') throw new Error('Not a permit payload.');
  const p = value as PermitPayload;
  if (p.primaryType !== 'Permit' || JSON.stringify(p.types?.Permit) !== JSON.stringify(PERMIT_FIELDS))
    throw new Error('Only the standard ERC-2612 Permit format is supported.');
  if (!p.domain?.name || p.domain.version !== '1' || !Number.isSafeInteger(p.domain.chainId) || p.domain.chainId <= 0)
    throw new Error('Unsupported signing domain.');
  const verifyingContract = getAddress(p.domain.verifyingContract);
  const owner = getAddress(p.message?.owner), spender = getAddress(p.message?.spender);
  for (const field of ['value', 'nonce', 'deadline'] as const) {
    if (!/^(0|[1-9][0-9]{0,77})$/.test(String(p.message[field])) || BigInt(p.message[field]) >= 2n ** 256n)
      throw new Error('Invalid permit amount, nonce or deadline.');
  }
  // Copy only allowed fields: no signatures, keys, or extra imported properties.
  return {
    domain: { name: String(p.domain.name).slice(0,120), version: '1', chainId: p.domain.chainId, verifyingContract },
    primaryType: 'Permit', types: { Permit: PERMIT_FIELDS.map(f => ({ ...f })) },
    message: { owner, spender, value: String(p.message.value), nonce: String(p.message.nonce), deadline: String(p.message.deadline) },
  };
}

async function readContext(provider: Eip1193Provider) {
  // Read-only requests: bounded wait + one retry. No cached identity can authorize signing.
  let error: unknown;
  for (let i = 0; i < 2; i++) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.all([provider.request({ method: 'eth_chainId' }), provider.request({ method: 'eth_accounts' })]),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Wallet context timed out. No signature was recorded.')), 8000); }),
      ]);
    } catch (e) { error = e; } finally { clearTimeout(timer); }
  }
  throw error;
}

export async function capturePermit(
  provider: Eip1193Provider,
  payloadInput: PermitPayload,
  context: { app: string; origin: string; sessionId: string; allowedToken: string; chainId: number },
  save: (record: PermitRecord) => Promise<void>,
): Promise<{ record: PermitRecord; signature: string }> {
  const payload = parsePermit(payloadInput);
  if (getAddress(context.allowedToken) !== payload.domain.verifyingContract || context.chainId !== payload.domain.chainId)
    throw new Error('The permit does not match the supported deployment.');
  const matches = (chain: unknown, accounts: unknown) => Number(chain) === payload.domain.chainId &&
    Array.isArray(accounts) && accounts.length > 0 && String(accounts[0]).toLowerCase() === payload.message.owner.toLowerCase();
  const before = await readContext(provider);
  if (!matches(...before)) throw new Error('Switch to the permit account and network first.');
  // Signing has no automatic retries. Rejection must never create a recorded permission.
  const signature = await provider.request({ method: 'eth_signTypedData_v4', params: [payload.message.owner, JSON.stringify(payload)] });
  const after = await readContext(provider);
  if (!matches(...after)) throw new Error('Account or network changed while signing. No receipt was saved.');
  if (typeof signature !== 'string' || getAddress(verifyTypedData(payload.domain, payload.types, payload.message, signature)) !== payload.message.owner)
    throw new Error('Signature does not match the stated owner.');
  const record: PermitRecord = {
    id: crypto.randomUUID(), sessionId: context.sessionId, capturedAt: Date.now(),
    origin: context.origin, app: context.app,
    payload, digest: TypedDataEncoder.hash(payload.domain, payload.types, payload.message), verification: 'verified-at-capture',
  };
  await save(record);
  // Returned to the requesting dApp only. The receipt and persistence sink never get the executable signature.
  return { record, signature };
}

export function parseImport(text: string): PermitRecord[] {
  if (text.length > 1_000_000) throw new Error('Backup is too large (maximum 1 MB).');
  const data = JSON.parse(text);
  if (data.format !== 'permitscope-receipts-v1' || !Array.isArray(data.records) || data.records.length > 1000)
    throw new Error('Choose a PermitScope receipt backup with at most 1,000 records.');
  return data.records.map((r: Record<string, unknown>) => {
    const payload = parsePermit(r.payload);
    return {
      id: crypto.randomUUID(), sessionId: 'imported', capturedAt: Number(r.capturedAt) || Date.now(),
      origin: String(r.origin || 'Imported').slice(0,200), app: String(r.app || 'Imported receipt').slice(0,80),
      payload, digest: TypedDataEncoder.hash(payload.domain, payload.types, payload.message),
      verification: 'imported-unverified' as const,
    };
  });
}
