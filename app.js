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

  /* ═══════════ mobile menu ═══════════ */
  var navToggle = document.getElementById('navToggle');
  /* find the bar from the button, not by id: privacy.html has a .nav that is
     permanently stuck and carries no #nav id */
  var navBar = navToggle && navToggle.closest ? navToggle.closest('.nav') : null;
  if (navBar && navToggle) {
    var closeNav = function () {
      navBar.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    };

    navToggle.addEventListener('click', function () {
      var open = navBar.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    /* close once a section is picked, and on Escape */
    Array.prototype.forEach.call(document.querySelectorAll('#navLinks a'), function (a) {
      a.addEventListener('click', closeNav);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navBar.classList.contains('is-open')) {
        closeNav();
        navToggle.focus();
      }
    });
    /* resizing back to desktop must not leave the panel latched open */
    window.addEventListener('resize', function () {
      if (window.innerWidth > 960) closeNav();
    });
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

  /* ═══════════ pachinko: racquetballs served up the page ═══════════
     One blue racquetball is launched every second from a random angle just
     off the edge of the viewport, arcing up toward the top third of whatever
     is currently on screen, then falling back through the content boxes and
     bouncing off them like pachinko pegs.

     The launch is a real ballistic solve rather than a fixed impulse: given a
     spawn point, a target and the flight time, the velocity that connects
     them falls out of the projectile equations. That is what makes a ball
     spawned low on the screen leave faster — it has further to climb in the
     same time — with no special-casing.

     Balls live in DOCUMENT coordinates, not viewport ones. That means the peg
     rectangles are scroll-invariant (measured on layout instead of every
     frame), balls stay put on the page as you scroll either way, and culling
     is simply "too far outside the visible band".

     There is no adaptive count here: at one ball a second the population
     settles at a handful, which is nowhere near a performance concern. */
  var cv = document.getElementById('pachinko');
  if (cv && !reduced) {
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var balls = [], pegs = [], rows = Object.create(null);
    var raf = null, running = false, stamp = 0;

    var GRAVITY = 0.155;      /* gentle — these are lobbed, not dropped */
    var RESTITUTION = 0.62;   /* racquetballs are lively */
    var WALL_BOUNCE = 0.5;
    var AIR = 0.998;
    var MAX_VY = 11;
    var R_MIN = 6, R_MAX = 10.5;
    var CULL = 700;           /* px outside the viewport before a ball dies */
    var ROW = 260;            /* peg bucket height */

    var rScale = 1;           /* balls shrink on small screens */
    var SPAWN_MS = 1000;      /* one ball a second */
    var HARD_CAP = 60;        /* safety net only; the rate keeps it far below */
    var nextSpawn = 0;

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
      /* a 9px ball reads much bigger on a 390px screen than a 1440px one */
      rScale = W < 620 ? 0.72 : 1;
    }

    /* ── peg rectangles, in document space ──
       Pegs are elements with a VISIBLE edge, and never full-bleed ones:
       anything spanning the whole width (.courtline, .marquee, .foot) would
       dam the balls, pile them up and starve the rest of the page. */
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

    /* Serve one ball in from off-screen, aimed at the top third of the
       viewport. Flight time is fixed per shot, so the further the ball has to
       climb the harder it leaves — a low spawn is automatically a fast one. */
    function launch() {
      var sy = window.scrollY || window.pageYOffset || 0;
      var pad = 40;
      var px, py, side = Math.random();

      if (side < 0.5) {                       /* up from below */
        px = W * (0.08 + Math.random() * 0.84);
        py = sy + H + pad;
      } else if (side < 0.75) {                /* in from the left */
        px = -pad;
        py = sy + H * (0.45 + Math.random() * 0.6);
      } else {                                 /* in from the right */
        px = W + pad;
        py = sy + H * (0.45 + Math.random() * 0.6);
      }

      /* target: roughly the top third of what is on screen right now */
      var tx = W * (0.12 + Math.random() * 0.76);
      var ty = sy + H * (0.08 + Math.random() * 0.26);

      var t = 62 + Math.random() * 34;         /* frames in the air */
      balls.push({
        x: px, y: py,
        vx: (tx - px) / t,
        vy: (ty - py) / t - 0.5 * GRAVITY * t,
        r: (R_MIN + Math.random() * (R_MAX - R_MIN)) * rScale,
        live: 0,      /* set once the ball is actually inside the viewport */
        slow: 0
      });
      if (balls.length > HARD_CAP) balls.splice(0, balls.length - HARD_CAP);
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

    function frame(now) {
      var sy = window.scrollY || window.pageYOffset || 0;
      stamp++;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = .95;

      if (!nextSpawn) nextSpawn = now;
      if (now >= nextSpawn) {
        launch();
        nextSpawn += SPAWN_MS;
        /* if the tab was throttled we may be many intervals behind — resync
           instead of firing one ball per frame until we catch up */
        if (nextSpawn < now) nextSpawn = now + SPAWN_MS;
      }

      for (var i = balls.length - 1; i >= 0; i--) {
        var b = balls[i];

        b.vy += GRAVITY;
        if (b.vy > MAX_VY) b.vy = MAX_VY;
        b.vx *= AIR;
        b.x += b.vx;
        b.y += b.vy;

        /* the side walls only catch a ball once it is actually in play, so a
           shot served in from off-screen is not bounced straight back out */
        if (b.x > b.r && b.x < W - b.r) b.live = 1;
        if (b.live) {
          if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * WALL_BOUNCE; }
          else if (b.x > W - b.r) { b.x = W - b.r; b.vx = -b.vx * WALL_BOUNCE; }
        }

        collide(b);

        /* A ball wedged on a wide box has nothing to damp it, so it would
           jitter in place forever. Recycle anything that stops making
           progress. */
        b.slow = (Math.abs(b.vy) < .4 && Math.abs(b.vx) < .4) ? b.slow + 1 : 0;

        /* far enough off screen, in either direction — or stalled */
        if (b.y > sy + H + CULL || b.y < sy - CULL - 400 ||
            b.x < -600 || b.x > W + 600 || b.slow > 110) {
          balls.splice(i, 1); continue;
        }

        var vy = b.y - sy;
        if (vy > -40 && vy < H + 40) ctx.drawImage(sprite, b.x - b.r, vy - b.r, b.r * 2, b.r * 2);
      }

      raf = requestAnimationFrame(frame);
    }

    function start() { if (!running) { running = true; nextSpawn = 0; raf = requestAnimationFrame(frame); } }
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
