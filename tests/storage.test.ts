import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { recordsStore, backup } from '../src/core/storage';
import { PermitSandbox } from '../src/core/sandbox';
import { parseImport } from '../src/core/recorder';

it('retains a still-open permit after more than 100 later receipts and exports metadata only', async () => {
  const evm = await PermitSandbox.create();
  const oldest = await evm.record('Swap demo', recordsStore.save);
  for (let i = 1; i <= 110; i++) {
    await recordsStore.save({ ...oldest, id: crypto.randomUUID(), capturedAt: oldest.capturedAt + i });
  }
  const records = await recordsStore.list();
  expect(records).toHaveLength(111);
  expect(records.some(record => record.id === oldest.id)).toBe(true);
  const json = backup(records);
  expect(json).not.toContain(evm.owner.privateKey);
  expect(JSON.parse(json).records.every((record: object) => !('signature' in record))).toBe(true);
  const imported = parseImport(json);
  expect(imported).toHaveLength(111);
  expect(imported.every(record => record.verification === 'imported-unverified')).toBe(true);
});
