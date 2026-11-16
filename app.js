import { dayKey, opensToday, waitSeconds, prune, validKey, groupByDay, score, lastDays, streak, SCORE_OK } from './logic.js';

const STORE = 'slowdoor.v1';
const PASS_SHORTCUT = 'SD Pass'; // must match the shortcut's name in the Shortcuts app exactly

// key = the app's URL scheme without "://". Unknown keys still work; they just show the key as the name.
const LABELS = {
  instagram: 'Instagram', tiktok: 'TikTok', twitter: 'X', youtube: 'YouTube',
  reddit: 'Reddit', snapchat: 'Snapchat', fb: 'Facebook', barcelona: 'Threads',
};

const $ = (id) => document.getElementById(id);

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && Array.isArray(s.events)) return s;
  } catch {}
  return { events: [] };
}

function save(s) {
  try { localStorage.setItem(STORE, JSON.stringify(s)); } catch {} // private mode / full: gate still works, just not logged
}

function show(id) {
  for (const m of document.querySelectorAll('main')) m.hidden = m.id !== id;
}

const labelOf = (app) => LABELS[app] || app[0].toUpperCase() + app.slice(1);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const el = (tag, props, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
};

function home() {
  const now = Date.now();
  const { events } = load();
  const days = groupByDay(events);
  const today = days[dayKey(now)];

  $('h-score').textContent = score(today);
  $('h-streak').textContent = `${plural(streak(events, now), 'day')} in a row at ${SCORE_OK} or better`;

  const rows = Object.entries(today?.apps || {})
    .sort((a, b) => b[1].visits - a[1].visits)
    .map(([app, a]) => el('li', {}, el('span', { textContent: labelOf(app) }),
      el('span', { textContent: `${plural(a.visits, 'visit')} · ${a.passes} opened` })));
  $('h-apps').replaceChildren(...(rows.length ? rows : [el('li', { textContent: 'No gate visits today.' })]));

  const week = lastDays(now, 7).map((key) => ({ key, visits: 0, passes: 0, ...days[key] }));
  const max = Math.max(1, ...week.map((d) => d.visits));
  const px = (n) => (n ? `${Math.max(3, Math.round((n / max) * 104))}px` : '0');
  const pick = (d, col) => {
    const name = new Date(`${d.key}T12:00`).toLocaleDateString(undefined, { weekday: 'long' });
    $('h-day').textContent = `${name}: ${plural(d.visits, 'gate visit')}, ${d.passes} opened anyway`;
    for (const c of $('h-chart').children) c.classList.toggle('on', c === col);
  };
  const cols = week.map((d) => {
    const letter = new Date(`${d.key}T12:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
    // "Opened anyway" sits on the baseline so it is the easy one to compare across days.
    const stack = d.visits
      ? el('span', { className: 'stack' },
          ...(d.passes ? [el('i', { className: 'pass', style: `height:${px(d.passes)}` })] : []),
          ...(d.visits > d.passes ? [el('i', { className: 'back', style: `height:${px(d.visits - d.passes)}` })] : []))
      : el('span', { className: 'stack' }, el('i', { className: 'none' }));
    const col = el('button', { type: 'button', className: 'col' }, stack, el('span', { textContent: letter }));
    col.setAttribute('aria-label', `${d.key}: ${plural(d.visits, 'gate visit')}, ${d.passes} opened anyway`);
    col.onclick = () => pick(d, col);
    return col;
  });
  $('h-chart').replaceChildren(...cols);
  pick(week[6], cols[6]);

  show('home');
}

function gate(app) {
  const now = Date.now();
  const s = load();
  s.events = prune(s.events, now);
  s.events.push({ t: now, app, out: 'left' }); // 'left' unless a button says otherwise
  save(s);
  // Drop ?app= so a reloaded or restored tab can't log a phantom open.
  history.replaceState(null, '', location.pathname);

  const n = opensToday(s.events, app, now);
  const wait = waitSeconds(n);
  const end = now + wait * 1000;
  let done = false;

  $('g-title').textContent = `Opening ${labelOf(app)}?`;
  $('g-count').textContent = n === 1 ? 'First time today' : `Open #${n} today`;

  const refresh = () => {
    const waited = Date.now() >= end;
    const said = $('g-why').value.trim().length >= 3;
    $('g-open').disabled = !(waited && said);
    $('g-hint').textContent = !waited ? 'Sit with it until the timer runs out.' : !said ? 'Say what it is for first.' : '';
  };
  const tick = () => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    $('g-secs').textContent = left;
    $('g-ring').style.setProperty('--p', 1 - left / wait);
    refresh();
    if (!left) clearInterval(timer);
  };
  const timer = setInterval(tick, 250);
  tick();
  $('g-why').addEventListener('input', refresh);

  const finish = (out) => {
    done = true;
    clearInterval(timer);
    const fresh = load(); // re-read: another gate tab may have written since
    const ev = fresh.events.find((e) => e.t === now && e.app === app);
    if (!ev) return;
    ev.out = out;
    const why = $('g-why').value.trim();
    if (why) ev.why = why;
    save(fresh);
  };

  $('g-back').onclick = () => { finish('back'); show('done'); };
  $('g-open').onclick = () => {
    finish('pass');
    home();
    location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(PASS_SHORTCUT)}&input=text&text=${encodeURIComponent(app)}`;
  };

  // Leaving Safari closes the gate, so a finished countdown can't be kept in a tab for later.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (!done) { done = true; clearInterval(timer); }
    home();
  });

  show('gate');
}

const app = new URLSearchParams(location.search).get('app');
if (validKey(app)) gate(app.toLowerCase()); else home();

// Coming back to an open tab: redraw so the numbers are current.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !$('home').hidden) home();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
