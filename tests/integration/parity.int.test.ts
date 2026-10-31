// With ZAS_PARITY_OUT set, writes D1-D6 for the M0 baseline competitions with the
// new builders, for scripts/xlsx-compare.js to compare with parity/baseline/excel.
// Without it the suite is skipped. Output contains personal data: keep it under parity/.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { call, dialogState, ok, setup } from './harness';

const OUT = process.env.ZAS_PARITY_OUT;
describe.skipIf(!OUT)('parity files', () => {
  beforeAll(setup);

  it('writes D1-D6 for the M0 baseline competitions', async () => {
    const out = resolve(OUT!);
    mkdirSync(out, { recursive: true });
    const save = async (file: string, channel: string, input?: unknown) => {
      dialogState.savePath = join(out, file);
      const res = await (call as (c: string, i?: unknown) => Promise<{ ok: boolean }>)(channel, input);
      expect(res.ok, file).toBe(true);
    };

    const COMPS = [64, 72, 55, 56, 66, 42, 46, 57, 58, 60, 63, 62, 74];
    const allIds = (await ok('competitions:list')).map((c) => c.id);
    for (const id of COMPS) {
      for (const [label, tariff] of [['official', 'sodnik'], ['invoice', 'racun']] as const) {
        await save(`D1_comp${id}_${label}.xlsx`, 'excel:competitionReport', { competition_id: id, tariff });
      }
    }
    for (const [label, tariff] of [['official', 'sodnik'], ['invoice', 'racun']] as const) {
      await save(`D2_all_${label}.xlsx`, 'excel:summary', { competition_ids: allIds, tariff });
      await save(`D2_subset_${label}.xlsx`, 'excel:summary', { competition_ids: COMPS, tariff });
    }
    for (const id of [64, 72, 56, 66, 42, 63]) {
      await save(`D3_comp${id}.xlsx`, 'excel:preview', { competition_id: id, tariff: 'sodnik' });
    }
    await save('D4_officials.xlsx', 'excel:officials');
    await save('D5_competitions.xlsx', 'excel:competitions');
    await save('D6_payments_all.xlsx', 'excel:payments');
    await save('D6_payments_owed.xlsx', 'excel:payments', { status: 'open' });
  });
});
