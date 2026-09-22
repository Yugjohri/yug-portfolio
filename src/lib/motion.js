/**
 * Scroll and pointer choreography for the portfolio page.
 *
 * Ported from the original single-file build (Yug Portfolio v3.dc.html) rather
 * than rewritten. The code carries hard-won fixes that are easy to lose in a
 * rewrite: watchdogs for rAF being suspended in hidden tabs, the guard that
 * stops a stale Lenis ticker from freezing GSAP's whole tick loop, and line
 * breaking measured from the browser rather than assumed.
 *
 * React owns markup and state; this owns motion. They meet at mount(),
 * unmount(), and the onOpenDetail / onCloseDetail callbacks.
 */
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

// the ported code reaches for these on window, exactly as the CDN build did
window.gsap = gsap
window.ScrollTrigger = ScrollTrigger
window.Lenis = Lenis

export class PortfolioMotion {
  constructor(props = {}) {
    this.props = props
  }

  mount() {
    this.st = { mx: innerWidth / 2, my: innerHeight / 2, sx: innerWidth / 2, sy: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2, parts: [], lastY: 0 };
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    this.applyProps();
    this.initCanvas();
    this.bindBasics();
    this.initTilt();
    this.initShelf();
    this.loop = this.loop.bind(this);
    this.frame = requestAnimationFrame(this.loop);
    this.preload();
  }
  unmount() {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.watchdog);
    clearTimeout(this.gridSafety);
    (this.offs || []).forEach(f => f());
    if (this.io) this.io.disconnect();
    if (this.io2) this.io2.disconnect();
    document.querySelectorAll('[data-stairs]').forEach(h => { delete h.dataset.built; });
    // React remounts build fresh DOM, so stale triggers would point at detached
    // nodes -- and setupScroll's "already built" check would then skip rebuilding
    if (window.ScrollTrigger) ScrollTrigger.getAll().forEach(t => t.kill());
    if (this.lenisTick && window.gsap) { gsap.ticker.remove(this.lenisTick); if (window.__lenisTick === this.lenisTick) window.__lenisTick = null; }
    if (this.lenis) { this.lenis.isDestroyed = true; this.lenis.destroy(); if (window.__lenis === this.lenis) window.__lenis = null; }
    if (this.mRunner && window.Matter) Matter.Runner.stop(this.mRunner);
  }
  on(t, ev, fn, o) { t.addEventListener(ev, fn, o); (this.offs = this.offs || []).push(() => t.removeEventListener(ev, fn, o)); }

  applyProps() {
    if (this.props.accent) document.documentElement.style.setProperty('--acc', this.props.accent);
    const fx = document.getElementById('fx');
    if (fx) fx.style.display = this.props.cursorFx === false ? 'none' : 'block';
    const ring = document.getElementById('ring');
    if (ring && (this.props.cursorFx === false || !this.fine)) ring.style.display = 'none';
  }

  /* ---- opening sequence (flim.ai-style settle) ---- */
  preload() {
    const num = document.getElementById('pre-num'), bar = document.getElementById('pre-bar');
    const dur = this.props.preloader === false ? 0 : 1400, t0 = performance.now();
    // rAF is suspended in hidden tabs — timer watchdog + visibility escape hatches
    this.watchdog = setTimeout(() => this.enter(), dur + 900);
    this.on(document, 'visibilitychange', () => { if (document.visibilityState === 'visible') this.enter(); });
    if (document.visibilityState === 'hidden') return this.enter();
    const tick = now => {
      const p = Math.min(1, (now - t0) / Math.max(1, dur));
      const ready = !!(window.gsap && window.ScrollTrigger);
      const shown = ready ? p : Math.min(p, .9);
      if (num) num.textContent = String(Math.round(shown * 100)).padStart(2, '0');
      if (bar) bar.style.transform = 'scaleX(' + shown.toFixed(3) + ')';
      if ((p >= 1 && ready) || now - t0 > 6000) return this.enter();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  enter() {
    if (this.entered) return;
    this.entered = true;
    clearTimeout(this.watchdog);
    const pre = document.getElementById('pre'), word = document.getElementById('pre-word');
    const g = window.gsap;
    const flies = Array.from(document.querySelectorAll('[data-fly]')).sort((a, b) => a.dataset.fly - b.dataset.fly);
    // gsap's ticker is suspended in hidden tabs — hide the curtain from a plain timer too
    const kill = () => { if (pre) { pre.style.opacity = '0'; pre.style.display = 'none'; } };
    setTimeout(kill, 1300);
    if (document.visibilityState === 'hidden') { kill(); flies.forEach(f => { f.style.opacity = '1'; f.style.transform = 'none'; }); }
    else if (g && !this.reduced) {
      const tl = g.timeline();
      tl.to(word, { scale: .34, y: -innerHeight * .06, opacity: 0, duration: .9, ease: 'expo.inOut' }, 0)
        .to(pre, { yPercent: -101, duration: 1, ease: 'expo.inOut' }, .34)
        .from(flies, { y: 46, opacity: 0, scale: .965, transformOrigin: 'left bottom', duration: 1.15, stagger: .075, ease: 'expo.out' }, .62)
        .add(() => { pre.style.display = 'none'; }, 1.4);
    } else {
      pre.style.display = 'none';
    }
    this.setupScroll();
    [300, 900, 2000].forEach(t => setTimeout(() => this.setupScroll(), t));
    this.initNotes();
    this.startClock();
    this.layoutShelf(true);
  }

  setupScroll() {
    // live ScrollTriggers are the source of truth: a remount that lost them rebuilds, otherwise no-op
    const ST = window.ScrollTrigger;
    if (!ST) return this.fallbackReveals();
    if (ST.getAll().length) return;
    document.querySelectorAll('[data-stairs]').forEach(h => { delete h.dataset.built; });
    this.initScroll();
    this.initStairs();
    this.initRoleDeck();
    this.initGrid();
    requestAnimationFrame(() => ST.refresh());
  }

  initNotes() {
    const board = document.getElementById('board');
    if (!board) return;
    const notes = Array.from(board.querySelectorAll('[data-note]'));
    if (!notes.length) return;
    let top = 30;
    const place = () => {
      const bw = board.clientWidth, bh = board.clientHeight;
      const w = notes[0].offsetWidth, h = notes[0].offsetHeight;
      if (!bw || !bh || !w || !h) return;
      // two rows, two columns, laid out from measured note size so they can never collide
      const padX = Math.max(14, (bw - w * 2) / 3);
      const gapY = Math.max(16, (bh - h * 2) / 3);
      const jog = [[10, 0], [-12, 8], [-6, -6], [12, 4]];
      notes.forEach((el, i) => {
        const col = i % 2, row = i < 2 ? 0 : 1;
        let x = padX + col * (w + padX) + jog[i][0];
        let y = gapY + row * (h + gapY) + jog[i][1];
        el.style.left = Math.round(Math.max(10, Math.min(bw - w - 10, x))) + 'px';
        el.style.top = Math.round(Math.max(12, Math.min(bh - h - 10, y))) + 'px';
      });
    };
    const tryPlace = () => {
      if (!board.clientWidth || !board.clientHeight || !notes[0].offsetWidth) {
        this._placeRaf = requestAnimationFrame(tryPlace);
        return;
      }
      place();
    };
    tryPlace();
    (this.offs = this.offs || []).push(() => cancelAnimationFrame(this._placeRaf));
    this.on(window, 'resize', place, { passive: true });
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => place());
      ro.observe(board);
      (this.offs = this.offs || []).push(() => ro.disconnect());
    }

    notes.forEach(el => {
      const base = parseFloat((el.style.transform.match(/rotate\((-?[\d.]+)deg\)/) || [, '0'])[1]);
      let id = null, ox = 0, oy = 0, dx = 0, dy = 0, px = 0, py = 0, vx = 0, vy = 0, raf = null;
      const draw = () => {
        el.style.transform = 'perspective(900px) translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)'
          + ' rotateY(' + Math.max(-16, Math.min(16, vx * 1.1)).toFixed(2) + 'deg)'
          + ' rotateX(' + Math.max(-14, Math.min(14, -vy * 0.9)).toFixed(2) + 'deg)'
          + ' rotate(' + (base + Math.max(-9, Math.min(9, vx * .5))).toFixed(2) + 'deg)';
      };
      const spring = () => {
        vx *= .86; vy *= .86;
        draw();
        if (Math.abs(vx) + Math.abs(vy) > .05) raf = requestAnimationFrame(spring);
        else { vx = 0; vy = 0; draw(); raf = null; }
      };
      this.on(el, 'pointerdown', e => {
        id = e.pointerId;
        ox = e.clientX - dx; oy = e.clientY - dy;
        px = e.clientX; py = e.clientY;
        try { el.setPointerCapture(id); } catch (err) {}
        this.dragging = true;
        el.style.zIndex = String(++top);
        el.style.cursor = 'grabbing';
        el.style.transition = 'box-shadow .3s';
        el.style.boxShadow = '0 1px 0 rgba(255,255,255,.5) inset,0 34px 40px -18px rgba(20,19,14,.55),0 5px 8px rgba(20,19,14,.26)';
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        e.preventDefault();
      });
      this.on(el, 'pointermove', e => {
        if (id === null || e.pointerId !== id) return;
        vx = vx * .6 + (e.clientX - px) * .9;
        vy = vy * .6 + (e.clientY - py) * .9;
        px = e.clientX; py = e.clientY;
        dx = e.clientX - ox; dy = e.clientY - oy;
        draw();
        const bb = board.getBoundingClientRect(), r = el.getBoundingClientRect();
        let cx = 0, cy = 0;
        if (r.left < bb.left + 8) cx = bb.left + 8 - r.left;
        if (r.right > bb.right - 8) cx = bb.right - 8 - r.right;
        if (r.top < bb.top + 10) cy = bb.top + 10 - r.top;
        if (r.bottom > bb.bottom - 8) cy = bb.bottom - 8 - r.bottom;
        if (cx || cy) { dx += cx; dy += cy; draw(); }
      });
      const up = () => {
        if (id === null) return;
        id = null;
        this.dragging = false;
        el.style.cursor = 'grab';
        el.style.boxShadow = '';
        if (!raf) raf = requestAnimationFrame(spring);
      };
      this.on(el, 'pointerup', up);
      this.on(el, 'pointercancel', up);
      el._reset = () => {
        dx = 0; dy = 0; vx = 0; vy = 0;
        el.style.transition = 'transform .8s cubic-bezier(.16,1,.3,1)';
        el.style.transform = 'rotate(' + base + 'deg)';
        el.style.zIndex = '';
        setTimeout(() => { el.style.transition = 'box-shadow .3s'; }, 820);
      };
    });

    const reset = document.getElementById('board-reset');
    if (reset) this.on(reset, 'click', () => { top = 30; notes.forEach((n, i) => setTimeout(() => n._reset(), i * 60)); });
  }

  initGrid() {
    const g = window.gsap, ST = window.ScrollTrigger;
    const grid = document.getElementById('tech-grid');
    const stage = document.querySelector('[data-grid-stage]');
    if (!g || !ST || !grid || !stage) return;
    if (this.reduced) { g.set(grid, { scale: 1 }); return; }
    // Reference (Image Grid Scroll Animation): the grid starts zoomed deep into its
    // own centre and the camera pulls back, scrubbed, until the whole thing is in
    // frame. Scaling the one container keeps every hairline gap aligned — scaling
    // tiles individually does not.
    g.fromTo(grid, { scale: 3.4 }, {
      scale: 1, ease: 'none', immediateRender: false,
      scrollTrigger: {
        trigger: stage, start: 'center center', end: '+=110%',
        pin: true, pinSpacing: true, scrub: .7, anticipatePin: 1,
        invalidateOnRefresh: true, refreshPriority: 1
      }
    });
    // no per-column drift: hairline-gap tiles must stay aligned
  }

  initStairs() {
    const g = window.gsap, ST = window.ScrollTrigger;
    const stage = document.querySelector('[data-stairs-stage]');
    const plane = document.querySelector('[data-stairs-plane]');
    const h = document.querySelector('[data-stairs]');
    if (!g || !ST || !stage || !plane || !h || h.dataset.built) return;
    h.dataset.built = '1';

    // Split every text node into word spans *in place*, so the accent span keeps its
    // own styling and nothing is reparented. Words are only ever read, never moved —
    // lines are derived from where the browser actually broke them.
    const words = [];
    const walk = node => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          if (!n.textContent.trim()) return;
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.textContent = part;
            w.style.display = 'inline-block';
            frag.appendChild(w);
            words.push(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(h);
    if (!words.length) return;

    // remember each word's authored colour so the dim state derives from it — the
    // accent phrase must dim to faint accent, not to faint ink
    words.forEach(w => {
      const m = (getComputedStyle(w).color.match(/\d+/g) || [20, 19, 14]);
      w.dataset.lit = 'rgb(' + m[0] + ',' + m[1] + ',' + m[2] + ')';
      w.dataset.dim = 'rgba(' + m[0] + ',' + m[1] + ',' + m[2] + ',0.17)';
    });

    if (this.reduced) {
      plane.style.transform = 'none';
      stage.style.height = 'auto';
      stage.style.overflow = 'visible';
      words.forEach(w => { w.style.color = w.dataset.lit; });
      return;
    }

    let lines = [], startY = 0, endY = 0, lineH = 0;
    const measure = () => {
      const byTop = new Map();
      let min = Infinity;
      words.forEach(w => {
        const t = Math.round(w.offsetTop / 6) * 6;
        if (!byTop.has(t)) byTop.set(t, []);
        byTop.get(t).push(w);
        if (t < min) min = t;
      });
      lines = Array.from(byTop.entries()).sort((a, b) => a[0] - b[0])
        .map(e => ({ top: e[0] - min, words: e[1] }));
      const S = stage.clientHeight, Hh = h.offsetHeight;
      lineH = lines.length > 1 ? (lines[1].top - lines[0].top) : Hh;
      // first line parked low in the frame, last line leaving through the top
      startY = S * 0.30;
      endY = -(Hh - S * 0.24);
    };

    const render = pr => {
      const S = stage.clientHeight, Hh = h.offsetHeight;
      const ty = startY + (endY - startY) * pr;
      h.style.transform = 'translateY(' + ty.toFixed(1) + 'px)';
      // a line lights up once it climbs past the focal threshold, and stays lit
      const focal = S * 0.42;
      lines.forEach(ln => {
        const y = (S - Hh) / 2 + ln.top + lineH / 2 + ty;
        const c = (y < focal) ? 'lit' : 'dim';
        ln.words.forEach(w => {
          const col = w.dataset[c];
          if (w.style.color !== col) w.style.color = col;
        });
      });
    };

    const state = { p: 0 };
    measure();
    render(0);
    g.to(state, {
      p: 1, ease: 'none',
      onUpdate: () => render(state.p),
      scrollTrigger: {
        trigger: stage, start: 'top bottom', end: 'bottom top', scrub: 1,
        invalidateOnRefresh: true,
        onRefresh: () => { measure(); render(state.p); }
      }
    });
  }

  initRoleDeck() {
    const g = window.gsap, ST = window.ScrollTrigger;
    const stage = document.querySelector('[data-roles-stage]');
    const cards = Array.from(document.querySelectorAll('[data-role-card]'));
    if (!g || !ST || !stage || !cards.length) return;

    if (this.reduced) {
      // no depth, no stacking: lay them out as a plain readable column
      stage.style.height = 'auto';
      stage.style.perspective = 'none';
      const deck = document.querySelector('[data-roles-deck]');
      if (deck) { deck.style.position = 'static'; deck.style.transformStyle = 'flat'; }
      cards.forEach(c => {
        c.style.position = 'relative';
        c.style.top = 'auto'; c.style.left = 'auto';
        c.style.transform = 'none';
        c.style.width = '100%';
        c.style.margin = '0 0 clamp(14px,1.6vw,22px)';
      });
      return;
    }

    // Reference (3D Stacked Scroll): cards arrive out of deep Z one at a time, settle
    // square to the camera, then carry on past it as the next one takes over.
    const n = cards.length;
    const render = pr => {
      const P = pr * n;                       // 0 -> n across the pinned range
      cards.forEach((c, i) => {
        const t = P - i;                      // <0 approaching, 0 centred, >0 leaving
        let z, o, ry, rx;
        if (t <= 0) {
          const k = Math.min(1, Math.max(0, (t + 1.05) / 1.05));  // 0 far -> 1 centred
          z = -2100 * (1 - k);
          o = Math.min(1, k * 2.1);
          ry = 15 * (1 - k); rx = 11 * (1 - k);
        } else {
          const k = Math.min(1, t / 1.05);                        // 0 centred -> 1 gone
          z = 780 * k;
          o = 1 - Math.min(1, Math.max(0, (k - 0.42) / 0.58));
          ry = -7 * k; rx = -5 * k;
        }
        c.style.opacity = o.toFixed(3);
        c.style.zIndex = String(100 + Math.round(z / 10));
        c.style.transform = 'translate(-50%,-50%) translateZ(' + z.toFixed(1) +
          'px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      });
    };

    const state = { p: 0 };
    render(0);
    g.to(state, {
      p: 1, ease: 'none',
      onUpdate: () => render(state.p),
      scrollTrigger: {
        trigger: stage, start: 'center center', end: '+=' + (n * 85) + '%',
        pin: true, pinSpacing: true, scrub: .8, anticipatePin: 1,
        invalidateOnRefresh: true, refreshPriority: 2,
        onRefresh: () => render(state.p)
      }
    });
  }

  startClock() {
    const el = document.getElementById('clock');
    if (!el || this.clockTimer) return;
    const tick = () => { el.textContent = new Date().toLocaleTimeString('en-GB', { hour12: false }); };
    tick();
    this.clockTimer = setInterval(tick, 1000);
    (this.offs = this.offs || []).push(() => clearInterval(this.clockTimer));
  }

  initScroll() {
    const g = window.gsap, ST = window.ScrollTrigger;
    if (!g || !ST) return this.fallbackReveals();
    g.registerPlugin(ST);
    if (window.Lenis && this.props.smoothScroll !== false && !this.reduced) {
      // a stale ticker callback whose lenis was destroyed throws every frame and freezes
      // gsap's whole tick loop, so it is guarded and explicitly removed on unmount
      if (window.__lenisTick) { g.ticker.remove(window.__lenisTick); }
      if (window.__lenis) { try { window.__lenis.destroy(); } catch (e) {} }
      this.lenis = new Lenis({ lerp: .085, smoothWheel: true });
      window.__lenis = this.lenis;
      this.lenis.on('scroll', ST.update);
      this.lenisTick = t => { const l = this.lenis; if (l && !l.isDestroyed) { try { l.raf(t * 1000); } catch (e) {} } };
      window.__lenisTick = this.lenisTick;
      g.ticker.add(this.lenisTick);
      g.ticker.lagSmoothing(0);
    }
    this.on(document, 'visibilitychange', () => {
      if (!document.hidden) { g.ticker.wake(); ST.refresh(); }
    });
    const el = document.querySelector('[data-letters]');
    if (el) {
      let chars;
      if (el.dataset.split) {
        chars = Array.from(el.querySelectorAll('span span'));
      } else {
        el.dataset.split = '1';
        const text = el.textContent;
        chars = [];
        el.textContent = '';
        text.split(/(\s+)/).forEach(part => {
          if (/^\s+$/.test(part)) return el.appendChild(document.createTextNode(' '));
          const w = document.createElement('span');
          w.style.display = 'inline-block';
          w.style.whiteSpace = 'nowrap';
          part.split('').forEach(ch => {
            const c = document.createElement('span');
            c.textContent = ch;
            c.style.color = 'rgba(20,19,14,0.16)';
            w.appendChild(c); chars.push(c);
          });
          el.appendChild(w);
        });
      }
      if (this.reduced) chars.forEach(c => c.style.color = '#14130E');
      else if (chars.length) g.to(chars, { color: '#14130E', ease: 'none', stagger: { each: .02 }, scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 45%', scrub: true } });
    }
    document.querySelectorAll('[data-count]').forEach(n => {
      const to = parseFloat(n.dataset.count), pre = n.dataset.countPrefix || '', sfx = n.dataset.countSuffix || '', obj = { v: 0 };
      const final = pre + to.toLocaleString('en-US') + sfx;
      n.textContent = pre + '0' + sfx;
      const write = () => { n.textContent = pre + Math.round(obj.v).toLocaleString('en-US') + sfx; };
      const tw = g.to(obj, { v: to, duration: 1.6, ease: 'power2.out', onUpdate: write, paused: true });
      ST.create({
        trigger: n, start: 'top 88%', once: true,
        onEnter: () => {
          // gsap's ticker sleeps in a hidden tab: show the real number rather than a zero
          if (document.hidden) { n.textContent = final; return; }
          tw.play();
          setTimeout(() => { if (n.textContent !== final) n.textContent = final; }, 2600);
        }
      });
    });
    if (this.props.reveals !== false) {
      document.querySelectorAll('[data-reveal]').forEach(r => g.fromTo(r, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', immediateRender: false, clearProps: 'opacity', scrollTrigger: { trigger: r, start: 'top 94%', once: true } }));
    }
    if (!this.reduced) {

      document.querySelectorAll('[data-sleeve]').forEach((el, i) => {
        // keep the authored lean/jitter: drive it through GSAP so the tween can't flatten it
        const v = { x: parseFloat(el.dataset.jx || '0'), y: 0, rx: 0, rz: parseFloat(el.dataset.jr || '0') };
        g.set(el, { x: v.x, rotation: v.rz, transformOrigin: '50% 100%' });
        g.fromTo(el, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', delay: (i % 3) * .07, immediateRender: false, clearProps: 'opacity', scrollTrigger: { trigger: el.closest('#crate'), start: 'top 94%', once: true } });
        el._rest = v;
      });
    }
  }

  fallbackReveals() {
    if (!window.IntersectionObserver) return;
    const els = Array.from(document.querySelectorAll('[data-reveal]'));
    els.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(26px)'; el.style.transition = 'opacity 1s cubic-bezier(.16,1,.3,1),transform 1.1s cubic-bezier(.16,1,.3,1)'; });
    this.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.style.opacity = '1'; e.target.style.transform = 'none'; this.io.unobserve(e.target); } }), { threshold: .06 });
    els.forEach(el => this.io.observe(el));
  }

  /* ---- record shelf ---- */
  initShelf() {
    this.sleeves = Array.from(document.querySelectorAll('[data-sleeve]'));
    this.sleeves.forEach(s => {
      const face = s.querySelector('[data-face]'), acts = s.querySelector('[data-acts]');
      const lift = on => {
        const v = s._rest || { x: parseFloat(s.dataset.jx || '0'), y: 0, rz: parseFloat(s.dataset.jr || '0') };
        if (window.gsap) {
          gsap.to(s, { x: v.x, rotation: v.rz, y: on ? -26 : 0, scale: on ? 1.015 : 1, duration: on ? .45 : .6, ease: 'expo.out', overwrite: 'auto' });
        } else {
          s.style.transform = (s.dataset.rest || '') + (on ? ' translateY(-26px) scale(1.015)' : '');
        }
        if (face) face.style.boxShadow = on
          ? '0 1px 0 rgba(255,236,208,.26) inset,0 0 0 1px rgba(0,0,0,.5),22px 40px 52px -22px rgba(0,0,0,.9),0 3px 4px rgba(0,0,0,.6)'
          : '0 1px 0 rgba(255,236,208,.16) inset,0 0 0 1px rgba(0,0,0,.55),18px 26px 34px -20px rgba(0,0,0,.85),0 2px 3px rgba(0,0,0,.6)';
        if (acts) { acts.style.opacity = on ? '1' : '0'; acts.style.transform = on ? 'translateY(0)' : 'translateY(10px)'; }
      };
      this.on(s, 'pointerenter', () => { if (this.fine) lift(true); });
      this.on(s, 'pointerleave', () => lift(false));
      this.on(s, 'click', () => this.openDetail(s));
      const open = s.querySelector('[data-open]'), det = s.querySelector('[data-details]');
      if (open) this.on(open, 'click', e => {
        e.stopPropagation();
        const url = s.dataset.repo;
        if (url) window.open(url, '_blank', 'noopener');
        else this.openDetail(s);
      });
      if (det) this.on(det, 'click', e => { e.stopPropagation(); this.openDetail(s); });
    });
    const close = document.getElementById('detail-close'), back = document.getElementById('detail');
    if (close) this.on(close, 'click', () => this.closeDetail());
    if (back) this.on(back, 'click', e => { if (e.target === back) this.closeDetail(); });
    this.on(window, 'keydown', e => { if (e.key === 'Escape') this.closeDetail(); });
  }

  layoutShelf() {}

  /* The case-study modal is a React component now, so the shelf only reports
     intent; React owns the open/closed state and renders from the same data. */
  openDetail(s) {
    const i = this.sleeves ? this.sleeves.indexOf(s) : -1;
    if (i >= 0 && this.props.onOpenDetail) this.props.onOpenDetail(i);
  }

  closeDetail() {
    if (this.props.onCloseDetail) this.props.onCloseDetail();
  }

  /* React calls this when the modal opens/closes so Lenis stops behind it. */
  lockScroll(on) {
    if (!this.lenis) return;
    if (on) this.lenis.stop(); else this.lenis.start();
  }

  initCanvas() {
    const c = document.getElementById('fx');
    if (!c) return;
    this.ctx = c.getContext('2d');
    this.sizeCanvas();
    this.on(window, 'resize', () => this.sizeCanvas(), { passive: true });
  }
  sizeCanvas() {
    const c = document.getElementById('fx');
    if (!c || !this.ctx) return;
    const d = Math.min(2, devicePixelRatio || 1);
    c.width = Math.round(innerWidth * d); c.height = Math.round(innerHeight * d);
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  accentRGB() {
    const v = (getComputedStyle(document.documentElement).getPropertyValue('--acc') || '#D8380F').trim();
    if (this._k === v) return this._rgb;
    let r = 216, g = 56, b = 15;
    if (v[0] === '#') {
      const h = v.length === 4 ? v.slice(1).split('').map(x => x + x).join('') : v.slice(1);
      r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
    }
    this._k = v; this._rgb = [r, g, b];
    return this._rgb;
  }
  bindBasics() {
    this.on(window, 'pointermove', e => {
      const s = this.st;
      s.mx = e.clientX; s.my = e.clientY;
      const ring = document.getElementById('ring');
      if (ring && this.fine) ring.style.opacity = '1';
      if (this.props.cursorFx !== false && !this.reduced) {
        const n = Math.min(2, Math.max(1, Math.round(Math.hypot(e.movementX || 0, e.movementY || 0) / 15)));
        for (let i = 0; i < n; i++) s.parts.push({ x: e.clientX, y: e.clientY, vx: (Math.random() - .5) * .7, vy: (Math.random() - .5) * .7 - .1, r: .7 + Math.random() * 1.8, life: 1 });
        if (s.parts.length > 200) s.parts.splice(0, s.parts.length - 200);
      }
    }, { passive: true });
    document.querySelectorAll('[data-cursor]').forEach(el => {
      this.on(el, 'pointerenter', () => this.ring(true));
      this.on(el, 'pointerleave', () => this.ring(false));
    });
    document.querySelectorAll('[data-magnetic]').forEach(el => {
      this.on(el, 'pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .15).toFixed(2) + 'px,' + ((e.clientY - r.top - r.height / 2) * .2).toFixed(2) + 'px)';
      });
      this.on(el, 'pointerleave', () => { el.style.transform = 'translate(0,0)'; });
    });
  }
  ring(big) {
    const r = document.getElementById('ring');
    if (!r || !this.fine) return;
    const s = big ? 56 : 26;
    r.style.width = r.style.height = s + 'px';
    r.style.margin = (-s / 2) + 'px 0 0 ' + (-s / 2) + 'px';
    r.style.backgroundColor = big ? 'color-mix(in oklab, var(--acc) 14%, transparent)' : 'transparent';
  }
  initTilt() {
    document.querySelectorAll('[data-tilt]').forEach(el => {
      const k = parseFloat(el.dataset.tiltStrength || '8'), glow = el.querySelector('[data-glow]');
      el.style.transition = 'transform .5s cubic-bezier(.16,1,.3,1)';
      this.on(el, 'pointermove', e => {
        if (!this.fine || this.reduced || this.props.tilt === false) return;
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width * 2 - 1, dy = (e.clientY - r.top) / r.height * 2 - 1;
        el.style.transition = 'transform .18s linear';
        el.style.transform = 'perspective(1000px) rotateY(' + (dx * k).toFixed(2) + 'deg) rotateX(' + (-dy * k).toFixed(2) + 'deg) scale(.988)';
        if (glow) {
          glow.style.opacity = '1';
          glow.style.background = 'radial-gradient(320px circle at ' + (e.clientX - r.left) + 'px ' + (e.clientY - r.top) + 'px, color-mix(in oklab, var(--acc) 18%, transparent), transparent 62%)';
        }
      });
      this.on(el, 'pointerleave', () => {
        el.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1)';
        el.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) scale(1)';
        if (glow) glow.style.opacity = '0';
      });
    });
  }

  loop(now) {
    const s = this.st, y = window.scrollY;
    const nav = document.getElementById('nav');
    if (nav) {
      const down = y > s.lastY + 4, up = y < s.lastY - 4;
      if (down && y > 200) { nav.style.transform = 'translateY(-110%)'; nav.style.opacity = '0'; }
      else if (up || y < 130) { nav.style.transform = 'translateY(0)'; nav.style.opacity = '1'; }
      if (down || up) s.lastY = y;
    }
    s.sx += (s.mx - s.sx) * .08; s.sy += (s.my - s.sy) * .08;
    s.rx += (s.mx - s.rx) * .19; s.ry += (s.my - s.ry) * .19;
    const ring = document.getElementById('ring');
    if (ring && this.fine) ring.style.transform = 'translate3d(' + s.rx.toFixed(1) + 'px,' + s.ry.toFixed(1) + 'px,0)';

    if (this.ctx && this.props.cursorFx !== false && !this.reduced) {
      const ctx = this.ctx, W = innerWidth, H = innerHeight, [r, g, b] = this.accentRGB();
      ctx.clearRect(0, 0, W, H);
      const rad = 280 + Math.sin(now / 1500) * 42;
      const grd = ctx.createRadialGradient(s.sx, s.sy, 0, s.sx, s.sy, rad);
      grd.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',0.09)');
      grd.addColorStop(.55, 'rgba(' + r + ',' + g + ',' + b + ',0.03)');
      grd.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(s.sx, s.sy, rad, 0, 6.2832); ctx.fill();
      for (let i = s.parts.length - 1; i >= 0; i--) {
        const p = s.parts[i];
        p.x += p.vx; p.y += p.vy; p.vy -= .004; p.life -= .015;
        if (p.life <= 0) { s.parts.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (p.life * .4).toFixed(3) + ')';
        ctx.arc(p.x, p.y, p.r * p.life, 0, 6.2832); ctx.fill();
      }
    }

    const tick = document.getElementById('ticker');
    if (tick && !this.reduced) {
      const v = this.lenis ? (this.lenis.velocity || 0) : 0;
      // Reference (TickerScroll) integrates velocity rather than tracking it: scroll
      // throws the strip along, it overruns, then drifts home. A proportional offset
      // snapped back the instant scrolling stopped, which read as stiff.
      this._tvv = (this._tvv || 0) * .90 - v * .62;   // impulse + friction
      this._tvx = ((this._tvx || 0) + this._tvv) * .955; // travel + pull home
      const clamped = Math.max(-260, Math.min(260, this._tvx));
      this._tvx = clamped;
      if (!this._tickWrap) {
        const track = tick.firstElementChild;
        if (track) {
          const wrap = document.createElement('div');
          wrap.style.willChange = 'transform';
          track.parentNode.insertBefore(wrap, track);
          wrap.appendChild(track);
          this._tickWrap = wrap;
        }
      }
      if (this._tickWrap) this._tickWrap.style.transform = 'translateX(' + clamped.toFixed(1) + 'px)';
    }

    if (this.physBoxes) this.physBoxes.forEach(b => {
      const p = b.body.position;
      b.el.style.transform = 'translate3d(' + (p.x - b.w / 2).toFixed(1) + 'px,' + (p.y - b.h / 2).toFixed(1) + 'px,0) rotate(' + b.body.angle.toFixed(3) + 'rad)';
    });

    document.querySelectorAll('[data-parallax]').forEach(el => {
      const amt = parseFloat(el.dataset.parallax) || 0;
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const rel = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      el.style.transform = 'translate3d(0,' + (rel * amt).toFixed(2) + 'px,0)';
    });

    this.frame = requestAnimationFrame(this.loop);
  }
}
