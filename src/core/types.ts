export const CHAIN_ID = 31337;
export const TOKEN_NAME = 'Scope Test Dollar';
export const PERMIT_FIELDS = [
  { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
];
export interface PermitPayload {
  domain: { name: string; version: string; chainId: number; verifyingContract: string };
  primaryType: 'Permit';
  types: { Permit: typeof PERMIT_FIELDS };
  message: { owner: string; spender: string; value: string; nonce: string; deadline: string };
}
export interface PermitRecord {
  id: string;
  sessionId: string;
  capturedAt: number;
  origin: string;
  app: string;
  payload: PermitPayload;
  digest: string;
  verification: 'verified-at-capture' | 'imported-unverified';
}
export interface ChainState {
  sessionId: string;
  chainId: number;
  token: string;
  owner: string;
  spender: string;
  nonce: string;
  allowance: string;
  balance: string;
  timestamp: number;
  block: number;
  checkedAt: number;
  stale: boolean;
}
export interface ExecutionReceipt {
  id: string;
  permissionId?: string;
  label: string;
  hash: string;
  block: number;
  timestamp: number;
  status: 'success' | 'reverted';
  gasUsed: string;
  error?: string;
  context: 'isolated-browser-evm';
}
export interface ProbeResult {
  permitAccepted: boolean;
  transferAccepted: boolean;
  balanceBefore: string;
  balanceAfter: string;
  reason: string;
  checkedAt: number;
}
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}
