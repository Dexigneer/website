/* VELOR — checkout (demo). Reads the cart saved by main.js. */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const KEYS = ['orange', 'lemon', 'berry', 'tropical', 'green-apple', 'peach'];
  const NAMES = ['Orange', 'Lemon', 'Berry', 'Tropical', 'Green Apple', 'Peach'];
  const imgOf = key => `assets/gel-${key}.webp`;
  const PRODUCTS = Object.fromEntries([
    ...NAMES.map((n, i) => [`gel-${i}`, { name: n, sub: 'Energy gel · 60 ml', price: 3.2 }]),
    ['box', { name: 'Starter box', sub: 'All six flavours · 12 gels', price: 36 }],
  ]);
  const FREE_SHIP = 40, RATES = { standard: 4.9, express: 9.9 };
  const STORE_KEY = 'velor-cart';
  const eur = n => '€' + n.toFixed(2);

  let items = [];
  try { items = (JSON.parse(localStorage.getItem(STORE_KEY)) || []).filter(it => PRODUCTS[it.id] && it.qty > 0); } catch (_) { items = []; }

  const form = $('#coForm');
  const shipMethod = () => (form.querySelector('input[name="ship"]:checked') || {}).value || 'standard';

  function totals() {
    const sub = items.reduce((s, it) => s + it.qty * PRODUCTS[it.id].price, 0);
    const method = shipMethod();
    const ship = method === 'standard' && sub >= FREE_SHIP ? 0 : RATES[method];
    return { sub, ship, total: sub + ship };
  }

  function render() {
    if (!items.length) {
      $('#coGrid').hidden = true; $('#coEmpty').hidden = false;
      return;
    }
    const pic = key => `<img src="${imgOf(key)}" alt="" width="390" height="1100">`;
    $('#coItems').innerHTML = items.map(it => {
      const p = PRODUCTS[it.id];
      return `<li class="ci">
        <div class="ci-img${it.id === 'box' ? ' ci-img--box' : ''}">${it.id === 'box' ? pic('orange') + pic('berry') + pic('tropical') : pic(KEYS[+it.id.split('-')[1]])}<span class="co-qty">${it.qty}</span></div>
        <div class="ci-body">
          <div class="ci-top"><p class="ci-name">${p.name}</p><p class="ci-price">${eur(p.price * it.qty)}</p></div>
          <p class="ci-sub">${p.sub}</p>
        </div>
      </li>`;
    }).join('');
    const t = totals();
    $('#coSubtotal').textContent = eur(t.sub);
    $('#coShipping').textContent = t.ship === 0 ? 'Free' : eur(t.ship);
    $('#coTotal').textContent = eur(t.total);
    $('#coPayPrice').textContent = eur(t.total);
    $('#coShipStd').textContent = t.sub >= FREE_SHIP ? 'Free' : eur(RATES.standard);
  }

  /* ---- input formatting ---- */
  const card = $('#coCard'), exp = $('#coExp'), cvc = $('#coCvc');
  card.addEventListener('input', () => {
    card.value = card.value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
  });
  exp.addEventListener('input', e => {
    let d = exp.value.replace(/\D/g, '').slice(0, 4);
    if (d.length === 1 && +d > 1) d = '0' + d;
    exp.value = d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : (d.length === 2 && e.inputType !== 'deleteContentBackward' ? `${d} / ` : d);
  });
  cvc.addEventListener('input', () => { cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4); });

  /* ---- validation ---- */
  const checks = {
    coCard: v => v.replace(/\s/g, '').length === 16,
    coExp: v => {
      const m = v.match(/^(\d{2}) \/ (\d{2})$/); if (!m) return false;
      const mm = +m[1], yy = +m[2]; if (mm < 1 || mm > 12) return false;
      const now = new Date(), y = now.getFullYear() % 100, mo = now.getMonth() + 1;
      return yy > y || (yy === y && mm >= mo);
    },
    coCvc: v => /^\d{3,4}$/.test(v),
  };
  function validate(input) {
    const ok = checks[input.id] ? checks[input.id](input.value.trim()) : input.checkValidity() && input.value.trim() !== '';
    input.closest('.f')?.classList.toggle('bad', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    return ok;
  }
  $$('input:not([type="radio"])', form).forEach(i => {
    i.addEventListener('blur', () => { if (i.value) validate(i); });
    i.addEventListener('input', () => { if (i.closest('.f')?.classList.contains('bad')) validate(i); });
  });
  $$('input[name="ship"]', form).forEach(r => r.addEventListener('change', render));

  form.addEventListener('submit', e => {
    e.preventDefault();
    const fields = $$('input:not([type="radio"])', form);
    const bad = fields.filter(f => !validate(f));
    if (bad.length) { bad[0].focus(); return; }
    const btn = $('#coPay');
    btn.disabled = true; btn.classList.add('loading');
    $('.btn-label', btn).textContent = 'Processing…';
    setTimeout(() => {
      $('#coOrderNo').textContent = 'VL-' + Math.floor(100000 + Math.random() * 900000);
      $('#coOrderEmail').textContent = $('#coEmail').value.trim();
      try { localStorage.removeItem(STORE_KEY); } catch (_) {}
      items = [];
      $('#coGrid').hidden = true; $('#coDone').hidden = false;
      $('.co-title').hidden = true;
      scrollTo({ top: 0, behavior: 'smooth' });
      $('#coDone a').focus({ preventScroll: true });
    }, 900);
  });

  render();
})();
