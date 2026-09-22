/* ═══════════════════════════════════════════════════════════════
   VANNYDEV — INTERACTION LAYER
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)');
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* Batches scroll work into a single rAF so handlers never stack up */
  function onScroll(fn) {
    let ticking = false;
    const run = () => { fn(); ticking = false; };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(run); }
    }, { passive: true });
    fn();
  }

  /* ─────────────────────────────────────────────
     1. CONSTELLATION PARTICLES
     DPR-aware, pauses off-screen, skipped entirely
     when the visitor asks for reduced motion.
     ───────────────────────────────────────────── */
  function initParticles() {
    const canvas = $('#particles-canvas');
    if (!canvas || reduceMotion.matches) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    const mouse = { x: -9999, y: -9999, active: false };
    let W = 0, H = 0, dpr = 1, particles = [], rafId = null, running = false;
    let inView = true, paused = false;

    const MAX_DIST = 150;
    const cfg = () => {
      const w = window.innerWidth;
      if (w < 600)  return { count: 32, speed: 0.18 };
      if (w < 1024) return { count: 54, speed: 0.22 };
      return { count: 78, speed: 0.26 };
    };

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width;
      H = rect.height;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function make() {
      const { count, speed } = cfg();
      particles = Array.from({ length: count }, () => ({
        x:  Math.random() * W,
        y:  Math.random() * H,
        vx: (Math.random() - 0.5) * speed * 2,
        vy: (Math.random() - 0.5) * speed * 2,
        r:  Math.random() * 1.4 + 1.1
      }));
    }

    function step() {
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        if (mouse.active) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 130 && d > 0.5) { p.vx += (dx / d) * 0.03; p.vy += (dy / d) * 0.03; }
        }
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 1.1) { p.vx *= 0.94; p.vy *= 0.94; }

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        p.x = clamp(p.x, 0, W);
        p.y = clamp(p.y, 0, H);
      }

      /* Links first so dots sit on top of them */
      ctx.lineWidth = 0.7;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > MAX_DIST * MAX_DIST) continue;
          const alpha = (1 - Math.sqrt(d2) / MAX_DIST) * 0.3;
          ctx.strokeStyle = 'rgba(0, 210, 255,' + alpha.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      ctx.fillStyle = 'rgba(180, 235, 255, 0.65)';
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(step);
    }

    function start() { if (!running && inView && !paused) { running = true; rafId = requestAnimationFrame(step); } }
    function stop()  { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; }

    document.addEventListener('vd:pause',  () => { paused = true;  stop();  });
    document.addEventListener('vd:resume', () => { paused = false; start(); });

    resize(); make(); start();

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { resize(); make(); }, 150);
    });

    const hero = $('.hero');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
        inView ? start() : stop();
      }, { threshold: 0 }).observe(hero);
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

    if (hero) {
      hero.addEventListener('pointermove', e => {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
        mouse.active = true;
      }, { passive: true });
      hero.addEventListener('pointerleave', () => { mouse.active = false; mouse.x = mouse.y = -9999; });
    }
  }

  /* ─────────────────────────────────────────────
     2. HERO SPOTLIGHT
     ───────────────────────────────────────────── */
  function initSpotlight() {
    const hero = $('.hero');
    const spot = $('.hero__spotlight');
    if (!hero || !spot || !finePointer.matches) return;

    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      spot.style.setProperty('--mx', ((e.clientX - r.left) / r.width  * 100) + '%');
      spot.style.setProperty('--my', ((e.clientY - r.top)  / r.height * 100) + '%');
    }, { passive: true });
  }

  /* ─────────────────────────────────────────────
     3. ROTATING ROLE (typewriter)
     ───────────────────────────────────────────── */
  function initRoles() {
    const el = $('.hero__role');
    if (!el) return;

    let roles;
    try { roles = JSON.parse(el.dataset.roles || '[]'); } catch (_) { roles = []; }
    if (!roles.length) return;

    if (reduceMotion.matches) { el.textContent = roles[0]; return; }

    let i = 0, char = 0, deleting = false;

    (function tick() {
      const word = roles[i];
      char += deleting ? -1 : 1;
      el.textContent = word.slice(0, char);

      let delay = deleting ? 45 : 85;
      if (!deleting && char === word.length) { delay = 1900; deleting = true; }
      else if (deleting && char === 0)       { deleting = false; i = (i + 1) % roles.length; delay = 350; }

      setTimeout(tick, delay);
    })();
  }

  /* ─────────────────────────────────────────────
     4. MOBILE NAV
     ───────────────────────────────────────────── */
  function initNav() {
    const ham     = $('#hamburger');
    const nav     = $('#nav');
    const overlay = $('#nav-overlay');
    if (!ham || !nav) return;

    const setOpen = open => {
      ham.classList.toggle('open', open);
      nav.classList.toggle('open', open);
      if (overlay) overlay.classList.toggle('open', open);
      document.body.classList.toggle('nav-locked', open);
      ham.setAttribute('aria-expanded', String(open));
    };

    ham.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
    if (overlay) overlay.addEventListener('click', () => setOpen(false));
    $$('a', nav).forEach(a => a.addEventListener('click', () => setOpen(false)));

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); ham.focus(); }
    });

    /* A resize into desktop layout must not leave the body scroll-locked */
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 675 && nav.classList.contains('open')) setOpen(false);
    });
  }

  /* ─────────────────────────────────────────────
     5. HEADER STATE + SCROLL PROGRESS
     ───────────────────────────────────────────── */
  function initScrollChrome() {
    const header = $('#header');
    const bar    = $('#scroll-progress');
    const toTop  = $('#to-top');

    onScroll(() => {
      const y = window.scrollY;

      if (header) header.classList.toggle('scrolled', y > 40);
      if (toTop)  toTop.classList.toggle('show', y > window.innerHeight * 0.7);

      if (bar) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max, 0, 1) : 0) + ')';
      }
    });

    if (toTop) {
      toTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      });
    }
  }

  /* ─────────────────────────────────────────────
     6. ACTIVE NAV LINK
     ───────────────────────────────────────────── */
  function initActiveNav() {
    const links = $$('.nav a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;

    const map = new Map();
    links.forEach(a => {
      const sec = document.getElementById(a.getAttribute('href').slice(1));
      if (sec) map.set(sec, a);
    });

    let current = null;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const link = map.get(e.target);
        if (!link || link === current) return;
        links.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        current = link;
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    map.forEach((_, sec) => io.observe(sec));
  }

  /* ─────────────────────────────────────────────
     7. REVEAL ON SCROLL (staggered)
     ───────────────────────────────────────────── */
  function initReveal() {
    const items = $$('[data-reveal]');
    if (!items.length) return;

    if (!('IntersectionObserver' in window) || reduceMotion.matches) {
      items.forEach(el => el.classList.add('is-visible'));
      return;
    }

    /* Siblings sharing a parent cascade in rather than popping together */
    const groups = new Map();
    items.forEach(el => {
      const key = el.parentElement || document.body;
      const list = groups.get(key) || [];
      list.push(el);
      groups.set(key, list);
    });
    groups.forEach(list => {
      list.forEach((el, i) => {
        if (!el.dataset.delay) el.style.setProperty('--reveal-delay', Math.min(i * 90, 450) + 'ms');
        else el.style.setProperty('--reveal-delay', el.dataset.delay + 'ms');
      });
    });

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach(el => io.observe(el));
  }

  /* ─────────────────────────────────────────────
     8. 3D TILT + CURSOR GLARE
     ───────────────────────────────────────────── */
  function initTilt() {
    if (!finePointer.matches || reduceMotion.matches) return;
    const MAX = 6; // degrees — past ~8 it reads as a gimmick

    $$('[data-tilt]').forEach(card => {
      const glare = $('.project__glare', card);
      let raf = null;

      card.addEventListener('pointermove', e => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          const r  = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          card.style.transform =
            'perspective(1100px) rotateX(' + ((0.5 - py) * MAX).toFixed(2) + 'deg) ' +
            'rotateY(' + ((px - 0.5) * MAX).toFixed(2) + 'deg) translateY(-6px)';
          if (glare) {
            glare.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
            glare.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
          }
          raf = null;
        });
      }, { passive: true });

      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  /* ─────────────────────────────────────────────
     9. MAGNETIC BUTTONS
     ───────────────────────────────────────────── */
  function initMagnetic() {
    if (!finePointer.matches || reduceMotion.matches) return;
    const PULL = 0.28;

    $$('[data-magnetic]').forEach(btn => {
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * PULL;
        const dy = (e.clientY - (r.top + r.height / 2)) * PULL;
        btn.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
      }, { passive: true });

      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }

  /* ─────────────────────────────────────────────
     10. COUNT-UP STATS
     ───────────────────────────────────────────── */
  function initCounters() {
    const nums = $$('[data-count]');
    if (!nums.length) return;

    const render = (el, v) => {
      el.textContent = (el.dataset.prefix || '') + v + (el.dataset.suffix || '');
    };

    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      nums.forEach(el => render(el, el.dataset.count));
      return;
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        io.unobserve(el);

        const target = parseFloat(el.dataset.count);
        const dur = 1400;
        const t0 = performance.now();

        (function frame(now) {
          const p = clamp((now - t0) / dur, 0, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          render(el, Math.round(target * eased));
          if (p < 1) requestAnimationFrame(frame);
        })(t0);
      });
    }, { threshold: 0.6 });

    nums.forEach(el => { render(el, 0); io.observe(el); });
  }

  /* ─────────────────────────────────────────────
     11. LIGHTBOX
     ───────────────────────────────────────────── */
  function initLightbox() {
    const box = $('#lightbox');
    if (!box) return;
    const img     = $('.lightbox__img', box);
    const caption = $('.lightbox__caption', box);
    const closeEl = $('.lightbox__close', box);
    const prevEl  = $('.lightbox__prev', box);
    const nextEl  = $('.lightbox__next', box);
    const countEl = $('.lightbox__count', box);

    let items = [];     // [{src, caption}]
    let index = 0;
    let lastFocus = null;

    /* An element carries either a set (data-gallery) or a single image */
    function itemsFor(el) {
      if (el.dataset.gallery) {
        try {
          const list = JSON.parse(el.dataset.gallery);
          if (Array.isArray(list) && list.length) return list;
        } catch (_) { /* fall through to the single-image form */ }
      }
      return [{ src: el.dataset.lightbox, caption: el.dataset.caption || '' }];
    }

    function render() {
      const it = items[index];
      if (!it) return;
      img.src = it.src;
      img.alt = it.caption || '';
      caption.textContent = it.caption || '';

      const many = items.length > 1;
      box.classList.toggle('has-set', many);
      if (countEl) countEl.textContent = many ? `${index + 1} / ${items.length}` : '';
    }

    const step = dir => {
      if (items.length < 2) return;
      index = (index + dir + items.length) % items.length;   // wraps both ways
      render();
    };

    function open(list, startAt) {
      lastFocus = document.activeElement;
      items = list;
      index = startAt || 0;
      render();
      box.classList.add('open');
      box.setAttribute('aria-hidden', 'false');
      document.body.classList.add('nav-locked');
      closeEl.focus();
    }

    function close() {
      box.classList.remove('open', 'has-set');
      box.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('nav-locked');
      if (lastFocus) lastFocus.focus();
      setTimeout(() => { if (!box.classList.contains('open')) img.src = ''; }, 400);
    }

    $$('[data-lightbox], [data-gallery]').forEach(el => {
      el.addEventListener('click', ev => {
        ev.preventDefault();
        open(itemsFor(el));
      });
      /* Divs need keyboard parity; buttons and links already have it */
      if (el.tagName !== 'A' && el.tagName !== 'BUTTON') {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.addEventListener('keydown', ev => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(itemsFor(el)); }
        });
      }
    });

    closeEl.addEventListener('click', close);
    if (prevEl) prevEl.addEventListener('click', e => { e.stopPropagation(); step(-1); });
    if (nextEl) nextEl.addEventListener('click', e => { e.stopPropagation(); step(1); });

    box.addEventListener('click', e => { if (e.target === box) close(); });

    document.addEventListener('keydown', e => {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape')     close();
      if (e.key === 'ArrowLeft')  step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  }

  /* ─────────────────────────────────────────────
     12. PARALLAX
     One rAF loop for every layer. Positions are cached
     via offsetTop (transform-independent) so a layer's
     own drift never feeds back into its measurement.
     ───────────────────────────────────────────── */
  function initParallax() {
    if (reduceMotion.matches) return;
    const els = $$('[data-px]');
    if (!els.length) return;

    const layers = new Map();
    els.forEach(el => layers.set(el, {
      speed: parseFloat(el.dataset.px) || 0,
      max:   parseFloat(el.dataset.pxMax) || 70,
      top: 0, h: 0, last: NaN, active: false
    }));

    /* offsetTop walks the layout tree and ignores transforms — using
       getBoundingClientRect here would read the element's own offset back. */
    function docTop(el) {
      let y = 0, node = el;
      while (node) { y += node.offsetTop; node = node.offsetParent; }
      return y;
    }

    function measure() {
      layers.forEach((s, el) => { s.top = docTop(el); s.h = el.offsetHeight; });
    }

    /* Phones get half strength: mobile scroll is coarser and the
       collapsing address bar makes big offsets look like stutter. */
    const strength = () => (window.innerWidth < 768 ? 0.5 : 1);

    let ticking = false, paused = false;
    document.addEventListener('vd:pause',  () => { paused = true;  });
    document.addEventListener('vd:resume', () => { paused = false; request(); });

    function update() {
      ticking = false;
      if (paused) return;
      const mid = window.scrollY + window.innerHeight / 2;
      const k = strength();

      layers.forEach((s, el) => {
        if (!s.active) return;
        let y = (mid - (s.top + s.h / 2)) * s.speed * k;
        y = clamp(y, -s.max, s.max);
        if (Math.abs(y - s.last) < 0.4) return;   // skip sub-pixel churn
        s.last = y;
        el.style.setProperty('--px', y.toFixed(1) + 'px');
      });
    }
    function request() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

    /* Only layers near the viewport cost anything per frame */
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          const s = layers.get(e.target);
          if (!s) return;
          s.active = e.isIntersecting;
          e.target.classList.toggle('px-active', e.isIntersecting);
        });
        request();
      }, { rootMargin: '25% 0px 25% 0px' });
      layers.forEach((_, el) => io.observe(el));
    } else {
      layers.forEach(s => { s.active = true; });
    }

    measure();
    request();

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('load', () => { measure(); request(); });

    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { measure(); request(); }, 150);
    }, { passive: true });
  }

  /* ─────────────────────────────────────────────
     13. HERO POINTER DEPTH
     ───────────────────────────────────────────── */
  function initHeroDepth() {
    if (!finePointer.matches || reduceMotion.matches) return;
    const hero = $('.hero');
    if (!hero) return;
    const layers = $$('[data-depth]', hero);
    if (!layers.length) return;

    let raf = null;
    const set = (nx, ny) => layers.forEach(l => {
      const d = parseFloat(l.dataset.depth) || 0;
      l.style.setProperty('--mx-px', (nx * d).toFixed(1) + 'px');
      l.style.setProperty('--my-px', (ny * d).toFixed(1) + 'px');
    });

    hero.addEventListener('pointermove', e => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        set((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
        raf = null;
      });
    }, { passive: true });

    hero.addEventListener('pointerleave', () => set(0, 0));
  }

  /* ─────────────────────────────────────────────
     13b. LIVE DEMO MODAL
     Demo links stay real anchors: only a plain left-click
     is intercepted, so ctrl/cmd/middle-click and no-JS
     still open the project in a new tab.
     ───────────────────────────────────────────── */
  function initDemoModal() {
    const modal = $('#demo-modal');
    if (!modal) return;

    const frame    = $('.demo-modal__frame', modal);
    const titleEl  = $('.demo-modal__title', modal);
    const urlEl    = $('.demo-modal__url', modal);
    const closeBtn = $('.demo-modal__close', modal);
    const openLinks = $$('[data-demo-open]', modal);

    let lastFocus = null;
    let timer = null;

    const prettyUrl = url => {
      try { const u = new URL(url); return u.host + (u.pathname === '/' ? '' : u.pathname); }
      catch (_) { return url; }
    };

    function open(url, title) {
      lastFocus = document.activeElement;

      titleEl.textContent = title || 'Live demo';
      urlEl.textContent = prettyUrl(url);
      openLinks.forEach(a => { a.href = url; });

      modal.classList.remove('is-blocked');
      modal.classList.add('open', 'is-loading');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('nav-locked', 'demo-open');
      /* Quiet the canvas and parallax — the embedded app needs the frame budget */
      document.dispatchEvent(new CustomEvent('vd:pause'));

      frame.src = url;
      closeBtn.focus();

      /* A frame refused by X-Frame-Options can still fire `load`, so a
         timeout is the only reliable signal that nothing is coming. */
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (modal.classList.contains('is-loading')) modal.classList.add('is-blocked');
      }, 8000);
    }

    function close() {
      clearTimeout(timer);
      modal.classList.remove('open', 'is-loading', 'is-blocked');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('nav-locked', 'demo-open');
      document.dispatchEvent(new CustomEvent('vd:resume'));
      if (lastFocus) lastFocus.focus();
      /* Blank the frame so the embedded site stops running in the background */
      setTimeout(() => { if (!modal.classList.contains('open')) frame.src = 'about:blank'; }, 400);
    }

    frame.addEventListener('load', () => {
      if (frame.src === 'about:blank' || !frame.src) return;
      modal.classList.remove('is-loading', 'is-blocked');
      clearTimeout(timer);
    });

    $$('[data-demo]').forEach(link => {
      link.addEventListener('click', e => {
        /* Let the browser handle modified clicks exactly as it normally would */
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        open(link.dataset.demo || link.href, link.dataset.demoTitle || '');
      });
    });

    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });
    /* Opening in a new tab makes the embed redundant */
    openLinks.forEach(a => a.addEventListener('click', close));
  }

  /* ─────────────────────────────────────────────
     14. COPY EMAIL
     ───────────────────────────────────────────── */
  function initCopyEmail() {
    const btn = $('#copy-email');
    if (!btn) return;
    const value = btn.dataset.email || '';
    const label = $('.copy-btn__label', btn) || btn;
    const original = label.textContent;

    const flash = ok => {
      label.textContent = ok ? 'Copied!' : 'Press Ctrl+C';
      btn.classList.toggle('copied', ok);
      setTimeout(() => { label.textContent = original; btn.classList.remove('copied'); }, 2000);
    };

    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(value);
        flash(true);
      } catch (_) {
        /* Clipboard API needs a secure context — fall back to a selection */
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (__) {}
        document.body.removeChild(ta);
        flash(ok);
      }
    });
  }

  /* ─────────────────────────────────────────────
     BOOT
     ───────────────────────────────────────────── */
  function boot() {
    initNav();
    initScrollChrome();
    initActiveNav();
    initReveal();
    initParticles();
    initSpotlight();
    initRoles();
    initTilt();
    initMagnetic();
    initCounters();
    initParallax();
    initHeroDepth();
    initLightbox();
    initDemoModal();
    initCopyEmail();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
