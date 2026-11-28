/* Desmos calculator for the games. A page puts a [data-ufq-calc] button where it wants one;
   the panel lives outside the page's own markup, so the graph survives new questions and redraws. */
(function () {
  'use strict';
  var URLS = { g: 'https://www.desmos.com/calculator', s: 'https://www.desmos.com/scientific' };
  var panel = null, frames = {}, tabs = {}, mode = 'g';

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
  function show(m) {
    mode = m;
    if (!frames[m]) {
      var f = document.createElement('iframe'); f.src = URLS[m]; f.title = m === 'g' ? 'Desmos graphing calculator' : 'Desmos scientific calculator';
      frames[m] = f; panel.appendChild(f);
    }
    ['g', 's'].forEach(function (k) { if (frames[k]) frames[k].style.display = k === m ? 'block' : 'none'; tabs[k].setAttribute('aria-pressed', k === m ? 'true' : 'false'); });
  }
  function build() {
    var style = el('style');
    style.textContent = '.ufqcalc{position:fixed;z-index:80;right:16px;top:90px;width:min(520px,calc(100vw - 32px));height:min(600px,calc(100dvh - 110px));display:none;flex-direction:column;gap:8px;padding:10px;background:#fff;border-radius:18px;box-shadow:0 0 0 1px rgba(0,48,73,.16),0 30px 60px -24px rgba(0,48,73,.5);resize:both;overflow:hidden}' +
      '.ufqcalc.open{display:flex}.ufqcalc iframe{flex:1;min-height:0;width:100%;border:0;border-radius:12px;background:#fff}' +
      '.ufqcalc .bar{display:flex;gap:4px;align-items:center}.ufqcalc .bar button{border:0;border-radius:8px;min-height:36px;padding:0 12px;background:transparent;color:#003049;font:600 14px "Inter Tight",sans-serif;cursor:pointer}' +
      '.ufqcalc .bar button[aria-pressed="true"]{background:#003049;color:#fff}.ufqcalc .bar .x{margin-left:auto}' +
      '.ufqcalcbtn{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border:0;border-radius:12px;background:#EEF2F5;color:#003049;font:600 14px "Inter Tight",sans-serif;cursor:pointer}' +
      '@media (max-width:700px){.ufqcalc{left:8px;right:8px;top:auto;bottom:8px;width:auto;height:52dvh;resize:none}}';
    document.head.appendChild(style);
    panel = el('div', 'ufqcalc'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Calculator');
    var bar = el('div', 'bar');
    [['g', 'Graphing'], ['s', 'Scientific']].forEach(function (t) { var b = el('button', '', t[1]); b.type = 'button'; b.onclick = function () { show(t[0]); }; tabs[t[0]] = b; bar.appendChild(b); });
    var x = el('button', 'x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Close calculator'); x.onclick = function () { panel.classList.remove('open'); };
    bar.appendChild(x); panel.appendChild(bar);
    document.body.appendChild(panel);
  }
  function start() {
    build();
    document.addEventListener('click', function (e) {
      if (!(e.target && e.target.closest && e.target.closest('[data-ufq-calc]'))) return;
      e.preventDefault();
      if (panel.classList.toggle('open')) show(mode);
    });
    /* the round is over (or was left): the button is gone, so the calculator goes too */
    setInterval(function () {
      if (!panel.classList.contains('open')) return;
      var live = Array.prototype.some.call(document.querySelectorAll('[data-ufq-calc]'), function (b) { return !b.closest('x-dc'); });
      if (!live) panel.classList.remove('open');
    }, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
