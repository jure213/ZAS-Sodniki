// Audit log through the real handlers: admin-only read, entries for data
// changes, filters, paging and hostile text. Creates one ITEST official and
// deletes it again; the audit entries it causes stay in the (append-only) log.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, call, ok, setup } from './harness';

const NAME = 'ITEST audit <img src=x onerror=alert(1)> "q" 100%';
let officialId = 0;
let adminName = '';

beforeAll(async () => {
  await setup();
  adminName = (await ok('users:list')).find((u) => u.username === process.env.PARITY_ADMIN_USER)?.username ?? '';
  const o = await ok('officials:create', { name: NAME, email: '', phone: '', rank: '', additional_exams: '', notes: '', active: true });
  officialId = o.id;
  await ok('officials:update', { id: o.id, data: { name: NAME, email: '', phone: '040 111 222', rank: 'B', additional_exams: '', notes: '', active: true } });
});

afterAll(async () => {
  as('admin');
  if (officialId) await call('officials:delete', { id: officialId });
});

describe('audit:list', () => {
  it('records create, update and delete of an official with the acting admin', async () => {
    await ok('officials:delete', { id: officialId });
    officialId = 0;
    const res = await ok('audit:list', { search: 'ITEST audit', entity: 'official' });
    const mine = res.rows.filter((r) => r.summary.includes('ITEST audit'));
    expect(mine.map((r) => r.action).slice(0, 3)).toEqual(['delete', 'update', 'insert']);
    expect(mine[0].summary).toBe(`Izbrisan sodnik ${NAME}`);
    expect(mine[1].summary).toBe(`Urejen sodnik ${NAME} (rang, telefon)`);
    expect(mine[1].changes?.['Telefon']?.[1]).toBe('040 111 222');
    expect(mine.every((r) => r.username === adminName && r.user_id != null)).toBe(true);
  });

  it('filters by type, user and date, and pages', async () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const all = await ok('audit:list', { from: iso, to: iso, entity: 'official' });
    expect(all.total).toBeGreaterThanOrEqual(3);
    expect(all.rows.every((r) => r.entity === 'official')).toBe(true);

    const page1 = await ok('audit:list', { entity: 'official', limit: 2, offset: 0 });
    const page2 = await ok('audit:list', { entity: 'official', limit: 2, offset: 2 });
    expect(page1.rows).toHaveLength(2);
    expect(page2.rows[0].id).toBeLessThan(page1.rows[1].id);

    const byUser = await ok('audit:list', { userId: page1.rows[0].user_id!, limit: 5 });
    expect(byUser.rows.every((r) => r.user_id === page1.rows[0].user_id)).toBe(true);
    const none = await ok('audit:list', { to: '2000-01-01' });
    expect(none).toEqual({ rows: [], total: 0 });
  });

  it('survives search text with quotes, wildcards and LIKE characters', async () => {
    for (const s of ['"', '%', '_', String.fromCharCode(92), '*', 'a,b)', '100%', 'x"y']) {
      expect((await call('audit:list', { search: s })).ok).toBe(true);
    }
    // '%' is matched literally, not as "everything"
    const pct = await ok('audit:list', { search: '%', limit: 500 });
    expect(pct.rows.every((r) => (r.summary + r.username).includes('%'))).toBe(true);
  });

  it('is admin only', async () => {
    as('user');
    const res = await call('audit:list', {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('FORBIDDEN');
    as('admin');
  });
});
