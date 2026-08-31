/* ═══════════════════════════════════════════════════════════
   WALLBANGERS — Racquetball VR · Baglunch Games
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ───────────────────────────────────────────────────────────
     STORE LINK — the one line to edit when the listing is live.
     Paste the Meta Horizon Store URL between the quotes and every
     "Get it on Quest" button on the site wires itself up.
     Left empty, those buttons render as a non-clickable
     "Coming to the Quest Store" state instead of a dead link.
     ─────────────────────────────────────────────────────────── */
  var STORE_URL = '';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═══════════ store buttons ═══════════ */
  Array.prototype.forEach.call(document.querySelectorAll('[data-store-link]'), function (el) {
    if (STORE_URL) { el.setAttribute('href', STORE_URL); return; }

    el.classList.add('is-pending');
    el.removeAttribute('href');
    el.removeAttribute('target');
    el.removeAttribute('rel');
    el.setAttribute('aria-disabled', 'true');

    el.textContent = el.getAttribute('data-pending') || 'Coming to Quest';
    var note = el.getAttribute('data-pending-note');
    if (note) {
      var s = document.createElement('small');
      s.textContent = note;
      el.appendChild(s);
    }
  });

  /* ═══════════ sticky nav ═══════════ */
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('is-stuck', window.scrollY > 24); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ═══════════ reveal on scroll ═══════════
     Anything in the hero is above the fold by definition and must never
     wait on a scroll event to become visible — on a short viewport (or
     inside an itch.io embed frame) the CTA can sit below the observer's
     boundary and would otherwise stay invisible. Reveal it immediately
     and only observe the sections further down the page. */
  var heroReveals = document.querySelectorAll('.hero .reveal');
  Array.prototype.forEach.call(heroReveals, function (el) { el.classList.add('is-in'); });

  var reveals = document.querySelectorAll('.reveal:not(.is-in)');
  if (reduced || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  }

  /* ═══════════ hero: rally trails ═══════════
     Balls ricochet around the frame leaving the game's own corkscrew
     spin-trail, and stamp a ripple ring on every wall hit. */
  var cv = document.getElementById('rally');
  if (cv && !reduced) {
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var balls = [], rings = [], raf = null, running = false;

    var TAIL = 115;         // trail history length
    var PLASMA = '87,200,255';
    var INDIGO = '138,92,255';

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(n) {
      balls = [];
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = 1.5 + Math.random() * 1.5;
        balls.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          hist: [], phase: Math.random() * Math.PI * 2,
          amp: 9 + Math.random() * 7
        });
      }
    }

    function bounce(b) {
      var hit = false;
      if (b.x < 0) { b.x = 0; b.vx = -b.vx; hit = true; }
      else if (b.x > W) { b.x = W; b.vx = -b.vx; hit = true; }
      if (b.y < 0) { b.y = 0; b.vy = -b.vy; hit = true; }
      else if (b.y > H) { b.y = H; b.vy = -b.vy; hit = true; }
      if (hit && rings.length < 24) rings.push({ x: b.x, y: b.y, r: 4, a: 0.85 });
    }

    /* one corkscrew ribbon along a ball's history */
    function ribbon(b, colour, phaseShift, width) {
      var h = b.hist, n = h.length;
      if (n < 3) return;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      for (var i = 1; i < n; i++) {
        var p = h[i - 1], q = h[i];
        var dx = q.x - p.x, dy = q.y - p.y;
        var len = Math.hypot(dx, dy) || 1;
        var nx = -dy / len, ny = dx / len;          // perpendicular
        var k = b.phase + phaseShift + i * 0.42;
        var o1 = Math.sin(k) * b.amp, o2 = Math.sin(k + 0.42) * b.amp;
        var fade = (i / n) * (i / n);                // tail transparent, head bright
        ctx.strokeStyle = 'rgba(' + colour + ',' + (fade * 0.8).toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(p.x + nx * o1, p.y + ny * o1);
        ctx.lineTo(q.x + nx * o2, q.y + ny * o2);
        ctx.stroke();
      }
    }

    function frame() {
      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < balls.length; i++) {
        var b = balls[i];
        b.x += b.vx; b.y += b.vy;
        bounce(b);
        b.phase += 0.16;
        b.hist.push({ x: b.x, y: b.y });
        if (b.hist.length > TAIL) b.hist.shift();

        ribbon(b, INDIGO, 1.6, 2.5);
        ribbon(b, PLASMA, 0, 3.2);

        var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 26);
        g.addColorStop(0, 'rgba(210,245,255,.55)');
        g.addColorStop(0.35, 'rgba(' + PLASMA + ',.28)');
        g.addColorStop(1, 'rgba(' + PLASMA + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, 26, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = 'rgba(226,248,255,.85)';
        ctx.beginPath(); ctx.arc(b.x, b.y, 3.2, 0, Math.PI * 2); ctx.fill();
      }

      for (var j = rings.length - 1; j >= 0; j--) {
        var r = rings[j];
        r.r += 1.9; r.a -= 0.016;
        if (r.a <= 0) { rings.splice(j, 1); continue; }
        ctx.strokeStyle = 'rgba(232,246,255,' + r.a.toFixed(3) + ')';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
      }

      raf = requestAnimationFrame(frame);
    }

    function start() { if (!running) { running = true; frame(); } }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    resize();
    spawn(W < 700 ? 2 : 3);
    start();

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { resize(); spawn(W < 700 ? 2 : 3); }, 180);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });

    /* don't burn frames once the hero is scrolled past */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) start(); else stop();
      }, { threshold: 0 }).observe(cv);
    }
  }

  /* ═══════════ trailer: load the embed only on click ═══════════ */
  var trailer = document.getElementById('trailerBox');
  if (trailer) {
    var poster = trailer.querySelector('.trailer__poster');
    if (poster) {
      poster.addEventListener('click', function () {
        var id = trailer.getAttribute('data-video');
        var f = document.createElement('iframe');
        f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1';
        f.title = 'WALLBANGERS Racquetball VR — trailer';
        f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        f.setAttribute('allowfullscreen', '');
        f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        trailer.innerHTML = '';
        trailer.appendChild(f);
      });
    }
  }

  /* ═══════════ screenshot lightbox ═══════════ */
  var lb = document.getElementById('lb');
  if (lb) {
    var lbImg = document.getElementById('lbImg');
    var lbCap = document.getElementById('lbCap');
    var lbClose = document.getElementById('lbClose');
    var opener = null;

    function open(btn) {
      opener = btn;
      lbImg.src = btn.getAttribute('data-full');
      lbImg.alt = btn.getAttribute('data-title') || '';
      lbCap.innerHTML = '';
      var b = document.createElement('b');
      b.textContent = btn.getAttribute('data-title') || '';
      lbCap.appendChild(b);
      lbCap.appendChild(document.createTextNode(btn.getAttribute('data-cap') || ''));
      lb.hidden = false;
      requestAnimationFrame(function () { lb.classList.add('is-open'); });
      lbClose.focus();
    }

    function close() {
      lb.classList.remove('is-open');
      setTimeout(function () {
        lb.hidden = true;
        lbImg.src = '';
        if (opener) { opener.focus(); opener = null; }
      }, 260);
    }

    Array.prototype.forEach.call(document.querySelectorAll('.shot__btn'), function (btn) {
      btn.addEventListener('click', function () { open(btn); });
    });
    lbClose.addEventListener('click', close);
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !lb.hidden) close();
    });
  }

  /* ═══════════ footer year ═══════════ */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
