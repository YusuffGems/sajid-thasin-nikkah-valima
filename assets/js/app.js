/* ==========================================================
   Nikkah & Valima e-invitation · app logic
   No dependencies. Everything here is cheap: no scroll-bound
   layout work, no per-frame animation loops.
   ========================================================== */
(function () {
  'use strict';

  var CFG = window.INVITE || {};
  var doc = document;
  var root = doc.documentElement;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function safeGet(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function safeSet(store, key, val) { try { window[store].setItem(key, val); } catch (e) {} }

  /* ---------- Toast ---------- */
  var toastEl = $('#toast'), toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-show'); }, 2600);
  }

  /* ---------- Theme ---------- */
  function initTheme() {
    var menu = $('#themeMenu'), toggle = $('#themeToggle');
    if (!menu || !toggle) return;
    var themes = CFG.themes || [];

    themes.forEach(function (t) {
      var b = doc.createElement('button');
      b.type = 'button'; b.className = 'theme-opt'; b.setAttribute('role', 'menuitemradio');
      b.setAttribute('data-id', t.id);
      b.innerHTML = '<i></i><span>' + t.label + '</span>';
      menu.appendChild(b);
    });

    function mark() {
      var cur = root.getAttribute('data-theme');
      $$('.theme-opt', menu).forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-id') === cur)); });
    }
    function apply(id) {
      root.setAttribute('data-theme', id);
      safeSet('localStorage', CFG.storageKey, id);
      var meta = $('meta[name="theme-color"]');
      var t = themes.filter(function (x) { return x.id === id; })[0];
      if (meta && t) meta.setAttribute('content', t.color);
      mark();
    }
    function setOpen(open) { menu.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); }

    toggle.addEventListener('click', function (e) { e.stopPropagation(); setOpen(menu.hidden); });
    menu.addEventListener('click', function (e) {
      var b = e.target.closest('.theme-opt');
      if (b) { apply(b.getAttribute('data-id')); setOpen(false); }
    });
    doc.addEventListener('click', function (e) { if (!menu.hidden && !e.target.closest('#themeSwitcher')) setOpen(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    mark();
  }

  /* ---------- Header: scrolled state, mobile menu, scroll-spy, to-top ---------- */
  function initHeader() {
    var header = $('#header'), nav = $('#nav'), btn = $('#navToggle'), top = $('#toTop');
    var ticking = false;

    function onScroll() {
      ticking = false;
      var y = window.pageYOffset || root.scrollTop;
      if (header) header.classList.toggle('is-scrolled', y > 24);
      if (top) top.classList.toggle('is-visible', y > 700);
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();

    function closeNav() { if (nav) nav.classList.remove('is-open'); if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Open menu'); } }
    if (btn && nav) {
      btn.addEventListener('click', function () {
        var open = !nav.classList.contains('is-open');
        nav.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      });
      nav.addEventListener('click', function (e) { if (e.target.closest('a')) closeNav(); });
    }
    if (top) top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); });

    // scroll-spy
    if ('IntersectionObserver' in window) {
      var links = {};
      $$('.nav__link').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          Object.keys(links).forEach(function (k) { links[k].classList.toggle('is-active', k === en.target.id); });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(links).forEach(function (id) { var s = doc.getElementById(id); if (s) spy.observe(s); });
    }
  }

  /* ---------- Reveal on scroll ---------- */
  var revealStarted = false;
  function startReveal() {
    if (revealStarted) return;
    revealStarted = true;
    var els = $$('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Tabs ---------- */
  function initTabs() {
    $$('.tabs').forEach(function (tabs) {
      var buttons = $$('[role="tab"]', tabs), panels = $$('[role="tabpanel"]', tabs);
      function select(i, focus) {
        buttons.forEach(function (b, n) {
          var on = n === i;
          b.setAttribute('aria-selected', String(on));
          b.tabIndex = on ? 0 : -1;
          if (panels[n]) panels[n].hidden = !on;
        });
        if (focus) buttons[i].focus();
      }
      buttons.forEach(function (b, i) {
        b.addEventListener('click', function () { select(i); });
        b.addEventListener('keydown', function (e) {
          var n = buttons.length, k = e.key;
          if (k === 'ArrowRight') { e.preventDefault(); select((i + 1) % n, true); }
          else if (k === 'ArrowLeft') { e.preventDefault(); select((i - 1 + n) % n, true); }
          else if (k === 'Home') { e.preventDefault(); select(0, true); }
          else if (k === 'End') { e.preventDefault(); select(n - 1, true); }
        });
      });
      select(0);
    });
  }

  /* ---------- Countdown ---------- */
  function initCountdown() {
    var blocks = $$('.countdown[data-event]').map(function (el) {
      var ev = (CFG.events || {})[el.getAttribute('data-event')];
      if (!ev) return null;
      var done = $('.countdown__done[data-done-for="' + el.getAttribute('data-event') + '"]');
      if (done) done.textContent = ev.done || '';
      return {
        el: el, done: done, target: new Date(ev.start).getTime(),
        nums: { days: $('[data-cd="days"]', el), hours: $('[data-cd="hours"]', el), mins: $('[data-cd="mins"]', el), secs: $('[data-cd="secs"]', el) },
        last: {}
      };
    }).filter(Boolean);
    if (!blocks.length) return;

    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function tick() {
      var now = Date.now();
      blocks.forEach(function (b) {
        var diff = b.target - now;
        if (diff <= 0) {
          b.el.hidden = true;
          if (b.done) b.done.hidden = false;
          return;
        }
        var s = Math.floor(diff / 1000);
        var vals = { days: Math.floor(s / 86400), hours: Math.floor(s % 86400 / 3600), mins: Math.floor(s % 3600 / 60), secs: s % 60 };
        Object.keys(vals).forEach(function (k) {
          var txt = pad(vals[k]);
          if (b.last[k] !== txt && b.nums[k]) { b.nums[k].textContent = txt; b.last[k] = txt; }
        });
      });
    }
    tick();
    var timer = setInterval(tick, 1000);
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) { clearInterval(timer); timer = null; }
      else if (!timer) { tick(); timer = setInterval(tick, 1000); }
    });
  }

  /* ---------- Actions: save the date (.ics) & share ---------- */
  function icsStamp(d) { return new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function icsText(s) { return String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, function (m) { return '\\' + m; }).replace(/\n/g, '\\n'); }

  function downloadIcs(key) {
    var ev = (CFG.events || {})[key];
    if (!ev) return;
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Invitation//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:' + key + '-' + icsStamp(ev.start) + '@invitation',
      'DTSTAMP:' + icsStamp(Date.now()),
      'DTSTART:' + icsStamp(ev.start), 'DTEND:' + icsStamp(ev.end),
      'SUMMARY:' + icsText(ev.title), 'LOCATION:' + icsText(ev.location), 'DESCRIPTION:' + icsText(ev.notes),
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(ev.title), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ];
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url; a.download = key + '-invitation.ics';
    doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    toast('Calendar file downloaded');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { toast('Link copied'); }, function () { toast(text); });
    }
    var ta = doc.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    doc.body.appendChild(ta); ta.select();
    try { doc.execCommand('copy'); toast('Link copied'); } catch (e) { toast(text); }
    ta.remove();
  }

  function share() {
    var data = { title: doc.title, text: CFG.shareText, url: location.href.split('#')[0] };
    if (navigator.share) {
      return navigator.share(data).catch(function (e) { if (e && e.name !== 'AbortError') copyText(data.url); });
    }
    copyText(data.url);
  }

  function initActions() {
    doc.addEventListener('click', function (e) {
      var cal = e.target.closest('[data-calendar]');
      if (cal) { downloadIcs(cal.getAttribute('data-calendar')); return; }
      if (e.target.closest('[data-share]')) share();
    });
  }

  /* ---------- Sky: two static canvases, drawn once ---------- */
  function initSky() {
    var a = $('#skyA'), b = $('#skyB');
    if (!a || !b) return;
    var lastW = 0;
    function draw() {
      var w = window.innerWidth, h = window.innerHeight;
      if (w === lastW) return; // ignore mobile address-bar height changes
      lastW = w;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var count = Math.max(30, Math.min(70, Math.round(w * h / 18000)));
      [a, b].forEach(function (cv) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        var ctx = cv.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < count; i++) {
          var x = Math.random() * w, y = Math.random() * h, r = Math.random() * 1.3 + .3;
          ctx.globalAlpha = Math.random() * .6 + .3;
          ctx.fillStyle = Math.random() > .75 ? '#ecd49b' : '#fff7e0';
          ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
        }
      });
    }
    draw();
    var t;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(draw, 250); });
  }

  /* ---------- Envelope intro ---------- */
  function initIntro() {
    var intro = $('#intro'), env = $('#envelope');
    function unlock() { doc.body.classList.remove('is-locked'); }

    if (!intro || !env || safeGet('sessionStorage', 'inv-opened') === '1') {
      if (intro) intro.remove();
      unlock(); startReveal();
      return;
    }

    var opened = false;
    function leave() {
      intro.classList.add('is-leaving');
      unlock(); startReveal();
      setTimeout(function () { if (intro.parentNode) intro.remove(); }, 1000);
    }
    env.addEventListener('click', function () {
      if (opened) return;
      opened = true;
      safeSet('sessionStorage', 'inv-opened', '1');
      intro.classList.add('is-open');
      setTimeout(leave, reduced ? 150 : 1500);
    });
  }

  /* ---------- Start ---------- */
  function init() {
    initTheme();
    initHeader();
    initTabs();
    initCountdown();
    initActions();
    initSky();
    initIntro();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();


const bottomNav = document.getElementById("iosBottomNav");

const navLinks = bottomNav.querySelectorAll(".ios-tab");

navLinks.forEach(link => {
  link.addEventListener("click", () => {
    navLinks.forEach(item => item.classList.remove("active"));
    link.classList.add("active");
  });
});

// Update active tab while scrolling
const sections = document.querySelectorAll(
  "#home, #couple, #nikah, #valima, #family"
);

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.classList.toggle(
          "active",
          link.getAttribute("href") === "#" + entry.target.id
        );
      });
    }
  });
}, { threshold: 0.35 });

sections.forEach(section => observer.observe(section));
