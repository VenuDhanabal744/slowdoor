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

// The app key doubles as a URL scheme and a file name in Shortcuts, so keep it strict.
export const validKey = (k) => /^[a-z][a-z0-9+.-]{0,39}$/i.test(k || '');
