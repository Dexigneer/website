#!/usr/bin/env node
/*
 * VELOR — looping portfolio showcase video.
 *
 * Renders the site frame by frame with Playwright + Chromium under a fake,
 * paused clock, so every animation runs at its real speed regardless of how
 * slow the screenshots are. Then encodes MP4 (H.264) and WebM (VP9) with
 * ffmpeg, crossfading the end into the start for a seamless loop.
 *
 *   node tools/showcase-video.js [outDir]
 *
 * Everything you may want to change lives in CONFIG below.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ───────────────────────────── CONFIG ─────────────────────────────
const CONFIG = {
  siteRoot: path.resolve(__dirname, '..'),     // folder served over http
  page: 'index.html',
  outDir: process.argv[2] || path.resolve(__dirname, '..', 'showcase-out'),
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  fps: 60,
  ticks: [17, 17, 16],                          // integer ms per frame, sums to 50ms / 3 frames
  fontWaitMs: 2000,                             // real time to let web fonts arrive

  heroBuildMs: 2000,                            // hero intro: title, packs, nav (all staggers done)
  holdMs: 1700,                                 // hold at every stop
  scrollMs: 1250,                               // scroll between stops (smootherstep)
  headingOffset: 110,                           // heading this far below the top of the viewport
  pinned: { preHoldMs: 1000, glideMs: 4000, postHoldMs: 1500 },
  interactionDelayMs: 400,                      // into the hold
  backToTop: { scrollMs: 1300, holdMs: 700 },
  crossfadeMs: 600,

  // Stops, in order. type: 'top' | 'heading' | 'center' | 'pinned' (scroll-driven range)
  stops: [
    { name: 'hero', type: 'top' },
    { name: 'manifesto (pinned disc + triptych)', type: 'pinned', el: '#intro', endAt: 0.97 },
    { name: 'flavours', type: 'heading', el: '#flavours-title',
      interaction: { label: 'select Berry', js: "document.querySelector('.fl-btn[data-i=\"2\"]').click()" } },
    { name: 'formula', type: 'heading', el: '#formula-title' },
    { name: 'protocol', type: 'heading', el: '#protocol-title' },
    { name: 'footer CTA', type: 'center', el: '#shop' },
  ],

  mp4: { crf: 22, preset: 'slow' },
  webm: { crf: 36 },
};
// ──────────────────────────────────────────────────────────────────

const smootherstep = t => t * t * t * (t * (t * 6 - 15) + 10);
const msToFrames = ms => Math.round(ms / 1000 * CONFIG.fps);

function serve(root) {
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png',
    '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const srv = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

(async () => {
  const C = CONFIG;
  const framesDir = path.join(C.outDir, 'frames');
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });

  const srv = await serve(C.siteRoot);
  const url = `http://127.0.0.1:${srv.address().port}/${C.page}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: C.viewport, deviceScaleFactor: C.deviceScaleFactor });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('page error:', e.message));

  // fake clock: installed before load and paused, so nothing runs on real time
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.addInitScript(() => {
    // exact jumps; and a stepper that drives every document-timeline animation by hand
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = 'html{scroll-behavior:auto!important}';
      document.head.appendChild(s);
    });
    const own = new WeakMap(), done = new WeakSet();
    window.__stepAnimations = dt => {
      for (const a of document.getAnimations()) {
        if (a.timeline && a.timeline !== document.timeline) continue;   // skip scroll-driven timelines
        if (done.has(a)) continue;
        const t = (own.has(a) ? own.get(a) : 0) + dt;
        own.set(a, t);
        a.pause();
        const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
        if (Number.isFinite(end) && t >= end) { done.add(a); a.finish(); }   // fires onfinish like the live site
        else a.currentTime = t;
      }
    };
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(C.fontWaitMs);                        // real time only for fonts/decoding
  await page.evaluate(() => document.fonts.ready);

  // ---- measure stops from the live DOM ----
  const vh = C.viewport.height;
  const geo = await page.evaluate(stops => {
    const maxY = document.documentElement.scrollHeight - innerHeight;
    return { maxY, stops: stops.map(s => {
      if (s.type === 'top') return { y: 0 };
      const el = document.querySelector(s.el); const r = el.getBoundingClientRect();
      const top = r.top + scrollY;
      return { top, height: r.height };
    }) };
  }, C.stops);
  const clampY = y => Math.max(0, Math.min(geo.maxY, Math.round(y)));

  // ---- build the timeline: one scroll position (+ optional action) per frame ----
  const timeline = []; const marks = [];
  let y = 0;
  const hold = (ms, label, action) => {
    const n = msToFrames(ms); const start = timeline.length;
    for (let i = 0; i < n; i++) timeline.push({ y, action: null });
    if (action) timeline[start + msToFrames(C.interactionDelayMs)].action = action;
    marks.push({ label, mid: start + Math.floor(n / 2) });
  };
  const glide = (to, ms) => {
    const from = y, n = msToFrames(ms);
    for (let i = 1; i <= n; i++) timeline.push({ y: Math.round(from + (to - from) * smootherstep(i / n)), action: null });
    y = to;
  };

  const used = [];
  C.stops.forEach((s, i) => {
    const g = geo.stops[i];
    if (s.type === 'top') {
      hold(C.heroBuildMs, 'hero build'); hold(C.holdMs, s.name);
    } else if (s.type === 'pinned') {
      const pinStart = clampY(g.top), pinEnd = clampY(g.top + (g.height - vh) * (s.endAt ?? 1));
      if (y !== pinStart) { glide(pinStart, C.scrollMs); hold(C.pinned.preHoldMs, s.name + ' (pin)'); }
      glide(pinEnd, C.pinned.glideMs); hold(C.pinned.postHoldMs, s.name + ' (end)');
    } else {
      const target = s.type === 'center' ? clampY(g.top + g.height / 2 - vh / 2) : clampY(g.top - C.headingOffset);
      glide(target, C.scrollMs);
      hold(C.holdMs, s.name, s.interaction ? s.interaction.js : null);
    }
    used.push(`${s.name}${s.interaction ? ' + ' + s.interaction.label : ''}`);
  });
  glide(0, C.backToTop.scrollMs); hold(C.backToTop.holdMs, 'back at top');

  // ---- render ----
  console.log(`rendering ${timeline.length} frames (${(timeline.length / C.fps).toFixed(2)} s before loop trim)`);
  for (let f = 0; f < timeline.length; f++) {
    const { y: fy, action } = timeline[f];
    await page.evaluate(yy => { window.scrollTo(0, yy); window.dispatchEvent(new Event('scroll')); }, fy);
    if (action) await page.evaluate(action);
    const dt = C.ticks[f % C.ticks.length];
    await page.clock.runFor(dt);                                     // timers + rAF advance exactly one frame
    await page.evaluate(d => window.__stepAnimations(d), dt);         // CSS / Web Animations advance one frame
    await page.screenshot({ path: path.join(framesDir, `f${String(f).padStart(5, '0')}.png`) });
    if (f % 120 === 0) process.stdout.write(`  frame ${f}\n`);
  }
  await browser.close(); srv.close();

  // ---- encode with a seamless loop: video starts after the first K frames,
  //      and its last K frames crossfade into frames 0..K-1 ----
  const K = msToFrames(C.crossfadeMs), N = timeline.length, fps = C.fps;
  const inPat = path.join(framesDir, 'f%05d.png');
  const filter =
    `[0:v]split=3[a][b][c];` +
    `[a]trim=start_frame=${K}:end_frame=${N - K},setpts=PTS-STARTPTS[mid];` +
    `[b]trim=start_frame=${N - K}:end_frame=${N},setpts=PTS-STARTPTS[tail];` +
    `[c]trim=start_frame=0:end_frame=${K},setpts=PTS-STARTPTS[head];` +
    `[tail][head]xfade=transition=fade:duration=${(K / fps).toFixed(4)}:offset=0[x];` +
    `[mid][x]concat=n=2:v=1:a=0,format=yuv420p[v]`;
  const mp4 = path.join(C.outDir, 'velor-showcase.mp4'), webm = path.join(C.outDir, 'velor-showcase.webm');
  const run = args => { const r = spawnSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] }); if (r.status) { console.error(r.stderr.toString().slice(-2000)); process.exit(1); } };
  run(['-y', '-framerate', String(fps), '-i', inPat, '-filter_complex', filter, '-map', '[v]', '-an',
    '-c:v', 'libx264', '-preset', C.mp4.preset, '-crf', String(C.mp4.crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(fps), mp4]);
  run(['-y', '-framerate', String(fps), '-i', inPat, '-filter_complex', filter, '-map', '[v]', '-an',
    '-c:v', 'libvpx-vp9', '-crf', String(C.webm.crf), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', '-r', String(fps), webm]);

  fs.writeFileSync(path.join(C.outDir, 'render-report.json'), JSON.stringify({
    frames: N, loopFrames: N - K, durationS: +((N - K) / fps).toFixed(2), stops: used, marks, maxY: geo.maxY,
  }, null, 2));
  console.log('stops:', used.join(' → '));
  console.log('done:', mp4, webm);
})();
