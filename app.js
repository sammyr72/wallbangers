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

  /* ═══════════ pachinko: racquetballs down the page ═══════════
     Blue racquetballs spawn above the viewport, fall under gravity and
     bounce off the real content boxes — cards, buttons, headings, court
     lines — like pegs in a pachinko machine.

     Balls live in DOCUMENT coordinates, not viewport ones. That means the
     peg rectangles are scroll-invariant (measured once per layout instead
     of every frame), balls stay put on the page as you scroll either way,
     and culling is simply "too far outside the visible band".

     Ball count is adaptive: it starts at a fraction of the ceiling and the
     governor walks it up or down against real frame times, so a fast
     desktop fills the page and a weak machine stays smooth. */
  var cv = document.getElementById('pachinko');
  if (cv && !reduced) {
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var balls = [], pegs = [], rows = Object.create(null);
    var raf = null, running = false, stamp = 0;

    var GRAVITY = 0.26;
    var RESTITUTION = 0.62;   /* racquetballs are lively */
    var WALL_BOUNCE = 0.5;
    var AIR = 0.9975;
    var MAX_VY = 14;
    var R_MIN = 4.5, R_MAX = 8.5;
    var CULL = 700;           /* px outside the viewport before a ball dies */
    var ROW = 260;            /* peg bucket height */

    var ceiling = 0, cap = 0, MIN_CAP = 24;

    /* ── the ball, drawn once and blitted ── */
    var SPR = 48, sprite = (function () {
      var s = document.createElement('canvas');
      s.width = s.height = SPR * 2;
      var c = s.getContext('2d');
      var g = c.createRadialGradient(SPR * .66, SPR * .58, SPR * .06, SPR, SPR, SPR);
      g.addColorStop(0, '#d3efff');
      g.addColorStop(.16, '#7fccff');
      g.addColorStop(.5, '#2f8fe0');
      g.addColorStop(.85, '#164f88');
      g.addColorStop(1, 'rgba(12,42,74,.85)');
      c.fillStyle = g;
      c.beginPath(); c.arc(SPR, SPR, SPR - 1, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.beginPath(); c.ellipse(SPR * .64, SPR * .54, SPR * .19, SPR * .13, -.6, 0, Math.PI * 2); c.fill();
      return s;
    })();

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      /* Benchmarked: the sim + blit costs ~0.5ms/frame at 1000 balls, so JS is
         nowhere near the limit — legibility is. Balls live across a band about
         2x the viewport (spawn point down to cull line), so roughly half of
         this count is on screen at any moment. Lower the divisor for a denser
         page, raise it for a calmer one; the governor below still trims on
         devices that cannot keep up. */
      ceiling = Math.max(50, Math.min(420, Math.round(W * H / 5200)));
      cap = Math.min(cap || Math.round(ceiling * 0.5), ceiling);
    }

    /* ── peg rectangles, in document space ── */
    /* Pegs are elements with a VISIBLE edge, and never full-bleed ones:
       anything spanning the whole width (.courtline, .marquee, .foot) would
       dam the balls, pile them up and starve the rest of the page. Everything
       here leaves gutters or gaps for balls to fall through. */
    var PEG_SEL = '.eyebrow, .stat, .btn, .cell, .bot, .tier, .shot__btn,' +
                  '.trailer, .get, .ladder, .spec > div, .kev img,' +
                  '.beta__badge, .hero__racket, .lb__card';

    function measure() {
      var sy = window.scrollY || window.pageYOffset || 0;
      pegs = [];
      Array.prototype.forEach.call(document.querySelectorAll(PEG_SEL), function (el) {
        var r = el.getBoundingClientRect();
        if (r.width < 10 || r.height < 3) return;
        pegs.push({ x: r.left, y: r.top + sy, w: r.width, h: r.height, t: -1 });
      });
      rows = Object.create(null);
      for (var i = 0; i < pegs.length; i++) {
        var p = pegs[i];
        var a = Math.floor(p.y / ROW), b = Math.floor((p.y + p.h) / ROW);
        for (var r2 = a; r2 <= b; r2++) (rows[r2] || (rows[r2] = [])).push(p);
      }
    }

    function spawn() {
      var sy = window.scrollY || window.pageYOffset || 0;
      balls.push({
        x: Math.random() * W,
        y: sy - 30 - Math.random() * 260,
        vx: (Math.random() - .5) * 1.6,
        vy: Math.random() * 1.5,
        r: R_MIN + Math.random() * (R_MAX - R_MIN),
        slow: 0
      });
    }

    /* circle vs axis-aligned box, with a little sideways jitter on impact
       so balls scatter instead of stacking into columns */
    function collide(b) {
      var r0 = Math.floor((b.y - b.r) / ROW), r1 = Math.floor((b.y + b.r) / ROW);
      for (var rr = r0; rr <= r1; rr++) {
        var list = rows[rr];
        if (!list) continue;
        for (var i = 0; i < list.length; i++) {
          var p = list[i];
          if (p.t === stamp) continue;   /* peg spans two buckets */
          p.t = stamp;
          var cx = b.x < p.x ? p.x : (b.x > p.x + p.w ? p.x + p.w : b.x);
          var cy = b.y < p.y ? p.y : (b.y > p.y + p.h ? p.y + p.h : b.y);
          var dx = b.x - cx, dy = b.y - cy;
          var d2 = dx * dx + dy * dy;
          if (d2 >= b.r * b.r) continue;

          var d = Math.sqrt(d2), nx, ny;
          if (d > 0.0001) { nx = dx / d; ny = dy / d; }
          else { nx = 0; ny = -1; d = 0; }          /* dead centre: eject upward */

          b.x += nx * (b.r - d);
          b.y += ny * (b.r - d);

          var vn = b.vx * nx + b.vy * ny;
          if (vn < 0) {
            b.vx -= (1 + RESTITUTION) * vn * nx;
            b.vy -= (1 + RESTITUTION) * vn * ny;
            b.vx += (Math.random() - .5) * .8;
            b.vx *= .95;
          }
        }
      }
    }

    /* ── adaptive count ── */
    var times = [], last = 0, warm = 0;
    function governor(now) {
      if (last) {
        var dt = now - last;
        /* Ignore the first stretch of frames: fonts, images and first layout
           make load jank that would otherwise ratchet the count straight down
           before the page has settled. Also drop absurd deltas (tab switch,
           GC pause) rather than letting one spike cut the count. */
        if (++warm > 90 && dt < 60) {
          times.push(dt);
          if (times.length >= 75) {
            var avg = 0;
            for (var i = 0; i < times.length; i++) avg += times[i];
            avg /= times.length;
            times.length = 0;
            if (avg > 19.5 && cap > MIN_CAP) cap = Math.max(MIN_CAP, cap - 14);
            else if (avg < 13.5 && cap < ceiling) cap = Math.min(ceiling, cap + 8);
          }
        }
      }
      last = now;
    }

    function frame(now) {
      var sy = window.scrollY || window.pageYOffset || 0;
      stamp++;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = .9;

      var budget = 8;                       /* ease new balls in, no bursts */
      while (balls.length < cap && budget-- > 0) spawn();

      for (var i = balls.length - 1; i >= 0; i--) {
        var b = balls[i];

        b.vy += GRAVITY;
        if (b.vy > MAX_VY) b.vy = MAX_VY;
        b.vx *= AIR;
        b.x += b.vx;
        b.y += b.vy;

        if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * WALL_BOUNCE; }
        else if (b.x > W - b.r) { b.x = W - b.r; b.vx = -b.vx * WALL_BOUNCE; }

        collide(b);

        /* A ball wedged on a wide box has nothing to damp it, so it would
           jitter in place forever. Recycle anything that stops making
           progress; it respawns at the top. */
        b.slow = (Math.abs(b.vy) < .4 && Math.abs(b.vx) < .4) ? b.slow + 1 : 0;

        /* far enough off screen, in either direction — or stalled */
        if (b.y > sy + H + CULL || b.y < sy - CULL - 400 || b.slow > 110) {
          balls.splice(i, 1); continue;
        }

        var vy = b.y - sy;
        if (vy > -30 && vy < H + 30) ctx.drawImage(sprite, b.x - b.r, vy - b.r, b.r * 2, b.r * 2);
      }

      governor(now);
      raf = requestAnimationFrame(frame);
    }

    function start() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    resize();
    measure();
    start();

    /* the page reflows as fonts and images land */
    window.addEventListener('load', measure);
    setTimeout(measure, 600);
    setTimeout(measure, 2000);

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { resize(); measure(); }, 180);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });

    /* reveal animations change element heights as you scroll past them */
    var mt;
    window.addEventListener('scroll', function () {
      clearTimeout(mt);
      mt = setTimeout(measure, 220);
    }, { passive: true });
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
