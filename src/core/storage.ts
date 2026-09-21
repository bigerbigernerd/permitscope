import { openDB } from 'idb';
import type { PermitRecord } from './types';

const db = () => openDB('permitscope-v1', 1, { upgrade(database) { database.createObjectStore('receipts', { keyPath: 'id' }); } });
export const recordsStore = {
  async list(): Promise<PermitRecord[]> { return (await (await db()).getAll('receipts')).sort((a,b) => b.capturedAt - a.capturedAt); },
  async save(record: PermitRecord) { await (await db()).put('receipts', record); },
  async remove(id: string) { await (await db()).delete('receipts', id); },
};
export function backup(records: PermitRecord[]): string {
  return JSON.stringify({ format: 'permitscope-receipts-v1', exportedAt: new Date().toISOString(),
    notice: 'Metadata only. No executable signatures. Imported receipts must be reverified.', records }, null, 2);
}
