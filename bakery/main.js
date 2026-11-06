/* Proofhouse — interactions
   Lenis smooth scroll + GSAP ScrollTrigger scenes.
   Everything works without the animation layer; motion is an enhancement. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const animate = hasGsap && !reduced;
  if (reduced) root.classList.add('reduced');

  /* ------------------------------------------------------------------
     Time in Bratislava — highlights today's opening hours.
     ------------------------------------------------------------------ */
  const DAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const HOURS = { 1: [420, 1140], 2: [420, 1140], 3: [420, 1140], 4: [420, 1140], 5: [420, 1140], 6: [450, 840] };
  const fmtParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bratislava', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  function now() {
    const p = Object.fromEntries(fmtParts.formatToParts(new Date()).map(x => [x.type, x.value]));
    const h = parseInt(p.hour, 10) % 24, m = parseInt(p.minute, 10);
    return { day: DAYS[p.weekday], min: h * 60 + m, label: `${h}:${String(m).padStart(2, '0')}` };
  }
  const hm = min => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

  function nextOpening(t) {
    for (let i = 0; i < 8; i++) {
      const d = (t.day + i) % 7, o = HOURS[d];
      if (!o) continue;
      if (i === 0 && t.min >= o[0]) continue;
      const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `${i === 0 ? 'today' : i === 1 ? 'tomorrow' : names[d]} at ${hm(o[0])}`;
    }
    return '';
  }

  function renderStatus() {
    const t = now();
    $$('[data-hours-table] > div').forEach(row => {
      row.classList.toggle('is-today', row.dataset.days.split(',').map(Number).includes(t.day));
    });
    const nowEl = $('[data-now]');
    if (nowEl) nowEl.textContent = t.label;
  }

  renderStatus();
  setInterval(renderStatus, 30000);

  /* ------------------------------------------------------------------
     Smooth scroll
     ------------------------------------------------------------------ */
  let lenis = null;
  if (animate && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', window.ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  function scrollToEl(target) {
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4, easing: t => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  }
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#' ) { e.preventDefault(); return; }
      const target = id === '#top' ? document.body : $(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      if (id === '#top' && lenis) lenis.scrollTo(0, { duration: 1.6 });
      else scrollToEl(target);
    });
  });

  /* ------------------------------------------------------------------
     Nav: solid after scroll, hides on the way down, dark over dark
     ------------------------------------------------------------------ */
  const nav = $('#nav');
  let lastY = 0;
  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 24);
    const menuOpen = $('#menu').classList.contains('is-open');
    nav.classList.toggle('is-hidden', !menuOpen && y > window.innerHeight * 0.9 && y > lastY + 2);
    if (y < lastY - 2) nav.classList.remove('is-hidden');
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ------------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------------ */
  const menu = $('#menu');
  const menuBtn = $('[data-menu-btn]');
  function openMenu() {
    menu.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
    menuBtn.setAttribute('aria-expanded', 'true');
    nav.classList.add('is-dark-menu');
    nav.style.color = 'var(--on-dark)';
    lenis && lenis.stop();
  }
  function closeMenu() {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    nav.style.color = '';
    lenis && lenis.start();
    setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 700);
  }
  menuBtn.addEventListener('click', () => (menu.classList.contains('is-open') ? closeMenu() : openMenu()));

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* ------------------------------------------------------------------
     GSAP scenes
     ------------------------------------------------------------------ */
  if (!animate) { root.classList.add('ready'); onScroll(); return; }

  gsap.registerPlugin(ScrollTrigger);
  const mm = gsap.matchMedia();

  // 1 · Intro — the loaf rises, words lift out of their lines
  root.classList.add('ready');
  const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
  intro
    .from('[data-word]', { yPercent: 115, duration: 1.5, stagger: .1 }, .1)
    .from('[data-loaf]', { yPercent: 38, duration: 2.2, ease: 'expo.out' }, 0)
    .from('.loaf-spin', { rotate: -80, duration: 2.4, ease: 'expo.out' }, 0)
    .from('[data-intro]', { y: 18, opacity: 0, duration: 1.2, stagger: .08, clearProps: 'transform,opacity' }, .45)
    .from('.nav', { y: -20, opacity: 0, duration: 1, clearProps: 'transform,opacity' }, .6);

  // 1 → 2 · The loaf finishes rising: hero holds while the bread climbs into full view
  gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: () => '+=' + Math.round(window.innerHeight * .8), scrub: .5, pin: true, anticipatePin: 1 } })
    .to('.hero-loaf', { yPercent: -50, ease: 'none' }, 0)
    .to('[data-loaf]', { scale: .78, ease: 'none' }, 0)
    .to('.loaf-spin', { rotate: 90, ease: 'none' }, 0)
    .to('.hero-copy', { yPercent: -6, ease: 'none' }, 0);

  // 2 · The recipe is weighed out: bars draw in, numbers count up
  const scale = $('[data-scale]');
  if (scale) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: scale, start: 'top 85%', once: true } });
    tl.from('.ing-bar', { scaleX: 0, duration: 1.1, ease: 'expo.out', stagger: .1 }, 0);
    $$('[data-to]', scale).forEach((el, i) => {
      const to = +el.dataset.to, o = { v: 0 };
      el.textContent = '0';
      tl.to(o, { v: to, duration: .9, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v); } }, i * .1);
    });
  }

  const pin = $('.proces-pin');

  // 3 · Dough becomes bread — pinned, the clock runs to 48 h
  const stages = $$('[data-stage]'), steps = $$('[data-step]'), hrs = $('[data-hours]'), ring = $('[data-ring]');
  const RING = 603.2;
  ring.style.strokeDashoffset = RING;
  let lastStage = -1;
  const proces = gsap.timeline({
    scrollTrigger: {
      trigger: pin, start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 2.4), pin: true, scrub: .6, anticipatePin: 1,
      onUpdate: self => {
        const p = self.progress;
        hrs.textContent = String(Math.round(p * 48)).padStart(2, '0');
        ring.style.strokeDashoffset = RING * (1 - p);
        const s = p < .36 ? 0 : p < .74 ? 1 : 2;
        if (s !== lastStage) {
          lastStage = s;
          stages.forEach((im, i) => im.classList.toggle('is-on', i === s));
          steps.forEach((li, i) => { li.classList.toggle('is-on', i <= s); li.classList.toggle('is-current', i === s); });
        }
      },
    },
  });
  proces
    .fromTo('.proces-stage .stage-img', { rotate: -20 }, { rotate: 70, ease: 'none', duration: 1 }, 0)
    .fromTo('.proces-stage .stage-img', { scale: .9 }, { scale: 1.04, ease: 'none', duration: 1 }, 0);

  // Nav turns light over dark rooms
  ScrollTrigger.create({ trigger: '.foot', start: 'top 40px', end: 'bottom top', toggleClass: { targets: nav, className: 'is-dark' } });

  // 3 → 4 · A crust-shaped edge rises over the oven and settles flat
  gsap.fromTo('[data-crust]', { scaleY: 1 }, {
    scaleY: 0, ease: 'none',
    scrollTrigger: { trigger: '.pult', start: 'top bottom', end: 'top 20%', scrub: true },
  });

  // 4 · Cards land on the counter
  ScrollTrigger.batch('.card', {
    start: 'top 92%', once: true,
    onEnter: els => gsap.from(els, { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .09 }),
  });
  ScrollTrigger.batch('.card-media img', {
    start: 'top 92%', once: true,
    onEnter: els => gsap.from(els, { rotate: -35, scale: .86, duration: 1.6, ease: 'expo.out', stagger: .09 }),
  });

  gsap.from('.visit-grid > *', { y: 30, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: '.visit-grid', start: 'top 88%', once: true } });

  mm.add('(max-width: 860px)', () => {
    // smaller travel on phones
    ScrollTrigger.refresh();
  });

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
  onScroll();
})();
