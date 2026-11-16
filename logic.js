// Pure logic, no DOM. Tested by logic.test.mjs (run: node --test).

export const dayKey = (t) => {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const opensToday = (events, app, now) =>
  events.filter((e) => e.app === app && dayKey(e.t) === dayKey(now)).length;

// n = how many times this app hit the gate today, counting this one.
export const waitSeconds = (n) => Math.min(10 + 5 * Math.max(0, n - 1), 120);

// shortcut: raw events live in localStorage (5 MB cap), so keep 90 days; move to IndexedDB if you want longer history.
export const prune = (events, now, days = 90) =>
  events.filter((e) => now - e.t < days * 864e5);

export const SCORE_OK = 70; // a day at or above this keeps the streak

// { '2026-11-16': { visits, passes, apps: { instagram: { visits, passes } } } }
export const groupByDay = (events) => {
  const days = {};
  for (const e of events) {
    const d = (days[dayKey(e.t)] ??= { visits: 0, passes: 0, apps: {} });
    const a = (d.apps[e.app] ??= { visits: 0, passes: 0 });
    d.visits++;
    a.visits++;
    if (e.out === 'pass') { d.passes++; a.passes++; }
  }
  return days;
};

// 100 on a clean day. "Open anyway" costs 10; a visit you walked away from costs 2.
export const score = (d) => (d ? Math.max(0, 100 - 10 * d.passes - 2 * (d.visits - d.passes)) : 100);

// Day keys for the last n local days, oldest first, ending today.
export const lastDays = (now, n) => {
  const d = new Date(now);
  return Array.from({ length: n }, (_, i) =>
    dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - (n - 1 - i))));
};

// Days in a row, ending today, scoring SCORE_OK or better. Days before the first logged visit don't count.
export const streak = (events, now) => {
  if (!events.length) return 0;
  const days = groupByDay(events);
  const first = dayKey(Math.min(...events.map((e) => e.t)));
  let n = 0;
  for (const day of lastDays(now, 90).reverse()) {
    if (day < first || score(days[day]) < SCORE_OK) break;
    n++;
  }
  return n;
};

// The app key doubles as a URL scheme and a file name in Shortcuts, so keep it strict.
export const validKey = (k) => /^[a-z][a-z0-9+.-]{0,39}$/i.test(k || '');
