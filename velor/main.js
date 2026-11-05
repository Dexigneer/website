/* VELOR — interactions & scroll choreography (vanilla, no dependencies) */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const FLAVOURS = [
    { key: 'orange', name: 'Orange', note: 'Bright and juicy, with a little zest.', sodium: '200 mg', caf: '—' },
    { key: 'lemon', name: 'Lemon', note: 'Sharp citrus with sea salt. Built for heat.', sodium: '400 mg', caf: '—' },
    { key: 'berry', name: 'Berry', note: 'Dark fruit with a caffeine kick.', sodium: '200 mg', caf: '100 mg' },
    { key: 'tropical', name: 'Tropical', note: 'Mango and pineapple. Soft and sweet.', sodium: '200 mg', caf: '—' },
    { key: 'green-apple', name: 'Green Apple', note: 'Crisp and clean. Wakes you up.', sodium: '200 mg', caf: '50 mg' },
    { key: 'peach', name: 'Peach', note: 'Mellow and easy on the stomach.', sodium: '200 mg', caf: '—' },
  ];
  const imgOf = key => `assets/gel-${key}.webp`;
  const IMG_W = 390, IMG_H = 1100;

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
  manifesto.innerHTML = manifesto.textContent.trim().split(/[ \t\n\r]+/).map(w => `<span class="mw">${w}</span>`).join(' ');
  const mWords = $$('.mw', manifesto);

  /* ---------- hero packs ---------- */
  const packsEl = $('#packs');
  packsEl.innerHTML = FLAVOURS.map((f, i) => `
    <button class="pack" type="button" style="--i:${i}" data-i="${i}" aria-label="${f.name} — see flavour">
      <span class="pack-body">
        <img class="pack-img" src="${imgOf(f.key)}" width="${IMG_W}" height="${IMG_H}" alt="" draggable="false">
      </span>
    </button>`).join('');
  const packs = $$('.pack', packsEl);

  /* ---------- flavours module ---------- */
  const list = $('#flList');
  list.innerHTML = FLAVOURS.map((f, i) => `
    <li class="fl-item">
      <button class="fl-btn" role="tab" type="button" data-i="${i}" aria-selected="${i === 0}">
        <span class="name">${f.name}</span>${f.caf !== '—' ? '<span class="tag">Caffeine</span>' : ''}
      </button>
    </li>`).join('');
  const tabs = $$('.fl-btn', list);
  const flPack = $('#flPack');
  // packs live in a floating wrapper so two of them can overlap during a swap
  const flFloat = document.createElement('div');
  flFloat.className = 'fl-float';
  flPack.before(flFloat); flFloat.append(flPack);
  let swapToken = 0;
  function swapPack(src, alt, dir, instant) {
    const token = ++swapToken;
    const shown = flFloat.lastElementChild;
    if (instant || reduce) {
      [...flFloat.children].forEach(n => { if (n !== shown) n.remove(); });
      shown.getAnimations().forEach(a => a.cancel());
      shown.src = src; shown.alt = alt;
      return;
    }
    const next = shown.cloneNode();
    next.removeAttribute('id'); next.src = src; next.alt = alt; next.style.opacity = '0';
    flFloat.append(next);
    const ready = next.decode ? next.decode().catch(() => {}) : Promise.resolve();
    ready.then(() => {
      if (token !== swapToken) { next.remove(); return; }
      const D = 820, E = 'cubic-bezier(.65, 0, .35, 1)';
      const old = [...flFloat.children].filter(n => n !== next);
      // the new pack fills in from the bottom over the old one: no overlap, no ghosting
      next.classList.add('fl-filling');
      next.style.opacity = '';
      next.animate([
        { maskPosition: '0 0%', webkitMaskPosition: '0 0%' },
        { maskPosition: '0 100%', webkitMaskPosition: '0 100%' },
      ], { duration: D, easing: E }).onfinish = () => {
        next.classList.remove('fl-filling');
        if (token === swapToken) old.forEach(n => n.remove());
      };
      // a tiny settle so the pack feels touched, not just recoloured
      flFloat.animate([
        { transform: 'scale(1)' }, { transform: 'scale(.985)', offset: .45 }, { transform: 'scale(1)' },
      ], { duration: D, easing: 'ease-in-out' });
    });
  }
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

    // cross-fade to the new pack (see swapPack)
    swapPack(imgOf(f.key), `VELOR energy gel — ${f.name}`, dir, instant);

    flName.textContent = f.name; flNote.textContent = f.note;
    flSodium.textContent = f.sodium; flCaf.textContent = f.caf;
    [flName, flNote, flSodium, flCaf].forEach(el => { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); });
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
    if (a.hasAttribute('data-close-cart')) closeCart(false);
    const el = id === '#top' ? document.body : $(id);
    if (!el) return;
    e.preventDefault();
    let y = id === '#top' ? 0 : topOf(el);
    if (id === '#shop') y = document.documentElement.scrollHeight - innerHeight;
    scrollToY(y);
  }));

  /* ---------- cart ---------- */
  const PRODUCTS = Object.fromEntries([
    ...FLAVOURS.map((f, i) => [`gel-${i}`, { name: f.name, sub: 'Energy gel · 60 ml', price: 3.2 }]),
    ['box', { name: 'Starter box', sub: 'All six flavours · 12 gels', price: 36 }],
  ]);
  const FREE_SHIP = 40, SHIP = 4.9, MAX_QTY = 99;
  const eur = n => '€' + n.toFixed(2);
  const STORE_KEY = 'velor-cart';
  const load = raw => { try { return (JSON.parse(raw) || []).filter(it => PRODUCTS[it.id] && it.qty > 0); } catch (_) { return []; } };
  let items = [];
  try { items = load(localStorage.getItem(STORE_KEY)); } catch (_) { items = []; }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(items)); } catch (_) {} };

  const cartEl = $('#cart'), scrim = $('#cartScrim'), cartItems = $('#cartItems');
  const cartCount = $('#cartCount'), toast = $('#toast');
  let toastT, lastFocus = null;

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show'); clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function renderCart() {
    const qty = items.reduce((s, it) => s + it.qty, 0);
    const sub = items.reduce((s, it) => s + it.qty * PRODUCTS[it.id].price, 0);
    const ship = qty === 0 || sub >= FREE_SHIP ? 0 : SHIP;
    cartCount.textContent = qty;
    $('#cartOpen').setAttribute('aria-label', `Cart, ${qty} item${qty === 1 ? '' : 's'}`);
    $('#cartHeadCount').textContent = qty;
    $('#cartSubtotal').textContent = eur(sub);
    $('#cartShipping').textContent = qty === 0 ? '—' : ship === 0 ? 'Free' : eur(ship);
    $('#cartTotal').textContent = eur(sub + ship);
    $('#cartCheckoutPrice').textContent = eur(sub + ship);
    const left = FREE_SHIP - sub;
    $('#cartShipText').textContent = left > 0 ? `${eur(left)} away from free shipping` : 'Free shipping unlocked';
    $('#cartShipBar').style.transform = `scaleX(${clamp(sub / FREE_SHIP)})`;
    const empty = qty === 0;
    $('#cartEmpty').hidden = !empty;
    $('#cartFoot').hidden = empty;
    $('#cartShip').hidden = empty;
    const pic = key => `<img src="${imgOf(key)}" alt="" width="${IMG_W}" height="${IMG_H}">`;
    cartItems.innerHTML = items.map(it => {
      const p = PRODUCTS[it.id];
      return `<li class="ci" data-id="${it.id}">
        <div class="ci-img${it.id === 'box' ? ' ci-img--box' : ''}">${it.id === 'box' ? pic('orange') + pic('berry') + pic('tropical') : pic(FLAVOURS[+it.id.split('-')[1]].key)}</div>
        <div class="ci-body">
          <div class="ci-top"><p class="ci-name">${p.name}</p><p class="ci-price">${eur(p.price * it.qty)}</p></div>
          <p class="ci-sub">${p.sub}</p>
          <div class="ci-bottom">
            <div class="qty" role="group" aria-label="Quantity of ${p.name}">
              <button type="button" data-act="dec" aria-label="Decrease quantity">−</button>
              <span>${it.qty}</span>
              <button type="button" data-act="inc" aria-label="Increase quantity"${it.qty >= MAX_QTY ? ' disabled' : ''}>+</button>
            </div>
            <button type="button" class="ci-remove" data-act="remove">Remove</button>
          </div>
        </div>
      </li>`;
    }).join('');
  }

  function bump() { cartCount.classList.remove('bump'); void cartCount.offsetWidth; cartCount.classList.add('bump'); }

  function addToCart(id, n = 1) {
    const it = items.find(x => x.id === id);
    if (it) it.qty = Math.min(MAX_QTY, it.qty + n); else items.push({ id, qty: n });
    save(); renderCart(); bump();
    showToast(`${PRODUCTS[id].name} added to cart`);
  }

  cartItems.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]'); if (!btn) return;
    const id = btn.closest('.ci').dataset.id, act = btn.dataset.act;
    const it = items.find(x => x.id === id); if (!it) return;
    if (act === 'inc') it.qty = Math.min(MAX_QTY, it.qty + 1);
    if (act === 'dec') it.qty -= 1;
    if (act === 'remove' || it.qty <= 0) items = items.filter(x => x !== it);
    save(); renderCart();
    const again = $(`.ci[data-id="${id}"] [data-act="${act}"]`, cartItems);
    (again && !again.disabled ? again : $('#cartClose')).focus({ preventScroll: true });
  });

  const isOpen = () => cartEl.classList.contains('open');
  function openCart() {
    if (isOpen()) return;
    lastFocus = document.activeElement;
    scrim.hidden = false; cartEl.inert = false; cartEl.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('cart-lock');
    requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add('open'); cartEl.classList.add('open'); }));
    setTimeout(() => $('#cartClose').focus({ preventScroll: true }), 60);
  }
  function closeCart(restoreFocus = true) {
    if (!isOpen()) return;
    scrim.classList.remove('open'); cartEl.classList.remove('open');
    cartEl.inert = true; cartEl.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('cart-lock');
    setTimeout(() => { if (!isOpen()) scrim.hidden = true; }, 500);
    if (restoreFocus) lastFocus?.focus?.({ preventScroll: true });
  }
  $('#cartOpen').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', () => closeCart());
  scrim.addEventListener('click', () => closeCart());
  addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { closeCart(); return; }
    if (e.key === 'Tab') { // keep focus inside the drawer
      const f = $$('button:not([disabled]), a[href]', cartEl).filter(el => el.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  addEventListener('storage', e => { if (e.key === STORE_KEY) { items = load(e.newValue); renderCart(); } });

  $('#flAdd').addEventListener('click', () => addToCart(`gel-${current}`));
  $('#boxAdd').addEventListener('click', () => { addToCart('box'); openCart(); });
  renderCart();
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
  const intro = $('#intro'), heroCopy = $('.hero-copy'), blackout = $('#blackout');
  const formula = $('#formula'), panel = $('#formulaPanel'), track = $('#track');
  const counts = $$('.count', track), stats = $$('.stat', track);
  const route = $('#route'), routeLine = $('#routeLine'), routeFill = $('.route-fill'), steps = $$('.step');
  const navEl = $('#nav'), footEl = $('#shop');
  const mqMobile = matchMedia('(max-width: 760px)');
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
    heroCopy.style.transform = `translateY(calc(${mqMobile.matches ? '0%' : '-50%'} - ${copyT * 60}px)) scale(${1 - copyT * .06})`;

    const discT = easeIO(clamp((p - .05) / .32));
    const R = Math.hypot(vw / 2, vh) * 1.02;
    blackout.style.clipPath = `circle(${(discT * R).toFixed(1)}px at 50% 100%)`;
    blackout.classList.toggle('full', discT > .99);

    /* NAV: dark bar while it sits over a black section */
    const navY = navEl.offsetHeight / 2;
    const over = el => { const r = el.getBoundingClientRect(); return r.top <= navY && r.bottom >= navY; };
    const onDisc = over(intro) && discT * R >= Math.hypot(vw / 2, vh - navY);
    navEl.classList.toggle('nav--dark', onDisc || over(formula) || over(footEl));

    const wordsT = clamp((p - .4) / .48);
    const lit = Math.round(wordsT * mWords.length);
    mWords.forEach((w, i) => w.classList.toggle('on', i < lit));

    /* FLAVOURS: rounded white sheet flattens as it lands */
    const fr = flavoursSec.getBoundingClientRect();
    const landT = clamp(1 - fr.top / vh);
    flavoursSec.style.setProperty('--r', `${(1 - easeOut(landT)) * Math.min(vw * .06, 72)}px`);

    /* FORMULA: numbers rise in once and count up */
    if (track.getBoundingClientRect().top < vh * .85) panel.classList.add('in');
    if (panel.classList.contains('in')) stats.forEach(s => {
      if (s.getBoundingClientRect().top < vh * .9) { const c = $('.count', s); if (c) countUp(c); }
    });

    /* PROTOCOL: draw the course */
    const rr2 = route.getBoundingClientRect();
    const drawT = clamp((vh * .9 - rr2.top) / (vh * .75));
    routeLine.style.setProperty('--draw', 1 - easeOut(drawT));
    routeFill.style.setProperty('--draw', 1 - easeOut(drawT));
    steps.forEach(s => s.classList.toggle('on', drawT >= +s.dataset.at));

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
  // warm every flavour picture; start once the hero packs are decoded
  FLAVOURS.forEach(f => { const im = new Image(); im.src = imgOf(f.key); });
  const img = $('.pack-img');
  (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => requestAnimationFrame(start));
})();
