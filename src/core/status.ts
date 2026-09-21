import type { ChainState, PermitRecord } from './types';

export type SignatureStatus = 'ready' | 'invalidated' | 'expired' | 'future' | 'unknown';
export interface PermissionStatus {
  signature: SignatureStatus;
  allowance: 'open' | 'zero' | 'unknown';
  needsAction: boolean;
  title: string;
  explanation: string;
}
export function assess(record: PermitRecord, state?: ChainState): PermissionStatus {
  const unknown: PermissionStatus = {
    signature: 'unknown', allowance: 'unknown', needsAction: false,
    title: 'State not verified', explanation: 'This record needs a fresh read from its original network and account.',
  };
  if (!state || state.stale || record.verification !== 'verified-at-capture' ||
      record.sessionId !== state.sessionId || record.payload.domain.chainId !== state.chainId ||
      record.payload.domain.verifyingContract.toLowerCase() !== state.token.toLowerCase() ||
      record.payload.message.owner.toLowerCase() !== state.owner.toLowerCase() ||
      record.payload.message.spender.toLowerCase() !== state.spender.toLowerCase()) return unknown;
  const current = BigInt(state.nonce), signed = BigInt(record.payload.message.nonce);
  const allowance = BigInt(state.allowance) > 0n ? 'open' : 'zero';
  let signature: SignatureStatus;
  if (signed < current) signature = 'invalidated';
  else if (BigInt(state.timestamp) > BigInt(record.payload.message.deadline)) signature = 'expired';
  else if (signed > current) signature = 'future';
  else signature = 'ready';
  if (allowance === 'open') return {
    signature, allowance, needsAction: true, title: 'An allowance is still open',
    explanation: 'This spender can use the current allowance, even if the original signature can no longer be submitted.',
  };
  if (signature === 'ready') return {
    signature, allowance, needsAction: true, title: 'Zero allowance. Live permission.',
    explanation: 'This recorded signature can still activate an allowance. Checking the current allowance alone misses that permission.',
  };
  if (signature === 'future') return {
    signature, allowance, needsAction: true, title: 'A future permission remains',
    explanation: 'Its nonce is ahead of the contract. It may become usable later; a single cancellation does not close every future nonce.',
  };
  return { signature, allowance, needsAction: false, title: 'This permission is closed',
    explanation: 'This recorded signature cannot activate, and this spender has zero allowance at the last check. Other permissions are outside this result.' };
}
