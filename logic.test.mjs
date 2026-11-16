import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, opensToday, waitSeconds, prune, validKey, groupByDay, score, lastDays, streak } from './logic.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

test('countdown starts at 10s, grows 5s per open, caps at 120s', () => {
  assert.equal(waitSeconds(1), 10);
  assert.equal(waitSeconds(2), 15);
  assert.equal(waitSeconds(5), 30);
  assert.equal(waitSeconds(500), 120);
  assert.equal(waitSeconds(0), 10);
});

test('opens are counted per app and per local day', () => {
  const now = at(2026, 11, 15, 23);
  const events = [
    { t: at(2026, 11, 15, 0), app: 'instagram' },
    { t: at(2026, 11, 15, 22), app: 'instagram' },
    { t: at(2026, 11, 14, 23), app: 'instagram' }, // yesterday
    { t: at(2026, 11, 15, 9), app: 'tiktok' },
  ];
  assert.equal(opensToday(events, 'instagram', now), 2);
  assert.equal(opensToday(events, 'tiktok', now), 1);
  assert.equal(dayKey(at(2026, 1, 5)), '2026-01-05');
});

test('prune drops events older than 90 days', () => {
  const now = at(2026, 11, 15);
  const kept = prune([{ t: now - 89 * 864e5 }, { t: now - 91 * 864e5 }], now);
  assert.equal(kept.length, 1);
});

test('app key rejects anything that is not a plain scheme word', () => {
  assert.ok(validKey('instagram'));
  assert.ok(validKey('fb'));
  for (const bad of ['', null, 'a/b', '../x', 'java script', 'x://y', '1abc', 'a'.repeat(41)])
    assert.ok(!validKey(bad), String(bad));
});

test('days are grouped with visits and passes per app', () => {
  const days = groupByDay([
    { t: at(2026, 11, 15, 9), app: 'instagram', out: 'pass' },
    { t: at(2026, 11, 15, 10), app: 'instagram', out: 'back' },
    { t: at(2026, 11, 15, 11), app: 'tiktok', out: 'left' },
    { t: at(2026, 11, 16, 9), app: 'tiktok', out: 'pass' },
  ]);
  assert.deepEqual(days['2026-11-15'], {
    visits: 3, passes: 1,
    apps: { instagram: { visits: 2, passes: 1 }, tiktok: { visits: 1, passes: 0 } },
  });
  assert.equal(days['2026-11-16'].passes, 1);
});

test('score: 100 when clean, -10 per pass, -2 per walked-away visit, never below 0', () => {
  assert.equal(score(undefined), 100);
  assert.equal(score({ visits: 3, passes: 1 }), 86);
  assert.equal(score({ visits: 40, passes: 40 }), 0);
});

test('lastDays ends today and crosses month ends', () => {
  assert.deepEqual(lastDays(at(2026, 12, 2), 4), ['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
});

test('streak counts good days back from today and stops at a bad day or the first visit', () => {
  const now = at(2026, 11, 16, 20);
  const passes = (d, n) => Array.from({ length: n }, (_, i) => ({ t: at(2026, 11, d, 8) + i, app: 'instagram', out: 'pass' }));
  assert.equal(streak([], now), 0);
  // first visit on the 13th; 14th and 15th have no visits (clean); today has one pass
  assert.equal(streak([...passes(13, 1), ...passes(16, 1)], now), 4);
  // four passes on the 15th scores 60, which breaks the streak there
  assert.equal(streak([...passes(13, 1), ...passes(15, 4), ...passes(16, 1)], now), 1);
  // a bad today means no streak
  assert.equal(streak(passes(16, 4), now), 0);
});
