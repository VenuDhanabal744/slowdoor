import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, opensToday, waitSeconds, prune, validKey } from './logic.js';

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
