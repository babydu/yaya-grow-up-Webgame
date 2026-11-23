// Dynamic favicon + tab title attention cues.
//
// Browser reality check: GIF/APNG/SVG-SMIL animations are NOT played by most
// browsers (Chrome renders the favicon as a single static frame). The reliable
// cross-browser technique is to swap the <link rel="icon"> href from JS.
//
// Two axes are encoded:
//   1. urgency -> colour (green idle / warm amber needs care / red critical)
//   2. watching -> a corner dot + a short pulse + a "（提示）" title prefix
//                  appear whenever the tab is not being looked at.
// game.js pushes the live urgency through window.TabCue.set({...}); when it is
// never called (landing page, JS disabled) the cue stays calmly green.
(function () {
  const link = document.getElementById('favicon');
  if (!link) return;

  const baseTitle = document.title;
  const sprout = 'M12 21v-9M12 15C4 15 3 10 3 5c6 0 9 3 9 8M12 11c0-6 4-9 9-9 0 6-3 10-9 10';
  // [base, alternate] background pair per urgency; the pair drives the pulse.
  const PALETTE = {
    ok: ['#718365', '#6b7d5f'],
    need: ['#d9a57e', '#cc8a5c'],
    critical: ['#c96a5e', '#b9554a']
  };

  const svg = (bg, away) => {
    const dot = away
      ? '<circle cx="24.5" cy="7.5" r="3.6" fill="#fffdf7"/><circle cx="24.5" cy="7.5" r="1.5" fill="' + bg + '"/>'
      : '';
    return 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="' + bg + '"/>' +
      '<g transform="translate(16 16) scale(1.25) translate(-12 -12)"><path d="' + sprout + '" fill="none" stroke="#f4f7ef" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      dot + '</svg>');
  };

  let focused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
  const isAway = () => document.hidden || !focused;
  let info = { level: 'ok', count: 0, hint: '它在等你' };
  let timer = null;
  let frame = 0;
  let lastCount = -1;
  let lastTitle = '';

  function speed() {
    if (info.level === 'critical') return focused ? 900 : 600;
    if (info.level === 'need') return focused ? 1500 : 900;
    return focused ? 2600 : 1600;
  }

  function paint() {
    const pair = PALETTE[info.level] || PALETTE.ok;
    link.setAttribute('href', svg(pair[frame % 2], isAway()));
  }

  function applyTitle() {
    const next = focused ? baseTitle : '（' + (info.hint || '它在等你') + '）' + baseTitle;
    if (next !== lastTitle) { document.title = next; lastTitle = next; }
  }

  function applyBadge() {
    const n = Math.max(0, info.count | 0);
    if (n === lastCount) return;
    lastCount = n;
    try {
      if (n > 0 && typeof navigator.setAppBadge === 'function') navigator.setAppBadge(n);
      else if (n <= 0 && typeof navigator.clearAppBadge === 'function') navigator.clearAppBadge();
    } catch (_) { /* badge support is optional */ }
  }

  function restart() {
    if (timer) { clearInterval(timer); timer = null; }
    frame = 0;
    paint();
    timer = setInterval(() => { frame += 1; paint(); }, speed());
  }

  function refresh() {
    applyTitle();
    applyBadge();
    restart();
  }

  window.TabCue = {
    set(next) {
      const prevLevel = info.level;
      info = {
        level: next && PALETTE[next.level] ? next.level : 'ok',
        count: next && next.count ? next.count : 0,
        hint: (next && next.hint) || '它在等你'
      };
      // Only rebuild the pulse loop when its speed (level/focus) changes;
      // otherwise just keep painting and update title/badge.
      if (info.level !== prevLevel) refresh();
      else { applyTitle(); applyBadge(); }
    }
  };

  window.addEventListener('focus', () => { focused = true; refresh(); });
  window.addEventListener('blur', () => { focused = false; refresh(); });
  document.addEventListener('visibilitychange', () => refresh());

  restart();
  applyTitle();
})();
