import { dayKey, opensToday, waitSeconds, prune, validKey } from './logic.js';

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

function home() {
  const n = load().events.filter((e) => dayKey(e.t) === dayKey(Date.now())).length;
  $('h-today').textContent = n ? `${n} gate visit${n === 1 ? '' : 's'} today` : 'No gate visits today.';
  $('h-url').textContent = `${location.origin}${location.pathname}?app=instagram`;
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
  const label = LABELS[app] || app[0].toUpperCase() + app.slice(1);
  let done = false;

  $('g-title').textContent = `Opening ${label}?`;
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
