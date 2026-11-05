/* VELOR — interactions & scroll choreography (vanilla, no dependencies) */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const FLAVOURS = [
    { name: 'Blood Orange', note: 'Bright, sharp, a little bitter.', sodium: '200 mg', caf: '—' },
    { name: 'Citrus Salt', note: 'Lemon zest and sea salt. Built for heat.', sodium: '400 mg', caf: '—' },
    { name: 'Wild Berry', note: 'Dark fruit, soft finish.', sodium: '200 mg', caf: '—' },
    { name: 'Cola Kick', note: 'Classic cola. For the final 10 km.', sodium: '200 mg', caf: '100 mg' },
    { name: 'Cold Mint', note: 'Cool and clean. Wakes you up.', sodium: '200 mg', caf: '50 mg' },
    { name: 'Pure', note: 'Unflavoured. Nothing but fuel.', sodium: '200 mg', caf: '—' },
  ];
  const IMG = 'assets/velor-gel.webp';

  /* ---------- split headings into masked words ---------- */
  $$('[data-split]').forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`).join(' ');
  });
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .35 });
  $$('[data-split]').forEach(el => { if (!el.classList.contains('hero-title')) io.observe(el); });

  /* ---------- manifesto words ---------- */
  const manifesto = $('#manifesto');
  manifesto.innerHTML = manifesto.textContent.trim().split(/\s+/).map(w => `<span class="mw">${w}</span>`).join(' ');
  const mWords = $$('.mw', manifesto);

  /* ---------- hero packs ---------- */
  const packsEl = $('#packs');
  packsEl.innerHTML = FLAVOURS.map((f, i) => `
    <button class="pack" type="button" style="--i:${i}" data-i="${i}" aria-label="${f.name} — see flavour">
      <span class="pack-body">
        <span class="pack-label"><b>0${i + 1}</b>${f.name}</span>
        <img class="pack-img" src="${IMG}" width="438" height="1391" alt="" draggable="false">
      </span>
    </button>`).join('');
  const packs = $$('.pack', packsEl);
  $$('.hero-grid i').forEach((el, i) => el.style.setProperty('--i', i));

  /* ---------- flavours module ---------- */
  const list = $('#flList');
  list.innerHTML = FLAVOURS.map((f, i) => `
    <li class="fl-item">
      <button class="fl-btn" role="tab" type="button" data-i="${i}" aria-selected="${i === 0}">
        <span class="n">0${i + 1}</span><span class="name">${f.name}</span>${f.caf !== '—' ? '<span class="tag">Caffeine</span>' : ''}
      </button>
    </li>`).join('');
  const tabs = $$('.fl-btn', list);
  const flWord = $('#flWord'), flPack = $('#flPack'), flIndex = $('#flIndex');
  const flName = $('#flName'), flNote = $('#flNote'), flSodium = $('#flSodium'), flCaf = $('#flCaf');
  let current = 0;

  function selectFlavour(i, instant = false) {
    if (i === current && !instant) return;
    const dir = i > current ? 1 : -1;
    current = i;
    const f = FLAVOURS[i];
    tabs.forEach((t, k) => t.setAttribute('aria-selected', k === i));
    // keep the active chip in view on mobile without moving the page
    if (list.scrollWidth > list.clientWidth) {
      const t = tabs[i].parentElement;
      list.scrollTo({ left: t.offsetLeft - (list.clientWidth - t.offsetWidth) / 2, behavior: instant ? 'auto' : 'smooth' });
    }

    // big word rolls through its mask
    const old = flWord.firstElementChild;
    const next = document.createElement('span');
    next.textContent = f.name;
    if (reduce || instant) { flWord.replaceChildren(next); }
    else {
      next.style.position = 'absolute'; next.style.left = '50%'; next.style.top = '0';
      flWord.appendChild(next);
      old.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-100 * dir}%)` }], { duration: 700, easing: 'cubic-bezier(.77,0,.175,1)', fill: 'forwards' });
      next.animate([{ transform: `translate(-50%, ${100 * dir}%)` }, { transform: 'translate(-50%, 0)' }], { duration: 700, easing: 'cubic-bezier(.77,0,.175,1)', fill: 'forwards' })
        .onfinish = () => { next.removeAttribute('style'); next.getAnimations().forEach(a => a.cancel()); flWord.replaceChildren(next); };
    }

    // pack dips out and springs back
    if (!reduce && !instant) {
      flPack.animate([
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
        { transform: `translateY(60px) rotate(${-6 * dir}deg)`, opacity: 0, offset: .38 },
        { transform: `translateY(-30px) rotate(${4 * dir}deg)`, opacity: 0, offset: .42 },
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
      ], { duration: 900, easing: 'cubic-bezier(.23,1,.32,1)' });
    }

    flIndex.textContent = String(i + 1).padStart(2, '0');
    flName.textContent = f.name; flNote.textContent = f.note;
    flSodium.textContent = f.sodium; flCaf.textContent = f.caf;
    [flName, flNote, flSodium, flCaf].forEach(el => { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); });
    flPack.alt = `VELOR energy gel — ${f.name}`;
  }
  tabs.forEach(t => t.addEventListener('click', () => selectFlavour(+t.dataset.i)));
  list.addEventListener('keydown', e => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const n = (current + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + 6) % 6;
    selectFlavour(n); tabs[n].focus();
  });

  /* ---------- smooth programmatic scroll ---------- */
  let scrolling = null;
  function scrollToY(y, dur = 1400) {
    if (reduce) { window.scrollTo(0, y); return; }
    const start = window.scrollY, dist = y - start, t0 = performance.now();
    cancelAnimationFrame(scrolling);
    const step = now => {
      const t = clamp((now - t0) / dur);
      window.scrollTo(0, start + dist * easeIO(t));
      if (t < 1) scrolling = requestAnimationFrame(step);
    };
    scrolling = requestAnimationFrame(step);
    const stop = () => { cancelAnimationFrame(scrolling); removeEventListener('wheel', stop); removeEventListener('touchstart', stop); };
    addEventListener('wheel', stop, { passive: true, once: true });
    addEventListener('touchstart', stop, { passive: true, once: true });
  }
  const topOf = el => el.getBoundingClientRect().top + window.scrollY;
  const flavoursSec = $('#flavours');

  packs.forEach(p => p.addEventListener('click', () => {
    selectFlavour(+p.dataset.i, true);
    scrollToY(topOf(flavoursSec), 1800);
  }));

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const el = id === '#top' ? document.body : $(id);
    if (!el) return;
    e.preventDefault();
    let y = id === '#top' ? 0 : topOf(el);
    if (id === '#shop') y = document.documentElement.scrollHeight - innerHeight;
    if (id === '#formula') y += innerHeight * .9; // land with the aperture already open
    scrollToY(y);
  }));

  /* ---------- cart & toast ---------- */
  const cartCount = $('#cartCount'), toast = $('#toast');
  let cart = 0, toastT;
  function addToCart(n, label) {
    cart += n; cartCount.textContent = cart;
    cartCount.classList.remove('bump'); void cartCount.offsetWidth; cartCount.classList.add('bump');
    toast.textContent = `${label} added`;
    toast.classList.add('show'); clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('show'), 2200);
  }
  $('#flAdd').addEventListener('click', () => addToCart(1, FLAVOURS[current].name));
  $('#boxAdd').addEventListener('click', () => addToCart(12, 'Starter box'));
  $('#news').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#email'), msg = $('#newsMsg');
    msg.textContent = input.checkValidity() && input.value ? 'You’re on the list.' : 'Enter a valid email.';
    if (input.checkValidity() && input.value) input.value = '';
  });

  /* ---------- count-up numbers ---------- */
  const counted = new WeakSet();
  function countUp(el) {
    if (counted.has(el) || reduce) return; counted.add(el);
    const to = +el.dataset.to, t0 = performance.now();
    const tick = now => { const t = clamp((now - t0) / 1100); el.textContent = Math.round(to * easeOut(t)); if (t < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  /* ---------- scroll choreography ---------- */
  const intro = $('#intro'), heroCopy = $('.hero-copy'), heroTrack = $('.hero-track'), blackout = $('#blackout');
  const formula = $('#formula'), aperture = $('#aperture'), track = $('#track'), bar = $('#formulaBar');
  const counts = $$('.count', track), stats = $$('.stat', track);
  const route = $('#route'), routeLine = $('#routeLine'), routeFill = $('.route-fill'), steps = $$('.step');
  const curtain = $('.curtain'), footWord = $$('#footWord span');
  const progress = el => { const r = el.getBoundingClientRect(); return clamp(-r.top / (r.height - innerHeight)); };

  let vw = innerWidth, vh = innerHeight;
  addEventListener('resize', () => { vw = innerWidth; vh = innerHeight; tick(); });

  function tick() {
    /* INTRO: packs sink, black disc rises from them, manifesto lights word by word */
    const p = progress(intro);
    const sinkT = clamp(p / .16);
    packs.forEach((el, i) => {
      const local = clamp((sinkT - Math.abs(i - 2.5) * .06) / .7);
      el.style.setProperty('--sink', `${easeIO(local) * vh * .7}px`);
      el.classList.toggle('sunk', local > .02);
    });
    const copyT = clamp(p / .2);
    heroCopy.style.opacity = 1 - easeOut(copyT);
    heroCopy.style.transform = `translateY(calc(-50% - ${copyT * 60}px)) scale(${1 - copyT * .06})`;
    heroTrack.style.transform = `translate(-50%, -50%) scale(${1 + p * .6})`;

    const discT = easeIO(clamp((p - .05) / .32));
    const R = Math.hypot(vw / 2, vh) * 1.02;
    blackout.style.clipPath = `circle(${(discT * R).toFixed(1)}px at 50% 100%)`;
    blackout.classList.toggle('full', discT > .99);

    const wordsT = clamp((p - .4) / .48);
    const lit = Math.round(wordsT * mWords.length);
    mWords.forEach((w, i) => w.classList.toggle('on', i < lit));

    /* FLAVOURS: rounded white sheet flattens as it lands */
    const fr = flavoursSec.getBoundingClientRect();
    const landT = clamp(1 - fr.top / vh);
    flavoursSec.style.setProperty('--r', `${(1 - easeOut(landT)) * Math.min(vw * .06, 72)}px`);

    /* FORMULA: aperture opens, then the track runs horizontally */
    const q = progress(formula);
    const openT = easeIO(clamp(q / .16));
    const ix = (1 - openT) * 22, iy = (1 - openT) * 18, rr = (1 - openT) * 28;
    aperture.style.clipPath = `inset(${iy}% ${ix}% ${iy}% ${ix}% round ${rr}px)`;
    const runT = clamp((q - .18) / .74);
    const maxX = Math.max(0, track.scrollWidth - vw + vw * .06);
    track.style.transform = `translate3d(${-runT * maxX}px,0,0)`;
    bar.style.transform = `scaleX(${runT})`;
    stats.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      if (r.left < vw * .85 && openT > .9) { const c = $('.count', s); if (c) countUp(c); }
    });

    /* PROTOCOL: draw the course */
    const rr2 = route.getBoundingClientRect();
    const drawT = clamp((vh * .9 - rr2.top) / (vh * .75));
    routeLine.style.setProperty('--draw', 1 - easeOut(drawT));
    routeFill.style.setProperty('--draw', 1 - easeOut(drawT));
    steps.forEach(s => s.classList.toggle('on', drawT >= +s.dataset.at));

    /* FOOTER: wordmark letters rise as the curtain lifts */
    const cr = curtain.getBoundingClientRect();
    const footT = clamp((vh - cr.top) / (cr.height * .9));
    footWord.forEach((l, i) => {
      const t = easeOut(clamp(footT * 1.4 - i * .08));
      l.style.setProperty('--y', `${(1 - t) * 100}%`);
    });
  }

  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { tick(); ticking = false; });
  }, { passive: true });

  /* ---------- load ---------- */
  selectFlavour(0, true);
  tick();
  const start = () => {
    document.documentElement.classList.add('loaded');
    document.body.classList.add('loaded');
    requestAnimationFrame(() => $('.hero-title').classList.add('in'));
    // after the entrance, packs switch to snappy hover transitions
    setTimeout(() => packs.forEach(p => p.classList.add('ready')), 1900);
  };
  const img = new Image(); img.src = IMG;
  (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => requestAnimationFrame(start));
})();
