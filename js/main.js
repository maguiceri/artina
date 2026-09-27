/* ==========================================================================
   Artina Café — intro animada + comportamiento de la página

   Intro, en unidades del escenario (1000 × 760):
     1. El pincel escribe "Artina" (una máscara SVG sigue cada trazo).
     2. Aparece la taza arriba a la derecha.
     3. El pincel vuela, gira y cae dentro de la taza.
     4. Salpicadura de pintura/café, como en el logo.
   Toda la animación es una función pura del tiempo: render(t).
   ========================================================================== */

(() => {
  const body = document.body;
  const stage = document.querySelector('.stage');
  if (!stage) return;

  /* ---------- Geometría (unidades del escenario) ---------- */

  const NAME = { x: 0, y: 300, s: 1000 / 1920 };           // nombre.webp ocupa todo el ancho
  const MOUTH = { cx: 732, cy: 169 };                        // boca de la taza
  const W_H = 760;

  const WRITE_ROT = -94;       // pincel "escribiendo": punta abajo-izquierda, mango arriba-derecha
  const CUP_ROT = 16;          // pincel dentro de la taza, como en el logo
  const APEX = { x: 691, y: -175 };  // punto más alto del vuelo (el pincel entero queda sobre la taza)
  const REST = { x: 691, y: 37 };    // posición final de la punta
  const START = { x: 1180, y: 860 }; // de dónde entra el pincel

  /* ---------- Elementos ---------- */

  const strokes = [...stage.querySelectorAll('.write-strokes path')];
  const nameImgs = [...stage.querySelectorAll('.name-img')];
  const brush = stage.querySelector('.brush');
  const topLayer = stage.querySelector('.layer--top');
  const inCupLayer = stage.querySelector('.layer--in-cup');
  const cupParts = [...stage.querySelectorAll('.cup-part')];
  const liquid = stage.querySelector('.liquid');
  const ripple = stage.querySelector('.ripple');
  const splash = stage.querySelector('.splash');
  const drops = [...stage.querySelectorAll('.drop')];

  /* ---------- Utilidades ---------- */

  const clamp01 = v => Math.min(1, Math.max(0, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIn = t => t * t;
  const easeOutBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const toStage = p => ({ x: NAME.x + p.x * NAME.s, y: NAME.y + p.y * NAME.s });

  /* ---------- Línea de tiempo de la escritura ---------- */

  const lens = strokes.map(p => p.getTotalLength());
  const total = lens.reduce((a, b) => a + b, 0);
  const DRAW_TIME = .85;
  const drawSpeed = total / DRAW_TIME;            // unidades del nombre por segundo
  const liftSpeed = drawSpeed * 3.2;

  strokes.forEach((p, i) => {
    p.style.strokeDasharray = `${lens[i]} ${lens[i] + 1}`;
    p.style.strokeDashoffset = lens[i];
    p.style.visibility = 'hidden';
  });

  // secuencia: [entrada] trazo, levantar, trazo, levantar, ...
  const steps = [];
  let clock = 0;
  const firstPt = toStage(strokes[0].getPointAtLength(0));
  steps.push({ type: 'lift', from: START, to: firstPt, t0: clock, t1: clock += .3, arc: 60 });
  strokes.forEach((p, i) => {
    if (i > 0) {
      const a = toStage(strokes[i - 1].getPointAtLength(lens[i - 1]));
      const b = toStage(p.getPointAtLength(0));
      const d = Math.hypot(b.x - a.x, b.y - a.y) / NAME.s;
      steps.push({ type: 'lift', from: a, to: b, t0: clock, t1: clock += .025 + d / liftSpeed, arc: 14 + d * .02 });
    }
    steps.push({ type: 'draw', i, t0: clock, t1: clock += lens[i] / drawSpeed });
  });

  const W_END = clock;                               // termina de escribir
  const T = {
    cupIn: [W_END - .25, W_END + .35],
    fly:   [W_END + .02, W_END + .62],
    fall:  [W_END + .62, W_END + .82],
  };
  const IMPACT = T.fall[1];
  const DONE = IMPACT + .4;
  const END = IMPACT + 1.1;
  const lastPt = toStage(strokes[strokes.length - 1].getPointAtLength(lens[lens.length - 1]));

  // posición final de las gotas (como en el logo, arriba a la izquierda)
  const DROPS = [
    { x: 606, y: 64, r: -20, d: .0 },
    { x: 632, y: 34, r: -30, d: .06 },
    { x: 578, y: 104, r: -10, d: .1 },
  ];

  /* ---------- Render ---------- */

  let brushInCup = null;
  function placeBrush(x, y, rot, scale = 1) {
    brush.style.left = (x / 10) + '%';
    brush.style.top = (y / W_H * 100) + '%';
    brush.style.transform = `translate(-.66%, -.34%) rotate(${rot}deg) scale(${scale})`;
  }
  function setBrushLayer(inCup) {
    if (inCup === brushInCup) return;
    brushInCup = inCup;
    (inCup ? inCupLayer : topLayer).appendChild(brush);
  }

  function render(t) {
    /* 1 · escritura */
    for (const s of steps) {
      if (s.type === 'draw') {
        const p = strokes[s.i];
        const k = seg(t, s.t0, s.t1);
        p.style.visibility = k > 0 ? 'visible' : 'hidden';
        p.style.strokeDashoffset = lens[s.i] * (1 - easeInOut(k) * 1.0);
      }
    }
    // al final quitamos la máscara para que el nombre quede nítido y completo
    nameImgs.forEach((img, i) => {
      if (t >= W_END + .05) img.removeAttribute('mask');
      else img.setAttribute('mask', `url(#m-${i + 1})`);
    });

    /* 2 · taza */
    const c = seg(t, ...T.cupIn);
    const squash = seg(t, IMPACT, IMPACT + .45);
    const sq = squash > 0 && squash < 1 ? Math.sin(squash * Math.PI) * (1 - squash) * .06 : 0;
    cupParts.forEach(el => {
      el.style.opacity = easeOut(c);
      el.style.transform = `translateY(${(1 - easeOutBack(c)) * 6}%) scale(${lerp(.85, 1, easeOutBack(c)) * (1 + sq * .5)}, ${lerp(.85, 1, easeOutBack(c)) * (1 - sq)})`;
    });

    /* 3 · pincel */
    if (t < W_END) {
      setBrushLayer(false);
      const s = steps.find(s => t < s.t1) || steps[steps.length - 1];
      let x, y, sc = 1, wob = Math.sin(t * 7) * 4;
      if (s.type === 'lift') {
        const k = easeInOut(seg(t, s.t0, s.t1));
        x = lerp(s.from.x, s.to.x, k);
        y = lerp(s.from.y, s.to.y, k) - Math.sin(k * Math.PI) * s.arc;
        sc = 1 + Math.sin(k * Math.PI) * .05;
      } else {
        const k = easeInOut(seg(t, s.t0, s.t1));
        const pt = toStage(strokes[s.i].getPointAtLength(lens[s.i] * k));
        x = pt.x; y = pt.y;
      }
      brush.style.opacity = seg(t, 0, .18);
      placeBrush(x, y, WRITE_ROT + wob, sc);
    } else if (t < T.fly[0]) {
      setBrushLayer(false);
      placeBrush(lastPt.x, lastPt.y, WRITE_ROT);
    } else if (t < T.fall[0]) {
      // vuelo en curva hasta el ápice, girando
      setBrushLayer(false);
      const k = easeInOut(seg(t, ...T.fly));
      const ctrl = { x: 1010, y: -120 };
      const x = (1 - k) * (1 - k) * lastPt.x + 2 * (1 - k) * k * ctrl.x + k * k * APEX.x;
      const y = (1 - k) * (1 - k) * lastPt.y + 2 * (1 - k) * k * ctrl.y + k * k * APEX.y;
      placeBrush(x, y, lerp(WRITE_ROT, CUP_ROT, k), 1 + Math.sin(k * Math.PI) * .08);
    } else {
      // caída dentro de la taza + rebote amortiguado
      setBrushLayer(true);
      const k = easeIn(seg(t, ...T.fall));
      const after = Math.max(0, t - IMPACT);
      const bounce = after > 0 ? Math.sin(after * 22) * Math.exp(-after * 7) * 10 : 0;
      const wob = after > 0 ? Math.sin(after * 16) * Math.exp(-after * 5) * 5 : 0;
      placeBrush(APEX.x, lerp(APEX.y, REST.y, k) + bounce, CUP_ROT + wob);
    }

    /* 4 · salpicadura */
    const sp = seg(t, IMPACT, IMPACT + .55);
    const grow = sp > 0 ? 1 - Math.exp(-sp * 6) * Math.cos(sp * 9) : 0;       // elástico
    splash.style.opacity = sp > 0 ? 1 : 0;
    splash.setAttribute('transform',
      `translate(700 176) scale(${lerp(.4, 1, clamp01(grow * 1.1))} ${grow}) translate(-700 -176)`);
    liquid.style.opacity = easeOut(seg(t, IMPACT - .02, IMPACT + .3)) * .95;
    const rp = seg(t, IMPACT, IMPACT + .9);
    ripple.style.opacity = rp > 0 && rp < 1 ? (1 - rp) * .9 : 0;
    ripple.setAttribute('transform', `translate(${MOUTH.cx} ${MOUTH.cy}) scale(${lerp(.25, 1, easeOut(rp))}) translate(${-MOUTH.cx} ${-MOUTH.cy})`);

    drops.forEach((d, i) => {
      const D = DROPS[i];
      const k = seg(t, IMPACT + D.d, IMPACT + D.d + .5);
      d.style.opacity = k > 0 ? 1 : 0;
      const e = easeOut(k);
      const x = lerp(MOUTH.cx - 40, D.x, e);
      const y = lerp(MOUTH.cy - 10, D.y, e) - Math.sin(k * Math.PI) * 40;
      d.setAttribute('transform', `translate(${x} ${y}) rotate(${D.r}) scale(${lerp(.3, 1, e)})`);
    });

    /* 5 · textos */
    body.classList.toggle('intro-done', t >= DONE);
    if (t >= DONE) body.classList.remove('is-intro');
  }

  /* ---------- Reproducción ---------- */

  let raf = 0;
  let t0 = 0;
  const finish = () => { cancelAnimationFrame(raf); render(END); };

  function play() {
    t0 = performance.now();
    const tick = now => {
      const t = (now - t0) / 1000;
      render(t);
      if (t < END) raf = requestAnimationFrame(tick);
    };
    render(0);
    raf = requestAnimationFrame(tick);
  }

  document.querySelector('.skip-intro')?.addEventListener('click', finish);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ?t=3.2 congela la intro en ese segundo (útil para ajustar la animación)
  const seek = new URLSearchParams(location.search).get('t');

  const start = () => {
    if (seek !== null) render(parseFloat(seek));
    else if (reduce) finish();
    else play();
  };

  // esperamos a que carguen las imágenes del escenario para que no haya saltos
  const imgs = [...stage.querySelectorAll('img')];
  Promise.all(imgs.map(img => img.complete ? 0 : new Promise(r => { img.onload = img.onerror = r; })))
    .then(() => document.fonts?.ready)
    .then(start);
})();

/* ---------- Nav ---------- */
(() => {
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav__toggle');
  const links = document.getElementById('nav-links');

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', open);
    links.classList.toggle('is-open', open);
  });
  links.addEventListener('click', e => {
    if (e.target.closest('a')) {
      toggle.setAttribute('aria-expanded', 'false');
      links.classList.remove('is-open');
    }
  });
})();

/* ---------- Revelado al hacer scroll ---------- */
(() => {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px' });
  items.forEach(el => io.observe(el));

  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();

/* ---------- Carrusel de comida (autoloop, la del frente se agranda) ---------- */
(() => {
  const root = document.querySelector('.carousel');
  if (!root) return;
  const slides = [...root.querySelectorAll('.slide')];
  const dotsWrap = root.querySelector('.carousel__dots');
  const n = slides.length;
  const INTERVAL = 2600;
  let active = 0;
  let timer = 0;

  const dots = slides.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', s.querySelector('figcaption').textContent);
    b.addEventListener('click', () => { go(i); restart(); });
    dotsWrap.appendChild(b);
    return b;
  });

  function layout() {
    slides.forEach((s, i) => {
      // posición relativa a la activa, en el rango [-n/2, n/2)
      let o = ((i - active) % n + n) % n;
      if (o >= n / 2) o -= n;
      const abs = Math.abs(o);
      const scale = abs === 0 ? 1 : abs === 1 ? .72 : .5;
      const x = o * 88;                                    // % del ancho de una tarjeta
      s.style.transform = `translateX(calc(-50% + ${x}%)) translateY(${abs ? 9 : 0}%) scale(${scale})`;
      s.style.zIndex = 10 - abs;
      s.style.opacity = abs > 1 ? 0 : abs === 1 ? .75 : 1;
      s.style.filter = abs ? 'saturate(.8) brightness(.97)' : 'none';
      s.style.pointerEvents = abs > 1 ? 'none' : '';
      s.classList.toggle('is-active', o === 0);
      s.setAttribute('aria-hidden', o !== 0);
      dots[i].setAttribute('aria-selected', o === 0);
    });
  }

  const go = i => { active = (i + n) % n; layout(); };
  const stop = () => clearInterval(timer);
  const restart = () => { stop(); timer = setInterval(() => go(active + 1), INTERVAL); };

  root.querySelectorAll('.carousel__btn').forEach(b =>
    b.addEventListener('click', () => { go(active + Number(b.dataset.dir)); restart(); }));
  slides.forEach((s, i) => s.addEventListener('click', () => { if (i !== active) { go(i); restart(); } }));


  // swipe en celular
  let x0 = null;
  root.addEventListener('pointerdown', e => { x0 = e.clientX; });
  root.addEventListener('pointerup', e => {
    if (x0 === null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) { go(active + (dx < 0 ? 1 : -1)); restart(); }
  });

  // sólo corre cuando el carrusel está en pantalla
  new IntersectionObserver(([e]) => e.isIntersecting ? restart() : stop()).observe(root);
  layout();
})();
