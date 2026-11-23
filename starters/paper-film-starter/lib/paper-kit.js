// effects/lib/paper-kit.js
// doc: Vox-style paper-collage kit for 16:9 seek(t) films (Maan video resume, videos/2026-11-18-maan-video-resume/DESIGN.md).
//   Helpers live on K.paper; each effect is also registered as K.register('paper-<name>'). Every builder takes (parent, opts) and
//   returns {el, seek(t)}; shot files pass {at} times from word timings. Pure functions of t, springs only, seeded noise only.
//   Sources: reel DHfdFdoRL5H (cream speckle paper, halftone props with big soft shadows, blur-to-sharp words, tucked grotesk word,
//   whole-page blur-scrolls at ~2.0 s and ~4.8 s) and DceFNdVM-NG (newsprint ground, torn sky strip 0-6 s, masthead behind the dome,
//   engraved hand at 23 s, marker ring at 24 s). Canvas assets (halftones, paper, strips, stamps) are baked once at build time.
(function () {
  if (!window.K) throw new Error('paper-kit.js needs core.js first');
  const { clamp, mulberry32 } = K, TAU = Math.PI * 2;
  const C = { paper: '#E2E2C4', deep: '#146466', sky: '#5AABA9', red: '#C92F1C', ink: '#16201F', white: '#F3F2E6' };   // white = torn paper core only
  // TUMBLE is BOX stiffness at damping ratio 0.77 so a tumble lands with a small overshoot (BOX itself is critically damped).
  const P = Object.assign({}, K.P, { TUMBLE: [170, 20], STAMP: [520, 34], COUNT: [36, 12], SOFT: [6, 5], DRAW: [110, 20] });
  const FONT_DIR = 'fonts/';
  const ARCHIVO = 'fonts/ArchivoBlack-Regular.ttf';   // set to null to force the Arial Black fallback
  const F = { serif: "'Instrument Serif', 'Times New Roman', serif", body: "'EB Garamond', 'Instrument Serif', serif",
    grotesk: "'Archivo Black', 'Arial Black', sans-serif", mono: "'JetBrains Mono', monospace", ui: "'Inter', sans-serif" };
  const light = { x: -.5, y: .87 };   // direction shadows fall (reel 1 keyboard: down and to the left)
  let uid = 0;

  // ---------- small utilities ----------
  function el(tag, css, parent, html) { const e = document.createElement(tag); e.style.cssText = 'position:absolute;' + (css || ''); if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
  function cv(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  const ctx = c => c.getContext('2d', { willReadFrequently: true });
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgba = (h, a) => `rgba(${rgb(h).join(',')},${a})`;
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  function hash(i, j, s) { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s + 1, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y, s = 0) { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s); return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; }
  function fbm(x, y, s = 0, oct = 4) { let v = 0, a = .5, f = 1, n = 0; for (let o = 0; o < oct; o++) { v += a * vnoise(x * f, y * f, s + o * 17); n += a; a *= .5; f *= 2.03; } return v / n; }
  // Breathe: tiny seeded sinusoids so nothing is ever frozen. x/y/r are unit amplitudes; k is a -1..1 shadow breathe.
  function drift(t, seed = 1) { const r = mulberry32(seed * 7919 + 13), a = r() * TAU, b = r() * TAU, c = r() * TAU;
    return { x: Math.sin(t * .71 + a), y: Math.sin(t * .53 + b), r: Math.sin(t * .41 + c), k: Math.sin(t * 1.07 + a + c) }; }
  const NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  let defsEl = null;
  function defs() { if (defsEl) return defsEl; const s = svgEl('svg', { width: 0, height: 0, style: 'position:absolute;width:0;height:0;overflow:hidden' }, document.body);
    defsEl = svgEl('defs', {}, s);
    const f = svgEl('filter', { id: 'pk-wobble', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defsEl);   // grease-pencil tremor + rough edge
    svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.04', numOctaves: 4, seed: 7, result: 'n' }, f);
    svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 4.5, xChannelSelector: 'R', yChannelSelector: 'G' }, f);
    const r = svgEl('filter', { id: 'pk-rough', x: '-2%', y: '-2%', width: '104%', height: '104%' }, defsEl);   // offset-print edge on big type
    svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.75', numOctaves: 2, seed: 3, result: 'n' }, r);
    svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 1.6, xChannelSelector: 'R', yChannelSelector: 'G' }, r);
    return defsEl; }
  // Printed-ink mask for big type: soft ink starvation + pinholes, tileable (periodic noise), applied as a CSS mask.
  let inkUrl = null;
  function inkMask() { if (inkUrl) return inkUrl; const S = 512, P = 16, c = cv(S, S), g = ctx(c), id = g.createImageData(S, S), d = id.data;
    const hp = (i, j, sd, q) => hash(((i % q) + q) % q, ((j % q) + q) % q, sd), vp = (x, y, sd, q) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
      const a = hp(i, j, sd, q), b = hp(i + 1, j, sd, q), cc = hp(i, j + 1, sd, q), dd = hp(i + 1, j + 1, sd, q); return a + (b - a) * ux + (cc - a) * uy + (a - b - cc + dd) * ux * uy; };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const u = x / S * P, v = y / S * P, n = .55 * vp(u, v, 71, P) + .3 * vp(u * 2, v * 2, 72, P * 2) + .15 * vp(u * 4, v * 4, 73, P * 4);
      const f = hp(x, y, 74, S), fine = vp(u * 16, v * 16, 75, P * 16); const a = 1 - .13 * smooth(.62, .84, n) - .1 * smooth(.78, .97, fine) - (f > .9985 ? .7 : 0); const i = (y * S + x) * 4; d[i + 3] = 255 * clamp(a); }
    g.putImageData(id, 0, 0); return (inkUrl = `url(${c.toDataURL()})`); }
  function printed(e) { e.style.webkitMaskImage = e.style.maskImage = inkMask(); e.style.webkitMaskSize = e.style.maskSize = '512px 512px'; e.style.filter = 'url(#pk-rough)'; }

  // ---------- loading ----------
  async function listDir(url) { try { const r = await fetch(url); if (!r.ok) return new Set(); const html = await r.text();
    return new Set([...html.matchAll(/href="([^"?]+)"/g)].map(m => decodeURIComponent(m[1]))); } catch (e) { return new Set(); } }
  function loadImage(url) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('image ' + url)); i.src = url; }); }
  let readyP = null;
  function ready() { return readyP || (readyP = (async () => {
    const faces = [['Instrument Serif', 'InstrumentSerif-400.woff2', {}], ['Instrument Serif', 'InstrumentSerif-400i.woff2', { style: 'italic' }],
      ['Inter', 'Inter-500.woff2', { weight: '500' }], ['Inter', 'Inter-600.woff2', { weight: '600' }], ['JetBrains Mono', 'JetBrainsMono-500.woff2', { weight: '500' }],
      ['JetBrains Mono', 'JetBrainsMono-700.woff2', { weight: '700' }], ['EB Garamond', 'EBGaramond-400.woff2', {}], ['EB Garamond', 'EBGaramond-500.woff2', { weight: '500' }],
      ['EB Garamond', 'EBGaramond-400i.woff2', { style: 'italic' }]];
    const jobs = faces.map(([fam, file, d]) => { const f = new FontFace(fam, `url(${FONT_DIR}${file})`, d); document.fonts.add(f); return f.load(); });
    if (ARCHIVO) { const dir = ARCHIVO.slice(0, ARCHIVO.lastIndexOf('/') + 1), files = await listDir(dir);   // listing first: a 404 would log a page error
      if (files.has(ARCHIVO.slice(dir.length))) { const f = new FontFace('Archivo Black', `url(${ARCHIVO})`); document.fonts.add(f); jobs.push(f.load()); K.paper.archivo = true; } }
    await Promise.all(jobs); await document.fonts.ready; defs(); })()); }

  // ---------- paper texture passes (canvas, once) ----------
  function mottle(g, w, h, rnd, div, alpha, op = 'soft-light', lo = 40, hi = 215) {
    const nw = Math.ceil(w / div) + 4, nh = Math.ceil(h / div) + 4, n = cv(nw, nh), ng = ctx(n), id = ng.createImageData(nw, nh);
    for (let i = 0; i < id.data.length; i += 4) { const v = lo + rnd() * (hi - lo); id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    ng.putImageData(id, 0, 0);
    g.save(); g.globalCompositeOperation = op; g.globalAlpha = alpha; g.imageSmoothingEnabled = true; g.filter = `blur(${Math.max(.5, div * .45)}px)`;
    g.drawImage(n, -div * 2, -div * 2, nw * div, nh * div); g.restore(); }
  function grainPass(g, w, h, rnd, amp) { const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (rnd() - .5) * amp; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0); }
  function speckle(g, w, h, rnd, n, col, aMax = .5, rMax = 1.5) { g.save(); g.fillStyle = col;
    for (let k = 0; k < n; k++) { const x = rnd() * w, y = rnd() * h, cl = rnd() < .22 ? 3 + (rnd() * 9 | 0) : 1;
      for (let j = 0; j < cl; j++) { const r = .35 + Math.pow(rnd(), 3) * rMax; g.globalAlpha = .06 + rnd() * aMax; g.beginPath();
        g.arc(x + (cl > 1 ? (rnd() - .5) * 16 : 0), y + (cl > 1 ? (rnd() - .5) * 10 : 0), r, 0, TAU); g.fill(); } }
    g.restore(); }
  function fibres(g, w, h, rnd, n) { g.save(); g.lineCap = 'round';
    for (let k = 0; k < n; k++) { const x = rnd() * w, y = rnd() * h, L = 5 + rnd() * 26, a = rnd() * TAU, dark = rnd() < .55;
      g.strokeStyle = dark ? rgba(C.ink, .03 + rnd() * .05) : `rgba(255,255,255,${.06 + rnd() * .12})`; g.lineWidth = .5 + rnd() * .6;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * .5 + (rnd() - .5) * 8, y + Math.sin(a) * L * .5 + (rnd() - .5) * 8, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
    g.restore(); }
  function crease(g, w, h, x0, y0, x1, y1, k) {   // a fold: one panel a touch darker, a soft shadow on one side, a bright ridge
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, far = 4000;
    g.save(); g.beginPath(); g.moveTo(x0 - dx * far / L, y0 - dy * far / L); g.lineTo(x1 + dx * far / L, y1 + dy * far / L);
    g.lineTo(x1 + dx * far / L + nx * far, y1 + dy * far / L + ny * far); g.lineTo(x0 - dx * far / L + nx * far, y0 - dy * far / L + ny * far); g.closePath();
    g.fillStyle = rgba(C.ink, .018 * k); g.fill();
    const gr = g.createLinearGradient(x0, y0, x0 + nx * 70, y0 + ny * 70); gr.addColorStop(0, rgba(C.ink, .06 * k)); gr.addColorStop(1, rgba(C.ink, 0)); g.fillStyle = gr; g.fill();
    const hl = g.createLinearGradient(x0, y0, x0 - nx * 26, y0 - ny * 26); hl.addColorStop(0, `rgba(255,255,255,${.16 * k})`); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.beginPath(); g.moveTo(x0 - dx * far / L, y0 - dy * far / L); g.lineTo(x1 + dx * far / L, y1 + dy * far / L);
    g.lineTo(x1 + dx * far / L - nx * 26, y1 + dy * far / L - ny * 26); g.lineTo(x0 - dx * far / L - nx * 26, y0 - dy * far / L - ny * 26); g.closePath(); g.fillStyle = hl; g.fill();
    g.strokeStyle = rgba(C.ink, .09 * k); g.lineWidth = 1; g.beginPath(); g.moveTo(x0 - dx * far / L, y0 - dy * far / L); g.lineTo(x1 + dx * far / L, y1 + dy * far / L); g.stroke();
    g.restore(); }
  function vignette(g, w, h, a) { const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.hypot(w, h) * .58);
    gr.addColorStop(0, rgba(C.ink, 0)); gr.addColorStop(1, rgba(C.ink, a)); g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = gr; g.fillRect(0, 0, w, h); g.restore(); }

  function creamCanvas(o) { const { w, h } = o, c = cv(w, h), g = ctx(c), rnd = mulberry32(o.seed * 9973 + 1);
    g.fillStyle = o.color || C.paper; g.fillRect(0, 0, w, h);
    mottle(g, w, h, rnd, 280, .30); mottle(g, w, h, rnd, 90, .20); mottle(g, w, h, rnd, 22, .12); mottle(g, w, h, rnd, 3, .10);
    if (o.folds) { const fx = w * (.6 + rnd() * .12), fy = h * (.3 + rnd() * .2); crease(g, w, h, fx, 0, fx + 10 + rnd() * 16, h, 1); crease(g, w, h, 0, fy, w, fy - 6 - rnd() * 10, .55); }
    fibres(g, w, h, rnd, w * h / 2600); grainPass(g, w, h, rnd, 13);
    speckle(g, w, h, rnd, w * h / 2400, C.ink, .45); speckle(g, w, h, rnd, w * h / 9000, '#ffffff', .3);
    if (o.vignette) vignette(g, w, h, .14);
    return c; }

  // Procedural newspaper sheet (black on white), multiplied onto --deep and dimmed, like the Vox newsprint ground.
  const WORDS = ('the of and to in a the of a to market engine city council new report said today after year bank steel river plant workers trade shares ' +
    'opened higher morning laboratory study machine board members week line power company price rates grain cotton railway station building floor ' +
    'street office paper record hours night order press notice public works water supply harbour ship cargo coal iron wheat figures total gain ' +
    'loss rise fall per cent million thousand first second last next was were has have had will would could may not but or as at by for from on ' +
    'with into over under between during before about across engineers model cases reading tables second edition evening late wire special').split(' ');
  const HEADS = ['MARKETS OPEN HIGHER ON NEW ENGINE', 'CITY BOARD VOTES TO BUILD', 'LABORATORY REPORTS NEW FINDINGS', 'STEEL WORKS RUN THROUGH THE NIGHT',
    'TRADE FIGURES BEAT ALL RECORDS', 'A MACHINE THAT READS THE CASES', 'RAIL LINE OPENS TO THE HARBOUR', 'BANKS CLOSE EARLY ON FRIDAY',
    'THE SLOWEST PART OF THE JOB', 'ENGINEERS FILE THIRTY-EIGHT PLANS', 'NEW PRESS WORKS DAY AND NIGHT', 'PRICES STEADY AS GRAIN ARRIVES'];
  function fakePhoto(w, h, seed) { const s = 2, c = cv(w / s, h / s), g = ctx(c), id = g.createImageData(c.width, c.height), d = id.data;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const X = x / c.width, Y = y / c.height;
      let v = .82 - Y * .25 + (fbm(X * 3, Y * 3, seed, 4) - .5) * .5; const hz = .45 + (fbm(X * 4, 0, seed + 9, 3) - .5) * .5;
      if (Y > hz) v = .25 + (fbm(X * 9, Y * 9, seed + 3, 4) - .5) * .7; const i = (y * c.width + x) * 4; d[i] = d[i + 1] = d[i + 2] = clamp(v) * 255; d[i + 3] = 255; }
    g.putImageData(id, 0, 0); return halftone(c, { w, h, pitch: 4.2, ink: '#000000', paper: '#ffffff', contrast: 1.1, print: 0 }); }
  function newspaper(seed, W, H) { const c = cv(W, H), g = c.getContext('2d'), rnd = mulberry32(seed * 131 + 7), M = 46;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#000'; g.strokeStyle = '#000'; g.textBaseline = 'alphabetic';
    const pick = a => a[rnd() * a.length | 0];
    let y = M + 70; g.font = `500 82px ${F.body}`; const h1 = pick(HEADS); g.letterSpacing = '1px';
    const hw = g.measureText(h1).width, sc = Math.min(1, (W - 2 * M) / hw); g.save(); g.translate(W / 2, y); g.scale(sc, 1); g.textAlign = 'center'; g.fillText(h1, 0, 0); g.restore();
    y += 26; g.fillRect(M, y, W - 2 * M, 3); g.fillRect(M, y + 6, W - 2 * M, 1); y += 18; g.letterSpacing = '0px';
    const cols = 6, gut = 20, cw = (W - 2 * M - gut * (cols - 1)) / cols, bodyFont = `400 16px ${F.body}`; g.font = bodyFont;
    const wcache = {}; const ww = s => wcache[s] ?? (wcache[s] = g.measureText(s).width);
    let cap = true; const word = () => { let s = pick(WORDS); if (cap) s = s[0].toUpperCase() + s.slice(1); cap = false; if (rnd() < .09) { s += '.'; cap = true; } else if (rnd() < .05) s += ','; return s; };
    for (let ci = 0; ci < cols; ci++) { const x = M + ci * (cw + gut); let yy = y + 10;
      if (ci) { g.fillRect(x - gut / 2, y + 6, 1, H - y - M); }
      while (yy < H - M) { const r = rnd();
        if (r < .16 && yy < H - M - 220) { const span = ci < cols - 1 && rnd() < .4 ? 2 : 1, pw = cw * span + gut * (span - 1), ph = 130 + rnd() * 150;
          if (span === 2) { /* the photo spills into the next column only visually; that column still sets text under it */ }
          g.drawImage(fakePhoto(pw | 0, ph | 0, (seed * 31 + ci * 7 + yy) | 0), x, yy); yy += ph + 8; g.font = `italic 400 13px ${F.body}`;
          g.fillText('Photograph by the staff of this paper.', x, yy + 10); g.font = bodyFont; yy += 26; }
        else if (r < .38) { g.font = `500 22px ${F.body}`; const hd = pick(HEADS).split(' '); let line = '', ly = yy + 22;
          for (const wd of hd) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > cw && line) { g.textAlign = 'center'; g.fillText(line, x + cw / 2, ly); ly += 24; line = wd; } else line = t; }
          g.textAlign = 'center'; g.fillText(line, x + cw / 2, ly); g.textAlign = 'left'; yy = ly + 10; g.fillRect(x + cw * .3, yy, cw * .4, 1); yy += 12; g.font = bodyFont; }
        else { const n = 7 + (rnd() * 16 | 0); for (let li = 0; li < n && yy < H - M; li++) { const ws = []; let lw = 0;
            while (true) { const s = word(), sw = ww(s); if (lw + sw + ws.length * 4 > cw) { if (!ws.length) { ws.push(s); lw = sw; } break; } ws.push(s); lw += sw; }
            const last = li === n - 1, gap = !last && ws.length > 1 ? (cw - lw) / (ws.length - 1) : 4.2; let xx = x + (li === 0 ? 10 : 0);
            yy += 19; for (const s of ws) { g.fillText(s, xx, yy); xx += ww(s) + gap; } }
          yy += 10; } } }
    return c; }
  function newsprintCanvas(o) { const { w, h } = o, c = cv(w, h), g = ctx(c), rnd = mulberry32(o.seed * 7919 + 3);
    g.fillStyle = o.color || C.deep; g.fillRect(0, 0, w, h);
    mottle(g, w, h, rnd, 300, .45); mottle(g, w, h, rnd, 80, .25);
    if (o.img) { const iw = o.img.naturalWidth || o.img.width, ih = o.img.naturalHeight || o.img.height, sc = Math.max(w / iw, h / ih) * (o.imgScale || 1.15);
      g.save(); g.translate(w / 2, h / 2); g.rotate((o.rot ?? -4) * Math.PI / 180); g.filter = 'grayscale(1) contrast(1.25)'; g.globalCompositeOperation = 'multiply'; g.globalAlpha = o.ink ?? .32;
      g.drawImage(o.img, -iw * sc / 2, -ih * sc / 2, iw * sc, ih * sc); g.restore(); }
    const sheets = o.sheets || [{ x: w * .46, y: h * .52, rot: -5, scale: 1.32, ink: .46, seed: o.seed, sw: 1800, sh: 1250 }, { x: w * .95, y: h * .14, rot: 7, scale: 1.12, ink: .44, seed: o.seed + 11, edge: true, sw: 900, sh: 760 }];
    for (const s of (o.img ? [] : sheets)) { const np = newspaper(s.seed, s.sw || 1500, s.sh || 1100); g.save(); g.translate(s.x, s.y); g.rotate(s.rot * Math.PI / 180); g.scale(s.scale, s.scale);
      if (s.edge) { g.save(); g.shadowColor = rgba(C.ink, .55); g.shadowBlur = 18; g.shadowOffsetX = -4; g.shadowOffsetY = 8; g.fillStyle = C.deep; g.fillRect(-np.width / 2, -np.height / 2, np.width, np.height); g.restore();
        g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(-np.width / 2, -np.height / 2, np.width, np.height); }
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = s.ink * (o.dim ?? .65); g.drawImage(np, -np.width / 2, -np.height / 2); g.restore(); }
    mottle(g, w, h, rnd, 4, .16); fibres(g, w, h, rnd, w * h / 3000); grainPass(g, w, h, rnd, 12);
    speckle(g, w, h, rnd, w * h / 3000, '#ffffff', .22); speckle(g, w, h, rnd, w * h / 3000, '#000000', .4);
    vignette(g, w, h, o.vignette === false ? 0 : .3);
    return c; }

  // ---------- paper-ground ----------
  function ground(parent, o = {}) {
    o = Object.assign({ x: 0, y: 0, w: 1920, h: 1080, variant: 'cream', seed: 1, folds: true, vignette: null, z: 0 }, o);   // vignette: null = per-variant default
    const c = o.variant === 'newsprint' ? newsprintCanvas(o) : creamCanvas(o);
    const e = el('div', `left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;overflow:hidden;z-index:${o.z}`, parent);
    c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%'; e.appendChild(c);
    return { el: e, canvas: c, seek() {} }; }

  // ---------- halftone ----------
  // AM screen as a threshold array: each output pixel is ink when darkness D beats the cosine spot function at its screen position,
  // so dots grow with darkness, touch as a checkerboard at 50 % and become white holes in the shadows (how a RIP screens a photo).
  function boxBlur(src, W, H, r) { const tmp = new Float32Array(W * H), out = new Float32Array(W * H), n = 2 * r + 1;
    for (let y = 0; y < H; y++) { const o = y * W; let s = 0; for (let k = -r; k <= r; k++) s += src[o + Math.min(W - 1, Math.max(0, k))];
      for (let x = 0; x < W; x++) { tmp[o + x] = s / n; s += src[o + Math.min(W - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; } }
    for (let x = 0; x < W; x++) { let s = 0; for (let k = -r; k <= r; k++) s += tmp[Math.min(H - 1, Math.max(0, k)) * W + x];
      for (let y = 0; y < H; y++) { out[y * W + x] = s / n; s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
    return out; }
  const htCache = new Map();
  const srcKey = s => s.__pk || (s.__pk = 'src' + (++uid));
  function halftone(src, o = {}) {
    o = Object.assign({ w: 0, h: 0, pitch: 5, angle: 45, ink: C.ink, paper: C.paper, mode: 'dot', contrast: 1.12, gamma: 1, sharpen: .8, crop: null,
      aa: 0, levels: [.01, .99], floor: .08, print: 1, wave: 0, cross: true, alpha: .5, seed: 3 }, o);
    const key = srcKey(src) + JSON.stringify(o); if (htCache.has(key)) return htCache.get(key);
    const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, cr = Object.assign({ t: 0, r: 0, b: 0, l: 0 }, o.crop || {});
    const sx = cr.l * sw, sy = cr.t * sh, cw = sw * (1 - cr.l - cr.r), ch = sh * (1 - cr.t - cr.b);
    const W = Math.round(o.w || cw), H = Math.round(o.h || W * ch / cw), c = cv(W, H), g = ctx(c);
    g.imageSmoothingQuality = 'high'; g.drawImage(src, sx, sy, cw, ch, 0, 0, W, H);
    const im = g.getImageData(0, 0, W, H), d = im.data, N = W * H, L = new Float32Array(N), A = new Float32Array(N), hist = new Float64Array(256);
    let cnt = 0, sum = 0;
    for (let i = 0; i < N; i++) { const a = d[i * 4 + 3] / 255, l = (d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114) / 255; A[i] = a; L[i] = l;
      if (a > .5) { hist[Math.min(255, l * 255 | 0)]++; cnt++; sum += l; } }
    const mean = cnt ? sum / cnt : .5; for (let i = 0; i < N; i++) if (A[i] <= .5) L[i] = mean;   // no dark halo from the matte
    const pct = q => { let s = 0; for (let k = 0; k < 256; k++) { s += hist[k]; if (s >= q * cnt) return k / 255; } return 1; };
    const lo = cnt ? pct(o.levels[0]) : 0, hi = cnt ? Math.max(lo + .05, pct(o.levels[1])) : 1;
    const B = o.sharpen ? boxBlur(L, W, H, Math.max(1, Math.round(o.pitch * .9))) : L;
    const G = o.mode === 'line' ? boxBlur(boxBlur(L, W, H, Math.round(o.pitch * 2.5)), W, H, Math.round(o.pitch * 2.5)) : null;   // engraving lines bend with the form
    const ang = o.angle * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang), f = 1 / o.pitch;
    const ang2 = ang + Math.PI / 3, cb = Math.cos(ang2), sb = Math.sin(ang2);
    const aa = (o.aa || 1 / o.pitch) * (o.mode === 'line' ? 1.8 : 1), ik = rgb(o.ink), pk = o.paper ? rgb(o.paper) : null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let v = (L[i] - lo) / (hi - lo); if (o.sharpen) v += o.sharpen * (v - (B[i] - lo) / (hi - lo));
      v = (v - .5) * o.contrast + .5; v = v < 0 ? 0 : v > 1 ? 1 : v; if (o.gamma !== 1) v = Math.pow(v, o.gamma);
      let D = o.floor + (1 - v) * (1 - o.floor); if (o.print)   // floor: highlights keep a small dot, like a printed photo D += o.print * .07 * (vnoise(x / 6, y / 6, o.seed) - .5) + o.print * .05 * (vnoise(x / 40, y / 40, o.seed + 5) - .5);
      D = D * (1 + aa) - aa / 2;   // pure paper prints no dot, full ink prints solid
      const u = (x * ca + y * sa) * f, w = (-x * sa + y * ca) * f; let ink;
      if (o.mode === 'line') { const uu = u + o.wave * ((G[i] - lo) / (hi - lo) - .5) * 3.2 + .25 * Math.sin(w * .09 + u * .03); ink = (D - (.5 - .5 * Math.cos(TAU * uu))) / aa + .5;
        if (o.cross && D > .58) { const u2 = (x * cb + y * sb) * f; ink = Math.max(ink, ((D - .58) / .42 - (.5 - .5 * Math.cos(TAU * u2))) / aa + .5); } }
      else if (o.mode === 'ink') ink = (1 - v) + (o.print ? o.print * .05 * (vnoise(x / 30, y / 30, o.seed + 5) - .5) : 0);   // already line art (engravings): duotone, no screen
      else ink = (D - (.5 - (Math.cos(TAU * u) + Math.cos(TAU * w)) * .25)) / aa + .5;
      ink = ink < 0 ? 0 : ink > 1 ? 1 : ink;
      const a = smooth(o.alpha - .14, o.alpha + .14, A[i]), j = i * 4;
      if (pk) { d[j] = pk[0] + (ik[0] - pk[0]) * ink; d[j + 1] = pk[1] + (ik[1] - pk[1]) * ink; d[j + 2] = pk[2] + (ik[2] - pk[2]) * ink; d[j + 3] = 255 * a; }
      else { d[j] = ik[0]; d[j + 1] = ik[1]; d[j + 2] = ik[2]; d[j + 3] = 255 * a * ink; } }
    g.putImageData(im, 0, 0); htCache.set(key, c); return c; }
  // Colour cut-out (screens keep their colour): crop + crisp alpha, no screen.
  function colourCut(src, o = {}) { o = Object.assign({ w: 0, crop: null }, o); const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, cr = Object.assign({ t: 0, r: 0, b: 0, l: 0 }, o.crop || {});
    const cw = sw * (1 - cr.l - cr.r), ch = sh * (1 - cr.t - cr.b), W = Math.round(o.w || cw), H = Math.round(W * ch / cw), c = cv(W, H), g = ctx(c);
    g.imageSmoothingQuality = 'high'; g.drawImage(src, cr.l * sw, cr.t * sh, cw, ch, 0, 0, W, H); return c; }
  const silCache = new WeakMap();
  function silhouette(c) { if (silCache.has(c)) return silCache.get(c); const s = cv(c.width, c.height), g = s.getContext('2d'); g.drawImage(c, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = C.ink; g.fillRect(0, 0, s.width, s.height); silCache.set(c, s); return s; }
  // Neutral stand-in while an asset is missing: a shaded shape, so the halftone and shadow still read.
  function placeholder(kind, w = 900, h = 900, seed = 1) { const c = cv(w, h), g = c.getContext('2d'), rnd = mulberry32(seed * 97 + 5);
    const sh = (x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, '#f2f2f2'); gr.addColorStop(.5, '#a8a8a8'); gr.addColorStop(1, '#2e2e2e'); return gr; };
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (kind === 'hand' || kind === 'hand_open') {   // open palm-up hand reaching in from the left (Vox 23 s pose), drawn in a 1000 x 760 box
      g.save(); g.scale(w / 1000, h / 760);
      const hp = new Path2D('M0 760L0 540C120 520 250 470 340 420C380 330 430 250 500 215C540 195 578 214 566 252C548 310 505 362 486 410C560 420 660 418 760 408' +
        'C850 398 918 378 948 350C972 330 996 348 982 374C952 420 884 444 822 452C880 456 938 450 964 440C990 434 998 468 972 480C922 500 862 505 802 506' +
        'C860 510 912 512 934 516C960 520 960 550 934 556C882 566 822 566 772 562C822 576 858 586 870 596C886 610 870 632 844 628C760 626 640 642 560 652C420 680 250 702 160 760Z');
      const gr = g.createRadialGradient(560, 430, 40, 520, 520, 560); gr.addColorStop(0, '#f4f4f4'); gr.addColorStop(.45, '#bdbdbd'); gr.addColorStop(1, '#3c3c3c');
      g.fillStyle = gr; g.fill(hp); g.save(); g.clip(hp); g.strokeStyle = 'rgba(60,60,60,.32)'; g.lineWidth = 16; g.filter = 'blur(6px)';
      for (const d of ['M486 410C520 440 560 450 600 452', 'M770 410C790 430 800 445 822 452', 'M800 506C780 500 770 470 790 455', 'M772 562C760 548 770 520 800 507', 'M560 652C600 600 640 560 700 520', 'M420 520C480 500 560 520 640 560'])
        g.stroke(new Path2D(d));
      const sh = g.createLinearGradient(0, 400, 0, 760); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = sh; g.fillRect(0, 400, 1000, 360); g.restore(); g.restore(); }
    else { const cx = w / 2, cy = h / 2; g.beginPath(); for (let i = 0; i <= 64; i++) { const a = i / 64 * TAU, r = Math.min(w, h) * .42 * (.8 + .35 * fbm(Math.cos(a) + 3, Math.sin(a) + 3, seed, 3));
        g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r * .8); } g.closePath(); g.fillStyle = sh(w * .2, h * .1, w * .8, h * .9); g.fill(); }
    c.__placeholder = kind; return c; }

  // ---------- paper-cutout ----------
  // A cut-out on the desk: two-layer shadow (contact + ambient) whose offset and blur grow with lift, entrances tumble/rise/slide/drop,
  // optional stepped 12 fps motion, and a breathe so a held prop never freezes.
  function cutout(parent, o = {}) {
    o = Object.assign({ img: null, x: 960, y: 540, scale: 1, rot: 0, at: 0, enter: 'tumble', from: null, tumble: -20, out: null, lift: .35, liftCues: null,
      stepped: false, fps: 12, drift: 1, seed: 1, z: 2, shadow: 1, sceneH: 1080, sceneW: 1920, label: null }, o);
    const im = o.img, W = im.width, H = im.height;
    const wrap = el('div', `left:${o.x - W / 2}px;top:${o.y - H / 2}px;width:${W}px;height:${H}px;z-index:${o.z};transform-origin:50% 50%`, parent);
    const sil = silhouette(im);
    const mkSh = k => { const c = cv(W / k, H / k); c.getContext('2d').drawImage(sil, 0, 0, c.width, c.height); c.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px`; wrap.appendChild(c); return c; };
    const shA = mkSh(4), shC = mkSh(2);
    const body = im.parentNode ? (() => { const k = cv(W, H); k.getContext('2d').drawImage(im, 0, 0); return k; })() : im;
    body.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px`; wrap.appendChild(body);
    const lab = (o.label || im.__placeholder) ? el('div', `left:0;top:${H * .5}px;width:${W}px;text-align:center;font:700 18px/1 ${F.mono};letter-spacing:.12em;color:${C.red}`, wrap, (o.label || ('PLACEHOLDER · ' + im.__placeholder)).toUpperCase()) : null;
    const lifts = [{ t: -1e9, v: o.lift }].concat(o.liftCues || []);
    const api = { el: wrap, body, img: im, W, H, o,
      addLift(t, v) { lifts.push({ t, v }); lifts.sort((a, b) => a.t - b.t); },
      seek(t) {
        const tt = o.stepped && t > o.at ? o.at + Math.floor((t - o.at) * o.fps) / o.fps : t;
        let dx = 0, dy = 0, r = o.rot, s = o.scale, blur = 0, op = 1, lf = K.springTo(tt, lifts, P.BOX);
        if (o.enter !== 'none') {
          if (tt < o.at) op = 0;
          const p = K.step(tt - o.at, ...P.BOX), pc = clamp(p), pr = K.step(tt - o.at, ...P.TUMBLE);
          if (o.enter === 'tumble') { const fr = o.from || [-340, 260]; dx = fr[0] * (1 - pr); dy = fr[1] * (1 - pr); r += o.tumble * (1 - pr); s *= .8 + .2 * pr;
            blur = 8 * (1 - pc); op *= clamp(pc * 3); lf += .9 * (1 - pc); }
          else if (o.enter === 'rise') { const ph = K.step(tt - o.at, ...P.HEAVY); dy = (o.sceneH - (o.y - H * s / 2) + 40) * (1 - ph); r += (o.tumble === -20 ? 0 : o.tumble) * (1 - ph); lf += .3 * (1 - clamp(ph)); }
          else if (o.enter === 'slide') { const fr = o.from || [-1400, 0]; dx = fr[0] * (1 - pr); dy = fr[1] * (1 - pr); r += (o.tumble === -20 ? -6 : o.tumble) * (1 - pr); lf += .4 * (1 - pc); }
          else if (o.enter === 'drop') { s *= 1 + .3 * (1 - p); lf += 1.4 * (1 - pc); blur = 7 * (1 - pc); op *= clamp(pc * 4); r += 7 * (1 - pr); }
        }
        if (o.out) { const q = K.step(tt - o.out.at, ...(o.out.p || P.BOX)); dx += (o.out.to?.[0] || 0) * q; dy += (o.out.to?.[1] || 0) * q; r += (o.out.rot || 0) * q; lf += (o.out.lift || 0) * q; }
        const dr = drift(tt, o.seed); dx += dr.x * W * .003 * o.drift; dy += dr.y * H * .003 * o.drift; r += dr.r * .25 * o.drift; lf += .035 * dr.k * o.drift;
        lf = Math.max(0, lf); s *= 1 + .03 * Math.max(0, lf - o.lift);   // a lifted piece comes closer to camera
        wrap.style.display = op <= .002 ? 'none' : 'block'; if (op <= .002) return;
        wrap.style.opacity = op < .999 ? op : ''; wrap.style.transform = `translate(${dx}px,${dy}px) rotate(${r}deg) scale(${s})`;
        body.style.filter = blur > .05 ? `blur(${blur}px)` : 'none';
        const rr = -r * Math.PI / 180, loc = k => [(light.x * Math.cos(rr) - light.y * Math.sin(rr)) * k / s, (light.x * Math.sin(rr) + light.y * Math.cos(rr)) * k / s];
        const oA = 12 + 70 * lf, bA = 18 + 46 * lf, aA = (.74 - .22 * Math.min(1, lf)) * o.shadow, la = loc(oA);
        shA.style.transform = `translate(${la[0]}px,${la[1]}px) scale(${1.012 + .03 * lf})`; shA.style.filter = `blur(${bA / s}px)`; shA.style.opacity = aA;
        const oC = 2 + 9 * lf, lc = loc(oC); shC.style.transform = `translate(${lc[0]}px,${lc[1]}px)`; shC.style.filter = `blur(${(2.5 + 9 * lf) / s}px)`;
        shC.style.opacity = .55 * Math.max(0, 1 - lf * 1.4) * o.shadow;
        if (lab) lab.style.opacity = .85;
      } };
    return api; }

  // ---------- paper-camera (blur-scroll + push-in) ----------
  function camera(stage, o = {}) {
    o = Object.assign({ w: 1920, h: 1080, cues: [{ t: 0, x: 0, y: 0 }], zoom: [{ t: 0, z: 1 }], p: P.BOX, zp: P.SOFT, maxBlur: 24, speed: 3200, bleed: 72, drift: 1, z: 0, bg: C.paper }, o);
    const id = 'pkcam' + (++uid), f = svgEl('filter', { id, x: 0, y: 0, width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' }, defs());
    const blur = svgEl('feGaussianBlur', { stdDeviation: '0 0' }, f);
    const vp = el('div', `left:0;top:${-o.bleed}px;width:${o.w}px;height:${o.h + 2 * o.bleed}px;overflow:hidden;z-index:${o.z};background:${o.bg}`, stage);
    const world = el('div', `left:0;top:${o.bleed}px;width:0;height:0;transform-origin:0 0`, vp);
    const xs = o.cues.map(c => ({ t: c.t, v: c.x || 0 })), ys = o.cues.map(c => ({ t: c.t, v: c.y || 0 })), zs = o.zoom.map(c => ({ t: c.t, v: c.z }));
    let last = '';
    return { el: vp, world, at(t) { return { x: K.springTo(t, xs, o.p), y: K.springTo(t, ys, o.p), z: K.springTo(t, zs, o.zp) }; },
      seek(t) { const a = this.at(t), b = this.at(t - 1 / 240), vx = (a.x - b.x) * 240 * a.z, vy = (a.y - b.y) * 240 * a.z;
        const dr = drift(t, 77), dx = dr.x * 2.2 * o.drift, dy = dr.y * 1.6 * o.drift, z = a.z * (1 + .0025 * dr.r * o.drift);
        world.style.transform = `translate(${o.w / 2}px,${o.h / 2}px) scale(${z}) translate(${-(a.x + o.w / 2 + dx)}px,${-(a.y + o.h / 2 + dy)}px)`;
        const bx = o.maxBlur * Math.tanh(Math.abs(vx) / o.speed), by = o.maxBlur * Math.tanh(Math.abs(vy) / o.speed);
        if (bx < .3 && by < .3) { if (last !== 'none') { vp.style.filter = 'none'; last = 'none'; } }
        else { blur.setAttribute('stdDeviation', `${Math.max(bx, by * .22).toFixed(2)} ${Math.max(by, bx * .22).toFixed(2)}`); /* isotropic floor: 1-axis blur smears ~5 px halftone dots into pinstripes */ const fs = `url(#${id})`; if (last !== fs) { vp.style.filter = fs; last = fs; } } } }; }
  function scene(parent, o = {}) { o = Object.assign({ x: 0, y: 0, w: 1920, h: 1080, clip: true, z: 0 }, o);
    return el('div', `left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;overflow:${o.clip ? 'hidden' : 'visible'};z-index:${o.z}`, parent); }

  // ---------- type ----------
  const fcss = o => `${o.italic ? 'italic ' : ''}${o.weight || 400} ${o.size}px ${F[o.font] || o.font}`;
  const boCache = {};
  function baseline(font) { if (boCache[font] != null) return boCache[font];   // px from the top of a line-height:1 box to the baseline
    const p = el('div', `left:0;top:0;font:${font};line-height:1;white-space:nowrap;visibility:hidden`, document.body, 'Hxg<span style="display:inline-block;width:0;height:0;vertical-align:baseline"></span>');
    const v = p.lastChild.offsetTop; p.remove(); return (boCache[font] = v); }
  let mc = null; const measure = (font, s) => { mc = mc || cv(4, 4).getContext('2d'); mc.font = font; return mc.measureText(s); };
  // Blur-to-sharp words (DESIGN motion grammar): blur 10 -> 0 + opacity on HEAVY, 80 ms stagger. y is the baseline.
  function words(parent, o = {}) {
    o = Object.assign({ text: '', x: 0, y: 0, size: 80, font: 'serif', italic: false, weight: 400, color: C.ink, at: 0, stagger: .08, z: 4, align: 'left', ls: '-0.01em', blur: 10, p: P.HEAVY, rise: .05, gap: .24, drift: 1, seed: 3, out: null, print: null }, o);
    const font = fcss(o), box = el('div', `left:${o.x}px;top:${o.y - baseline(font)}px;font:${font};line-height:1;white-space:nowrap;color:${o.color};letter-spacing:${o.ls};z-index:${o.z}`, parent);
    const parts = o.text.split(' ').map((w, i) => { const s = el('span', `position:relative;display:inline-block${i ? `;margin-left:${o.gap}em` : ''}`, box, w); return s; });
    const width = box.offsetWidth; if (o.align === 'center') box.style.left = (o.x - width / 2) + 'px'; else if (o.align === 'right') box.style.left = (o.x - width) + 'px';
    if (o.print ?? o.size >= 90) printed(box);
    return { el: box, parts, width, left: parseFloat(box.style.left), font,
      seek(t) { parts.forEach((s, i) => { const p = K.step(t - o.at - i * o.stagger, ...o.p), pc = clamp(p), q = o.out ? K.step(t - o.out - i * .03, ...P.OUT) : 0;
          s.style.visibility = t < o.at + i * o.stagger || q > .995 ? 'hidden' : 'inherit'; s.style.opacity = clamp(pc * 1.6) * (1 - q);
          const bl = o.blur * (1 - pc) + 10 * q; s.style.filter = bl > .05 ? `blur(${bl}px)` : 'none'; s.style.transform = `translateY(${(1 - p) * o.rise * o.size}px)`; });
        const dr = drift(t, o.seed); box.style.transform = `translate(${dr.x * .6 * o.drift}px,${dr.y * .5 * o.drift}px)`; } }; }
  // The tucked word (reel 1 "Every / frame"): a small grotesk word sits tight at the big serif word's shoulder. Small lands first.
  function tuck(parent, o = {}) {
    o = Object.assign({ big: '', small: '', x: 960, y: 540, size: 180, ratio: .25, side: 'tr', bigFont: 'serif', bigItalic: true, smallFont: 'grotesk', color: C.ink, smallColor: null, at: 0, z: 5, align: 'left', gap: .035, seed: 5, lag: .14, p: null }, o);   // lag: big word after the small one; p: entrance spring (default HEAVY)
    const sp = o.p ? { p: o.p } : {};
    const big = words(parent, Object.assign({ text: o.big, x: o.x, y: o.y, size: o.size, font: o.bigFont, italic: o.bigItalic, color: o.color, at: o.at + o.lag, z: o.z, align: o.align, ls: '-0.012em', seed: o.seed }, sp));
    const ss = Math.round(o.size * o.ratio), sfont = fcss({ font: o.smallFont, size: ss }), bx = big.left, bw = big.width;
    const sw = measure(sfont, o.small).width * .98, sCap = measure(sfont, 'H').actualBoundingBoxAscent;
    const sub = (fromEnd) => { let k = 1; while (k < o.big.length && measure(big.font, fromEnd ? o.big.slice(-k) : o.big.slice(0, k)).width < sw) k++; return fromEnd ? o.big.slice(-k) : o.big.slice(0, k); };
    const xh = measure(big.font, 'x').actualBoundingBoxAscent, sDesc = measure(sfont, o.small).actualBoundingBoxDescent * .55, gap = o.size * o.gap + sDesc; let sx, sy;   // a descender may only graze the big word
    if (o.side === 'tr') { sx = bx + bw - sw + o.size * .02; sy = o.y - measure(big.font, sub(true)).actualBoundingBoxAscent - gap; }
    else if (o.side === 'tl') { sx = bx + o.size * .03; sy = o.y - measure(big.font, sub(false)).actualBoundingBoxAscent - gap; }
    else if (o.side === 'l') { sx = bx - sw - o.size * .07; sy = o.y - xh + sCap * .95; }
    else { sx = bx + bw - sw; sy = o.y + measure(big.font, o.big).actualBoundingBoxDescent + gap + sCap; }
    const small = words(parent, Object.assign({ text: o.small, x: sx, y: sy, size: ss, font: o.smallFont, color: o.smallColor || o.color, at: o.at, z: o.z, ls: '-0.02em', stagger: .06, seed: o.seed }, sp));
    return { el: big.el, big, small, seek(t) { small.seek(t); big.seek(t); } }; }
  // Masthead: a huge Instrument Serif word that builds letter by letter (Vox wordmark). Give it a lower z than the cut-out to sit behind.
  function masthead(parent, o = {}) {
    o = Object.assign({ word: 'MAAN', x: 960, y: 500, size: 520, color: C.ink, at: 0, stagger: .11, z: 1, italic: false, ls: '-0.025em', align: 'center', p: P.UI, seed: 9, print: true }, o);
    const font = fcss({ font: 'serif', size: o.size, italic: o.italic }), box = el('div', `left:${o.x}px;top:${o.y - baseline(font)}px;font:${font};line-height:1;white-space:nowrap;color:${o.color};letter-spacing:${o.ls};z-index:${o.z}`, parent);
    const ls = [...o.word].map(ch => el('span', 'position:relative;display:inline-block;transform-origin:50% 80%', box, ch === ' ' ? '&nbsp;' : ch));
    const width = box.offsetWidth; if (o.align === 'center') box.style.left = (o.x - width / 2) + 'px'; else if (o.align === 'right') box.style.left = (o.x - width) + 'px';
    if (o.print) printed(box);
    return { el: box, width, seek(t) { ls.forEach((s, i) => { const p = K.step(t - o.at - i * o.stagger, ...o.p), pc = clamp(p);
          s.style.visibility = t < o.at + i * o.stagger ? 'hidden' : 'inherit'; s.style.opacity = clamp(pc * 2.2);
          s.style.transform = `translate(${(1 - p) * .1 * o.size}px,${(1 - p) * .04 * o.size}px) scale(${1.06 - .06 * p})`; s.style.filter = pc < .99 ? `blur(${14 * (1 - pc)}px)` : 'none'; });
        const dr = drift(t, o.seed); box.style.transform = `translate(${dr.x * o.size * .004}px,${dr.y * o.size * .002}px)`; } }; }
  // Mono label (folder names, figure numbers): types on character by character.
  function label(parent, o = {}) { o = Object.assign({ text: '', x: 0, y: 0, size: 20, color: C.ink, at: 0, cps: 45, z: 6, weight: 500, ls: '.1em', align: 'left' }, o);
    const font = fcss({ font: 'mono', size: o.size, weight: o.weight }), box = el('div', `left:${o.x}px;top:${o.y - baseline(font)}px;font:${font};line-height:1;white-space:pre;color:${o.color};letter-spacing:${o.ls};z-index:${o.z}`, parent, o.text);
    const w = box.offsetWidth; if (o.align === 'right') box.style.left = (o.x - w) + 'px'; else if (o.align === 'center') box.style.left = (o.x - w / 2) + 'px'; let lastN = -1;
    return { el: box, seek(t) { const n = Math.max(0, Math.min(o.text.length, Math.floor((t - o.at) * o.cps))); if (n !== lastN) { lastN = n;
        box.innerHTML = o.text.slice(0, n).replace(/&/g, '&amp;').replace(/</g, '&lt;') + `<span style="visibility:hidden">${o.text.slice(n).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`; }
      box.style.visibility = t < o.at ? 'hidden' : 'inherit'; } }; }

  // ---------- torn paper ----------
  function edgeNoise(s, seed, amp) { return amp * ((fbm(s / 150, seed * 3.1, seed, 3) - .5) * 2.2 + (fbm(s / 24, seed * 5.3, seed + 7, 2) - .5) * .9) + amp * .18 * (hash(s | 0, seed, 3) - .5); }
  // closed torn outline of a w x h strip; each point carries its outward normal and which side it is on
  function tornOutline(w, h, seed, amp, ends) { const pts = [], st = 3;
    for (let x = 0; x <= w; x += st) pts.push({ x, y: edgeNoise(x, seed, amp), nx: 0, ny: -1, side: 0 });
    for (let y = 0; y <= h; y += st) pts.push({ x: w + (ends[1] ? edgeNoise(y + 900, seed + 2, amp * 1.8) + amp * 1.2 * Math.max(0, 1 - Math.abs(y / h - .55) * 3.2) : 30), y, nx: 1, ny: 0, side: 1 });
    for (let x = w; x >= 0; x -= st) pts.push({ x, y: h + edgeNoise(x + 3000, seed + 4, amp), nx: 0, ny: 1, side: 2 });
    for (let y = h; y >= 0; y -= st) pts.push({ x: ends[0] ? edgeNoise(y + 5000, seed + 6, amp * 1.8) : -30, y, nx: -1, ny: 0, side: 3 });
    return pts; }
  function poly(g, pts, off) { g.beginPath(); pts.forEach((p, i) => { const k = off ? off(p, i) : 0; g[i ? 'lineTo' : 'moveTo'](p.x + p.nx * k, p.y + p.ny * k); }); g.closePath(); }
  function rimWidth(rnd, seed) { return (p, i) => { const sc = [.7, 1.2, 1.7, 1.2][p.side]; return sc * Math.max(.6, 4.2 + 9 * (fbm(i / 16, p.side * 7.7, seed + 21, 3) - .47) * 2 + 3 * Math.max(0, fbm(i / 5, p.side * 3.1, seed + 33, 2) - .55) * 2 + (hash(i, p.side, seed) - .5) * 2); }; }
  function cloudsInto(g, x0, y0, w, h, seed, o) {   // procedural cumulus, screened in --paper dots over the colour
    const s = 3, f = cv(w / s, h / s), fg = ctx(f), id = fg.createImageData(f.width, f.height), d = id.data;
    for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) { const X = x * s, Y = y * s, base = fbm(X / 330, Y / 120, seed, 5) + (Y / h) * .2 - .06;
      const cl = smooth(.47, .62, base), sh = .55 + .45 * smooth(.25, .85, fbm(X / 80, Y / 50, seed + 3, 3) + (base - .55) * 1.4 - (Y / h) * .15);
      const i = (y * f.width + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255 * (1 - cl * sh); d[i + 3] = 255; }
    fg.putImageData(id, 0, 0); g.drawImage(halftone(f, { w, h, pitch: 5, angle: 45, ink: o.cloud || C.paper, paper: null, sharpen: 0, contrast: 1.05, levels: [0, 1], floor: 0, print: .6, seed }), x0, y0); }
  function bird(g, x, y, s, rot, flap) { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = C.ink; const up = .25 + .5 * flap;
    g.beginPath(); g.moveTo(-s, -s * up); g.quadraticCurveTo(-s * .5, -s * (up + .25), -s * .08, s * .02); g.quadraticCurveTo(0, s * .12, s * .08, s * .02);
    g.quadraticCurveTo(s * .5, -s * (up + .25), s, -s * up); g.quadraticCurveTo(s * .45, -s * (up - .05), 0, s * .2); g.quadraticCurveTo(-s * .45, -s * (up - .05), -s, -s * up); g.fill(); g.restore(); }
  function texture(g, w, h, rnd, o = {}) { mottle(g, w, h, rnd, 120, .35); mottle(g, w, h, rnd, 6, .18); speckle(g, w, h, rnd, w * h / 1500, C.ink, .35, 1.1); speckle(g, w, h, rnd, w * h / 2200, '#ffffff', .35, 1); grainPass(g, w, h, rnd, 12); }
  // Torn strip (Vox sky strip): colour or image fill, white fibrous rim on both long sides, revealed by a torn leading edge sweeping from its anchor.
  function tornStrip(parent, o = {}) {
    o = Object.assign({ x: -40, y: 300, w: 2000, h: 280, angle: -5, color: C.sky, img: null, clouds: false, birds: 0, seed: 2, at: 0, z: 3, ends: [false, true], from: 'left', amp: 7, shadow: .5, drift: 1 }, o);
    const m = 46, Wc = o.w + 2 * m, Hc = o.h + 2 * m, c = cv(Wc, Hc), g = ctx(c), rnd = mulberry32(o.seed * 313 + 1);
    const pts = tornOutline(o.w, o.h, o.seed, o.amp, o.ends).map(p => Object.assign(p, { x: p.x + m, y: p.y + m })), rim = rimWidth(rnd, o.seed);
    g.save(); g.filter = 'blur(7px)'; g.translate(light.x * 5, light.y * 7); poly(g, pts, rim); g.fillStyle = rgba(C.ink, o.shadow); g.fill(); g.restore();
    g.save(); g.filter = 'blur(1.6px)'; poly(g, pts, (p, i) => rim(p, i) + 1.2); g.fillStyle = 'rgba(243,242,230,.75)'; g.fill(); g.restore();
    poly(g, pts, rim); g.fillStyle = C.white; g.fill();
    g.save(); g.lineCap = 'round'; pts.forEach((p, i) => { if (rnd() > .62) return; const k = rim(p, i), a = Math.atan2(p.ny, p.nx) + (rnd() - .5) * 1.4, L = 1.2 + rnd() * rnd() * 7;
      const x0 = p.x + p.nx * (k - .6), y0 = p.y + p.ny * (k - .6); g.strokeStyle = `rgba(246,245,236,${.45 + rnd() * .5})`; g.lineWidth = .35 + rnd() * .6;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + Math.cos(a) * L * .5 + (rnd() - .5) * 2, y0 + Math.sin(a) * L * .5 + (rnd() - .5) * 2, x0 + Math.cos(a) * L, y0 + Math.sin(a) * L); g.stroke(); }); g.restore();
    // paper fibre shading inside the white rim
    g.save(); poly(g, pts, rim); g.clip(); speckle(g, Wc, Hc, rnd, Wc * Hc / 1800, rgba(C.ink, 1), .08, .6); g.restore();
    g.save(); poly(g, pts); g.clip();
    if (o.img) { const iw = o.img.naturalWidth || o.img.width, ih = o.img.naturalHeight || o.img.height, sc = Math.max(Wc / iw, Hc / ih);   // photo -> duotone screen in the strip colour
      const src = o.duotone === false ? o.img : halftone(o.img, Object.assign({ w: Math.round(iw * sc), ink: o.color, paper: C.paper, contrast: 1.5, gamma: 1.15, floor: .03, seed: o.seed }, o.ht || {}));
      g.drawImage(src, (Wc - iw * sc) / 2, (Hc - ih * sc) / 2, iw * sc, ih * sc); mottle(g, Wc, Hc, rnd, 6, .14); grainPass(g, Wc, Hc, rnd, 10); }
    else { g.fillStyle = o.color; g.fillRect(0, 0, Wc, Hc); texture(g, Wc, Hc, rnd); if (o.clouds) cloudsInto(g, 0, 0, Wc, Hc, o.seed + 40, o); }
    for (let b = 0; b < o.birds; b++) bird(g, m + o.w * (.45 + rnd() * .5), m + o.h * (.15 + rnd() * .45), 9 + rnd() * 13, (rnd() - .5) * .5, rnd());
    // the colour layer's own torn line sits slightly inside the rim: a hairline of darker ink where the print broke
    g.restore(); g.save(); poly(g, pts); g.strokeStyle = rgba(C.ink, .14); g.lineWidth = .8; g.stroke(); g.restore();
    // the tear front while it reveals: white paper core leads the colour by a few px, both on an irregular torn line
    const wc = cv(Wc, Hc), wg = wc.getContext('2d'); poly(wg, pts, rim); wg.fillStyle = C.white; wg.fill();
    const wrap = el('div', `left:${o.x - m}px;top:${o.y - m}px;width:${Wc}px;height:${Hc}px;z-index:${o.z};transform-origin:${o.from === 'right' ? Wc - m : m}px 50%`, parent);
    wrap.appendChild(wc); wrap.appendChild(c); wc.style.cssText = c.style.cssText = 'position:absolute;left:0;top:0';
    const J = 40, jag = Array.from({ length: J }, (_, i) => (vnoise(i * .45, 2, o.seed) - .5) * 44 + (hash(i, 9, o.seed) - .5) * 12), lead = Array.from({ length: J }, (_, i) => 4 + 7 * hash(i, 4, o.seed));
    const front = (X, add) => jag.map((j, i) => { const yy = i / (J - 1) * Hc, xx = o.from === 'right' ? Wc - X - j - add[i] : X + j + add[i]; return `${xx.toFixed(1)}px ${yy.toFixed(1)}px`; }).join(',');
    const zero = jag.map(() => 0);
    return { el: wrap, canvas: c, seek(t) { const p = K.step(t - o.at, ...P.UI), pc = clamp(p);
        wrap.style.display = t < o.at ? 'none' : 'block'; if (t < o.at) return;
        if (pc > .998) { c.style.clipPath = wc.style.clipPath = 'none'; wc.style.display = 'none'; }
        else { const X = m + pc * (o.w + m + 60), e0 = o.from === 'right' ? `${Wc}px 0` : '0 0', e1 = o.from === 'right' ? `${Wc}px ${Hc}px` : `0 ${Hc}px`; wc.style.display = 'block';
          c.style.clipPath = `polygon(${e0}, ${front(X, zero)}, ${e1})`; wc.style.clipPath = `polygon(${e0}, ${front(X, lead)}, ${e1})`; }
        const dr = drift(t, o.seed); wrap.style.transform = `translateY(${dr.y * 1.5 * o.drift}px) rotate(${o.angle + dr.r * .12 * o.drift}deg) scaleX(${.965 + .035 * p})`; } }; }
  // Tear-hole: an irregular hole grows through `page` (clip-path evenodd) with a white fibrous rim on top and a curled shadow under it.
  // Radius profile = low + mid frequency noise + sharp radial tear notches; rim width is in px (paper thickness), so it does not scale.
  function tearHole(o = {}) {
    o = Object.assign({ page: null, rimParent: null, cx: 960, cy: 540, r: 300, at: 0, seed: 4, w: 1920, h: 1080, spikes: 7, z: 20, aspect: .84 }, o);
    const N = 360, rnd = mulberry32(o.seed * 41 + 3), sp = Array.from({ length: o.spikes }, () => [rnd() * TAU, .08 + rnd() * .2, .035 + rnd() * .08]);
    const rr = [], rw = [], fib = [];
    for (let i = 0; i < N; i++) { const a = i / N * TAU, ca = Math.cos(a), sa = Math.sin(a);
      let v = 1 + .26 * (fbm(ca * 1.4 + 5, sa * 1.4 + 5, o.seed, 3) - .5) * 2 + .07 * (fbm(ca * 7 + 9, sa * 7 + 9, o.seed + 3, 3) - .5) * 2;
      for (const [s0, h, wd] of sp) { const da = Math.abs(((a - s0 + Math.PI) % TAU + TAU) % TAU - Math.PI); v += h * Math.max(0, 1 - da / wd) ** 1.6; } rr.push(v);
      rw.push(Math.max(.8, 5 + 11 * (fbm(i / 14, 3.3, o.seed + 9, 3) - .46) * 2 + 16 * Math.max(0, fbm(i / 38, 8.1, o.seed + 13, 2) - .58) * 2 + (rnd() - .5) * 2.5)); }
    for (let k = 0; k < 1100; k++) fib.push([rnd(), rnd(), rnd(), rnd()]);
    const jag = i => (hash(i, 1, o.seed) - .5) * 3.4 + (hash(i >> 2, 5, o.seed) - .5) * 2.2;
    const zp = parseInt(o.page.style.zIndex) || 0, shadowSvg = svgEl('svg', { width: o.w, height: o.h, style: `position:absolute;left:0;top:0;overflow:visible;z-index:${zp}` });
    o.page.parentNode.insertBefore(shadowSvg, o.page);
    const shPath = svgEl('path', { fill: 'none', stroke: C.ink, 'stroke-opacity': .62, 'stroke-width': 50, style: 'filter:blur(14px)' }, shadowSvg);
    const shTight = svgEl('path', { fill: 'none', stroke: C.ink, 'stroke-opacity': .5, 'stroke-width': 7, style: 'filter:blur(2.5px)' }, shadowSvg);
    const rimSvg = svgEl('svg', { width: o.w, height: o.h, style: `position:absolute;left:0;top:0;overflow:visible;z-index:${o.z}` }, o.rimParent || o.page.parentNode);
    const fuzz = svgEl('path', { fill: 'rgba(246,245,236,.75)', 'fill-rule': 'evenodd', style: 'filter:blur(1.3px)' }, rimSvg);
    const rimPath = svgEl('path', { fill: C.white, 'fill-rule': 'evenodd' }, rimSvg);
    const rimTone = svgEl('path', { fill: rgba(C.ink, .07), 'fill-rule': 'evenodd' }, rimSvg);   // rougher torn zone next to the print
    const rimShade = svgEl('path', { fill: 'none', stroke: C.ink, 'stroke-opacity': .2, 'stroke-width': .9 }, rimSvg);
    const fibG = svgEl('path', { fill: 'none', stroke: '#F7F6EE', 'stroke-width': .55, 'stroke-linecap': 'round', 'stroke-opacity': .9 }, rimSvg);
    const ring = (s, add) => { let d = ''; for (let i = 0; i < N; i++) { const a = i / N * TAU, R = rr[i] * s + add(i) + jag(i); d += (i ? 'L' : 'M') + (o.cx + Math.cos(a) * R).toFixed(1) + ' ' + (o.cy + Math.sin(a) * R * o.aspect).toFixed(1); } return d + 'Z'; };
    // paper tears in two jerks, not one smooth push; optional o.cues [{t, r}] tear in stages (a puncture, then the full hole)
    const jerk = dt => .62 * clamp(K.step(dt, ...P.UI), 0, 1.04) + .38 * clamp(K.step(dt - .2, ...P.UI), 0, 1.04);
    return { seek(t) {
        const s = (o.cues ? o.cues.reduce((a, c, i) => a + (c.r - (i ? o.cues[i - 1].r : 0)) * jerk(t - c.t), 0) : o.r * jerk(t - o.at)) * (1 + .004 * Math.sin(t * .9));
        if (s < 1) { o.page.style.clipPath = 'none'; rimSvg.style.display = shadowSvg.style.display = 'none'; return; }
        rimSvg.style.display = shadowSvg.style.display = 'block';
        const hole = ring(s, () => 0), edge = ring(s, i => rw[i]);
        o.page.style.clipPath = `path(evenodd, "M-400 -400H${o.w + 400}V${o.h + 400}H-400Z ${hole}")`;
        fuzz.setAttribute('d', ring(s, i => rw[i] + 1.4) + ' ' + ring(s, () => -1.6)); rimPath.setAttribute('d', edge + ' ' + hole);
        rimTone.setAttribute('d', edge + ' ' + ring(s, i => rw[i] * .45)); rimShade.setAttribute('d', edge);
        shPath.setAttribute('d', hole); shPath.setAttribute('transform', `translate(${light.x * 16} ${light.y * 20})`);
        shTight.setAttribute('d', hole); shTight.setAttribute('transform', `translate(${light.x * 3} ${light.y * 4})`);
        let fd = ''; for (const [u, v, w2, z] of fib) { const i = u * N | 0, a = i / N * TAU, R = rr[i] * s + jag(i) - .4, L = .8 + w2 * w2 * 5.5, b = a + Math.PI + (z - .5) * 1.6;
          const x0 = o.cx + Math.cos(a) * R, y0 = o.cy + Math.sin(a) * R * o.aspect; fd += `M${x0.toFixed(1)} ${y0.toFixed(1)}q${(Math.cos(b) * L * .5 + (v - .5) * 1.6).toFixed(1)} ${(Math.sin(b) * L * .5 + (v - .5) * 1.2).toFixed(1)} ${(Math.cos(b) * L).toFixed(1)} ${(Math.sin(b) * L).toFixed(1)}`; }
        fibG.setAttribute('d', fd); } }; }

  // ---------- flat disc (the one colour per scene) ----------
  function disc(parent, o = {}) {
    o = Object.assign({ x: 960, y: 540, r: 300, color: C.red, at: 0, seed: 3, z: 1, enter: 'pop', from: [0, 0], shadow: .4, drift: 1 }, o);
    const m = 40, S = 2 * (o.r + m), c = cv(S, S), g = ctx(c), rnd = mulberry32(o.seed * 59 + 1), N = 220;
    const path = () => { g.beginPath(); for (let i = 0; i <= N; i++) { const a = i / N * TAU, R = o.r + 2.2 * (fbm(Math.cos(a) * 2 + 4, Math.sin(a) * 2 + 4, o.seed, 3) - .5) * 2 + (hash(i, 2, o.seed) - .5) * .9;
      g[i ? 'lineTo' : 'moveTo'](S / 2 + Math.cos(a) * R, S / 2 + Math.sin(a) * R); } g.closePath(); };
    g.save(); g.filter = 'blur(6px)'; g.translate(light.x * 5, light.y * 7); path(); g.fillStyle = rgba(C.ink, o.shadow); g.fill(); g.restore();
    g.save(); path(); g.clip(); g.fillStyle = o.color; g.fillRect(0, 0, S, S); texture(g, S, S, rnd); g.restore();
    const wrap = el('div', `left:${o.x - S / 2}px;top:${o.y - S / 2}px;width:${S}px;height:${S}px;z-index:${o.z}`, parent); wrap.appendChild(c); c.style.cssText = 'position:absolute;left:0;top:0';
    return { el: wrap, seek(t) { const p = K.step(t - o.at, ...P.UI), q = K.step(t - o.at, ...P.BOX); wrap.style.display = t < o.at ? 'none' : 'block'; if (t < o.at) return;
        const dr = drift(t, o.seed), s = o.enter === 'pop' ? .55 + .45 * p : 1, dx = o.from[0] * (1 - q) + dr.x * 2 * o.drift, dy = o.from[1] * (1 - q) + dr.y * 2 * o.drift;
        wrap.style.opacity = o.enter === 'pop' ? clamp(p * 3) : 1; wrap.style.transform = `translate(${dx}px,${dy}px) scale(${s}) rotate(${dr.r * 2}deg)`; } }; }

  // ---------- marker (grease pencil) ----------
  function resample(pts, step) { const out = [pts[0]]; let acc = 0;
    for (let i = 1; i < pts.length; i++) { let [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i]; let d = Math.hypot(x1 - x0, y1 - y0);
      while (acc + d >= step) { const k = (step - acc) / d; x0 += (x1 - x0) * k; y0 += (y1 - y0) * k; out.push([x0, y0]); d = Math.hypot(x1 - x0, y1 - y0); acc = 0; } acc += d; }
    return out; }
  function markerPath(kind, b, rnd, seed) { const pts = [], n = 500, cx = b.x + b.w / 2, cy = b.y + b.h / 2, tr = u => (vnoise(u * 18, 1, seed) - .5) * 2.4;
    if (kind === 'loop') { const rx = b.w / 2 + b.pad, ry = b.h / 2 + b.pad * .8, a0 = -2.25 + (rnd() - .5) * .3, sweep = -TAU * 1.13, tilt = (rnd() - .5) * .14, ph = rnd() * TAU;
      for (let i = 0; i <= n; i++) { const u = i / n, th = a0 + sweep * u, gr = 1 + .075 * u, wb = 1 + .035 * Math.sin(3 * th + ph);
        let x = rx * gr * wb * Math.cos(th), y = ry * gr * wb * Math.sin(th); [x, y] = [x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt)];
        pts.push([cx + x + tr(u), cy + y + tr(u + 3)]); } }
    else if (kind === 'strike' || kind === 'underline') { const y0 = kind === 'strike' ? b.y + b.h * .56 : b.y + b.h + b.pad * .5, y1 = kind === 'strike' ? b.y + b.h * .46 : y0 - 4, x0 = b.x - b.pad * .6, x1 = b.x + b.w + b.pad;
      const passes = b.passes || (kind === 'strike' ? 2 : 1);
      for (let p = 0; p < passes; p++) { const fw = p % 2 === 0, off = p * 9; for (let i = 0; i <= n; i++) { const u = i / n, k = fw ? u : 1 - u;
          pts.push([x0 + (x1 - x0) * k + (p ? 6 : 0), y0 + (y1 - y0) * k - Math.sin(Math.PI * k) * 7 + off + tr(u + p * 2)]); } } }
    else if (kind === 'scribble') { const loops = b.loops || 8, R = b.h * .42;
      for (let i = 0; i <= n * 2; i++) { const u = i / (n * 2), th = u * TAU * loops + 2.2 * (vnoise(u * 6, 8, seed) - .5), ccx = b.x + b.w * (.14 + .72 * (u + .18 * Math.sin(u * 9.7))), rr = R * (.45 + .7 * vnoise(u * 11, 4, seed)), asp = .55 + .5 * vnoise(u * 5, 6, seed);
        pts.push([ccx + Math.cos(th) * rr * asp + Math.cos(th * 2.3 + 1) * R * .22 + tr(u), cy + Math.sin(th) * rr + Math.sin(th * 1.7) * R * .2 + (vnoise(u * 4, 9, seed) - .5) * R * .5 + tr(u + 5)]); } }
    else if (kind === 'arrow') { const x0 = b.x, y0 = b.y + b.h, x1 = b.x + b.w, y1 = b.y;
      for (let i = 0; i <= n; i++) { const u = i / n; pts.push([x0 + (x1 - x0) * u + tr(u), y0 + (y1 - y0) * u - Math.sin(Math.PI * u) * b.h * .25 + tr(u + 2)]); }
      const a = Math.atan2(y1 - y0 + b.h * .2, x1 - x0), L = 34; for (const s of [-1, 1]) { pts.push([x1, y1]); pts.push([x1 - Math.cos(a + s * .5) * L, y1 - Math.sin(a + s * .5) * L]); } }
    return pts; }
  function marker(parent, o = {}) {
    o = Object.assign({ kind: 'loop', box: { x: 800, y: 400, w: 300, h: 120 }, pts: null, pad: 26, at: 0, p: P.DRAW, width: 9, color: C.red, seed: 6, z: 12, blend: 'multiply', wobble: true }, o);
    const rnd = mulberry32(o.seed * 17 + 3), b = Object.assign({ pad: o.pad }, o.box), raw = o.pts || markerPath(o.kind, b, rnd, o.seed), P2 = resample(raw, 2.5), N = P2.length;
    const W = P2.map((_, i) => { const u = i / (N - 1); return o.width * (.45 + .55 * smooth(0, .06, u)) * (1 - .4 * smooth(.88, 1, u)) * (.82 + .36 * vnoise(u * 14, 7, o.seed)); });
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of P2) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const m = o.width * 2 + 12; x0 -= m; y0 -= m; x1 += m; y1 += m;
    const c = cv(x1 - x0, y1 - y0), g = c.getContext('2d'); c.style.cssText = `position:absolute;left:${x0}px;top:${y0}px;z-index:${o.z};mix-blend-mode:${o.blend}${o.wobble ? ';filter:url(#pk-wobble)' : ''}`;
    parent.appendChild(c);
    const holes = cv(c.width, c.height), hg = holes.getContext('2d'); hg.fillStyle = '#000';   // paper tooth showing through the wax
    for (let k = 0; k < c.width * c.height / 26; k++) { hg.globalAlpha = .25 + rnd() * .7; hg.beginPath(); hg.ellipse(rnd() * c.width, rnd() * c.height, .5 + rnd() * 1.3, .4 + rnd() * .6, rnd() * 3, 0, TAU); hg.fill(); }
    let lastP = -1;
    function draw(pr) { g.clearRect(0, 0, c.width, c.height); const nf = pr * (N - 1), n = Math.floor(nf); if (nf <= 0) return;
      g.strokeStyle = o.color; g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 0; i < Math.min(n, N - 1); i++) { g.lineWidth = (W[i] + W[i + 1]) / 2; g.beginPath(); g.moveTo(P2[i][0] - x0, P2[i][1] - y0); g.lineTo(P2[i + 1][0] - x0, P2[i + 1][1] - y0); g.stroke(); }
      if (n < N - 1) { const k = nf - n, a = P2[n], bb = P2[n + 1]; g.lineWidth = W[n]; g.beginPath(); g.moveTo(a[0] - x0, a[1] - y0); g.lineTo(a[0] + (bb[0] - a[0]) * k - x0, a[1] + (bb[1] - a[1]) * k - y0); g.stroke(); }
      g.globalCompositeOperation = 'destination-out'; g.drawImage(holes, 0, 0); g.globalCompositeOperation = 'source-over'; }
    return { el: c, seek(t) { const pr = clamp(K.step(t - o.at, ...o.p)), q = Math.round(pr * 2000) / 2000; c.style.display = pr <= 0 ? 'none' : 'block'; if (q !== lastP) { lastP = q; draw(q); } } }; }

  // ---------- rubber stamp + caution tape ----------
  function inkTexture(g, w, h, rnd, seed, k = 1) { const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (!d[i + 3]) continue;
      const blot = smooth(.5, .78, fbm(x / 46, y / 46, seed, 4)), fine = vnoise(x / 2.2, y / 2.2, seed + 3), hole = hash(x, y, seed) > .985 ? .85 : 0;
      d[i + 3] *= clamp(1 - k * (.45 * blot + .28 * smooth(.66, .92, fine) + hole)); }
    g.putImageData(id, 0, 0); }
  function stamp(parent, o = {}) {
    o = Object.assign({ text: 'SHIPPED', x: 1400, y: 300, size: 92, angle: -8, color: C.red, at: 0, seed: 5, z: 14, blend: 'multiply', border: true, sub: null }, o);
    const font = `400 ${o.size}px ${F.grotesk}`, mg = cv(4, 4).getContext('2d'); mg.font = font; mg.letterSpacing = (o.size * .03) + 'px';
    const tw = mg.measureText(o.text).width, cap = mg.measureText('H').actualBoundingBoxAscent, pad = o.size * .36, subS = o.size * .27, bw = tw + pad * 2, bh = cap + pad * 1.6 + (o.sub ? subS * 1.6 : 0);
    const m = 30, c = cv(bw + 2 * m, bh + 2 * m), g = ctx(c), rnd = mulberry32(o.seed * 7 + 1);
    g.fillStyle = g.strokeStyle = o.color; g.font = font; g.letterSpacing = (o.size * .03) + 'px'; g.textAlign = 'center';
    if (o.border) { const lw = o.size * .075; g.lineWidth = lw; g.beginPath(); g.roundRect(m + lw / 2, m + lw / 2, bw - lw, bh - lw, o.size * .12); g.stroke();
      g.lineWidth = o.size * .025; g.beginPath(); g.roundRect(m + lw * 2.1, m + lw * 2.1, bw - lw * 4.2, bh - lw * 4.2, o.size * .07); g.stroke(); }
    g.fillText(o.text, m + bw / 2, m + pad * .8 + cap); if (o.sub) { g.font = `700 ${subS}px ${F.mono}`; g.letterSpacing = (subS * .25) + 'px'; g.fillText(o.sub, m + bw / 2, m + pad * .8 + cap + subS * 1.7); }
    inkTexture(g, c.width, c.height, rnd, o.seed);
    const wrap = el('div', `left:${o.x - c.width / 2}px;top:${o.y - c.height / 2}px;width:${c.width}px;height:${c.height}px;z-index:${o.z};mix-blend-mode:${o.blend}`, parent); wrap.appendChild(c); c.style.cssText = 'position:absolute;left:0;top:0';
    return { el: wrap, seek(t) { wrap.style.display = t < o.at ? 'none' : 'block'; if (t < o.at) return;
        const p = K.step(t - o.at, ...P.STAMP), f = Math.floor((t - o.at - .085) * 30), sh = f === 0 ? [5, -3] : f === 1 ? [-4, 2] : [0, 0];
        const dr = drift(t, o.seed); wrap.style.opacity = clamp(p * 4); wrap.style.transform = `translate(${sh[0] + dr.x * .8}px,${sh[1] + dr.y * .6}px) rotate(${o.angle + (1 - p) * 5}deg) scale(${1.4 - .4 * p})`; } }; }
  function tape(parent, o = {}) {
    o = Object.assign({ text: 'DO NOT OPEN', x: 960, y: 540, w: 2400, h: 92, angle: -7, color: C.red, ink: C.paper, at: 0, seed: 8, z: 16, from: -1 }, o);
    const m = 30, c = cv(o.w + 2 * m, o.h + 2 * m), g = ctx(c), rnd = mulberry32(o.seed * 5 + 2), st = 6;
    const top = [], bot = []; for (let x = 0; x <= o.w; x += st) { top.push([m + x, m + (vnoise(x / 30, 1, o.seed) - .5) * 2.4]); bot.push([m + x, m + o.h + (vnoise(x / 30, 2, o.seed) - .5) * 2.4]); }
    const shape = () => { g.beginPath(); top.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](...p)); for (let k = 0; k <= 8; k++) g.lineTo(m + o.w + (k % 2 ? -9 : 0), m + o.h * k / 8);
      [...bot].reverse().forEach(p => g.lineTo(...p)); for (let k = 8; k >= 0; k--) g.lineTo(m + (k % 2 ? 9 : 0), m + o.h * k / 8); g.closePath(); };
    g.save(); g.filter = 'blur(6px)'; g.translate(light.x * 6, light.y * 9); shape(); g.fillStyle = rgba(C.ink, .5); g.fill(); g.restore();
    g.save(); shape(); g.clip(); g.fillStyle = o.color; g.fillRect(0, 0, c.width, c.height); texture(g, c.width, c.height, rnd);
    g.fillStyle = o.ink; g.font = `400 ${o.h * .48}px ${F.grotesk}`; g.letterSpacing = (o.h * .04) + 'px'; g.textBaseline = 'middle';
    const unit = o.text + '   ●   ', uw = g.measureText(unit).width; for (let x = m - uw * rnd(); x < c.width; x += uw) g.fillText(unit, x, m + o.h * .54);
    const sh = g.createLinearGradient(0, m, 0, m + o.h); sh.addColorStop(0, 'rgba(255,255,255,.16)'); sh.addColorStop(.35, 'rgba(255,255,255,0)'); sh.addColorStop(.8, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.14)'); g.fillStyle = sh; g.fillRect(0, 0, c.width, c.height);
    for (let k = 0; k < 9; k++) { const x = m + rnd() * o.w; g.fillStyle = rnd() < .5 ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.08)'; g.beginPath(); g.moveTo(x, m); g.lineTo(x + 26 + rnd() * 30, m); g.lineTo(x + 6 + rnd() * 20, m + o.h); g.lineTo(x - 14, m + o.h); g.fill(); }
    g.restore();
    const wrap = el('div', `left:${o.x - c.width / 2}px;top:${o.y - c.height / 2}px;width:${c.width}px;height:${c.height}px;z-index:${o.z};transform-origin:50% 50%`, parent); wrap.appendChild(c); c.style.cssText = 'position:absolute;left:0;top:0';
    return { el: wrap, seek(t) { wrap.style.display = t < o.at ? 'none' : 'block'; if (t < o.at) return; const p = K.step(t - o.at, ...P.UI), f = Math.floor((t - o.at - .16) * 30);
        const sh2 = f === 0 ? 4 : f === 1 ? -3 : 0, a = o.angle * Math.PI / 180, d = o.from * (1 - p) * (o.w + 400), dr = drift(t, o.seed);
        wrap.style.transform = `translate(${d * Math.cos(a)}px,${d * Math.sin(a) + sh2 + dr.y}px) rotate(${o.angle + (1 - p) * 2}deg) scaleY(${.86 + .14 * p})`; } }; }

  // ---------- scissor trace ----------
  function contourOf(c, step = 3) {   // Moore-neighbour trace of the largest alpha blob, in canvas px
    const W = c.width, H = c.height, d = ctx(c).getImageData(0, 0, W, H).data, gw = Math.ceil(W / step) + 2, gh = Math.ceil(H / step) + 2, B = new Uint8Array(gw * gh);
    for (let gy = 1; gy < gh - 1; gy++) for (let gx = 1; gx < gw - 1; gx++) { const x = Math.min(W - 1, (gx - 1) * step), y = Math.min(H - 1, (gy - 1) * step); B[gy * gw + gx] = d[(y * W + x) * 4 + 3] > 128 ? 1 : 0; }
    const lab = new Int32Array(gw * gh); let best = 0, bestN = 0, cur = 0;
    for (let i = 0; i < B.length; i++) if (B[i] && !lab[i]) { cur++; let n = 0; const st = [i]; lab[i] = cur;
      while (st.length) { const j = st.pop(); n++; for (const k of [j - 1, j + 1, j - gw, j + gw]) if (B[k] && !lab[k]) { lab[k] = cur; st.push(k); } }
      if (n > bestN) { bestN = n; best = cur; } }
    let s = -1; for (let i = 0; i < B.length; i++) { B[i] = lab[i] === best ? 1 : 0; if (B[i] && s < 0) s = i; }
    const OFF = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]], pts = [];
    let px = s % gw, py = s / gw | 0, bx = px - 1, by = py; const sx = px, sy = py;
    for (let it = 0; it < 400000; it++) { pts.push([px, py]); const bi = OFF.findIndex(q => px + q[0] === bx && py + q[1] === by); let found = false;
      for (let k = 1; k <= 8; k++) { const idx = (bi + k) % 8, qx = px + OFF[idx][0], qy = py + OFF[idx][1];
        if (B[qy * gw + qx]) { const pi = (bi + k + 7) % 8; bx = px + OFF[pi][0]; by = py + OFF[pi][1]; px = qx; py = qy; found = true; break; } }
      if (!found || (px === sx && py === sy)) break; }
    return pts.map(([x, y]) => [(x - 1) * step, (y - 1) * step]); }
  function smoothClosed(pts, win) { const n = pts.length, out = []; for (let i = 0; i < n; i++) { let x = 0, y = 0; for (let k = -win; k <= win; k++) { const p = pts[(i + k + n) % n]; x += p[0]; y += p[1]; } out.push([x / (2 * win + 1), y / (2 * win + 1)]); } return out; }
  function scissor(cut, o = {}) {
    o = Object.assign({ at: 0, dur: 1.1, color: C.red, dash: [15, 11], width: 4, offset: 7, lift: 1.15, fade: true, size: 1.7, span: [0, 1], halo: .55 }, o);
    let pts = smoothClosed(smoothClosed(smoothClosed(contourOf(cut.img, 3), 5), 5), 3); pts = resample(pts.concat([pts[0]]), 4);
    const n = pts.length, cx = pts.reduce((a, p) => a + p[0], 0) / n, cy = pts.reduce((a, p) => a + p[1], 0) / n;
    const nrm = pts.map((p, i) => { const a = pts[(i - 2 + n) % n], b = pts[(i + 2) % n], tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1; return [ty / L, -tx / L]; });
    const flip = nrm.reduce((a, q, i) => a + q[0] * (pts[i][0] - cx) + q[1] * (pts[i][1] - cy), 0) < 0 ? -1 : 1;
    const op = pts.map((p, i) => [p[0] + nrm[i][0] * o.offset * flip, p[1] + nrm[i][1] * o.offset * flip]);
    const d = 'M' + op.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L'); let len = 0; for (let i = 1; i < op.length; i++) len += Math.hypot(op[i][0] - op[i - 1][0], op[i][1] - op[i - 1][1]);
    const id = 'pkcut' + (++uid), svg = svgEl('svg', { width: cut.W, height: cut.H, style: 'position:absolute;left:0;top:0;overflow:visible' }, cut.el);
    const mk = svgEl('mask', { id, maskUnits: 'userSpaceOnUse', x: -200, y: -200, width: cut.W + 400, height: cut.H + 400 }, svgEl('defs', {}, svg));
    const mp = svgEl('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 18, 'stroke-dasharray': `${len} ${len}`, 'stroke-dashoffset': len }, mk);
    if (o.halo) svgEl('path', { d, fill: 'none', stroke: C.paper, 'stroke-opacity': o.halo, 'stroke-width': o.width + 4, 'stroke-dasharray': o.dash.join(' '), 'stroke-linecap': 'round', mask: `url(#${id})` }, svg);   // keeps the dashes legible on red
    svgEl('path', { d, fill: 'none', stroke: o.color, 'stroke-width': o.width, 'stroke-dasharray': o.dash.join(' '), 'stroke-linecap': 'round', mask: `url(#${id})` }, svg);
    const sc = svgEl('g', {}, svg), sg = svgEl('g', { transform: `scale(${o.size}) translate(-12 0)` }, sc), blades = [];   // scissors: crotch rides the leading point
    for (const s of [-1, 1]) { const gb = svgEl('g', {}, sg); svgEl('path', { d: 'M-3 -1.5 L44 -2.2 Q48 0 44 2.4 L-3 4 Z', fill: C.paper, stroke: C.ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, gb);
      svgEl('path', { d: 'M0 1 L-19 2', stroke: C.ink, 'stroke-width': 5, 'stroke-linecap': 'round' }, gb); svgEl('ellipse', { cx: -30, cy: 3, rx: 11, ry: 8, fill: 'none', stroke: o.color, 'stroke-width': 5 }, gb); blades.push([gb, s]); }
    svgEl('circle', { cx: 0, cy: 0, r: 2.6, fill: C.ink }, sg);
    cut.addLift(o.at + o.dur, o.lift);
    const k = (6.6 / o.dur) ** 2, dmp = 2 * 6.6 / o.dur;   // critically damped spring that settles in ~dur
    return { el: svg, seek(t) { const p = clamp(K.step(t - o.at, k, dmp)); svg.style.display = t < o.at ? 'none' : 'block'; if (t < o.at) return;
        const u = o.span[0] + (o.span[1] - o.span[0]) * p; mp.setAttribute('stroke-dasharray', `${(u - o.span[0]) * len} ${len * 3}`); mp.setAttribute('stroke-dashoffset', -o.span[0] * len);
        const fi = Math.min(op.length - 2, Math.floor((u % 1) * (op.length - 1))), a = op[fi], b = op[fi + 1];
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, open = p < .995 ? 7 + 11 * Math.abs(Math.sin((t - o.at) * 26)) : 4;
        blades.forEach(([gb, s]) => gb.setAttribute('transform', `rotate(${s * open})`)); sc.setAttribute('transform', `translate(${a[0]} ${a[1]}) rotate(${ang})`);
        sc.style.opacity = 1 - clamp((t - o.at - o.dur - .1) / .25); svg.style.opacity = o.fade ? 1 - .7 * clamp(K.step(t - o.at - o.dur - .5, ...P.BOX)) : 1; } }; }

  // ---------- counter ----------
  function counter(parent, o = {}) {
    o = Object.assign({ to: 63000, from: 0, at: 0, x: 960, y: 540, size: 220, font: 'grotesk', color: C.ink, p: P.COUNT, align: 'left', prefix: '', suffix: '', z: 8, ls: '-0.02em', seed: 11, print: true }, o);
    const font = fcss({ font: o.font, size: o.size }), dw = Math.max(...'0123456789'.split('').map(ch => measure(font, ch).width));
    const fmt = v => o.prefix + Math.round(v).toLocaleString('en-US') + o.suffix, final = fmt(o.to);
    const box = el('div', `left:${o.x}px;top:${o.y - baseline(font)}px;font:${font};line-height:1;white-space:nowrap;color:${o.color};letter-spacing:${o.ls};z-index:${o.z}`, parent);
    const span = ch => /\d/.test(ch) ? `<span style="display:inline-block;width:${dw}px;text-align:center">${ch}</span>` : ch;
    box.innerHTML = final.split('').map(span).join(''); const W = box.offsetWidth; const left = o.align === 'center' ? o.x - W / 2 : o.align === 'right' ? o.x - W : o.x; box.style.left = left + 'px';
    const inner = el('div', `right:0;top:0;white-space:nowrap`, box); if (o.print) printed(inner); box.style.width = W + 'px'; box.style.height = o.size + 'px'; let last = '';
    return { el: box, seek(t) { const p = clamp(K.step(t - o.at, ...o.p)), s = p > .9995 ? final : fmt(o.from + (o.to - o.from) * p);
        if (s !== last) { last = s; box.innerHTML = ''; box.appendChild(inner); inner.innerHTML = s.split('').map(span).join(''); }
        const e = K.step(t - o.at + .06, ...P.HEAVY), ec = clamp(e), dr = drift(t, o.seed); box.style.visibility = t < o.at - .06 ? 'hidden' : 'inherit';
        box.style.opacity = clamp(ec * 1.6); box.style.filter = ec < .99 ? `blur(${10 * (1 - ec)}px)` : 'none'; box.style.transform = `translate(${dr.x * .8}px,${(1 - e) * 18 + dr.y * .6}px)`; } }; }

  // ---------- screen-space overlay: photocopy grain (re-seeded at 12 fps) + edge vignette ----------
  function overlay(stage, o = {}) {
    o = Object.assign({ w: 1920, h: 1080, grain: .5, vignette: .25, fps: 12, seed: 9, z: 90 }, o);
    const B = 256, c = cv(o.w + B, o.h + B), g = ctx(c), id = g.createImageData(c.width, c.height), d = id.data, rnd = mulberry32(o.seed * 101 + 1);
    for (let i = 0; i < d.length; i += 4) { const v = 128 + (rnd() - .5) * 46 + (rnd() < .0016 ? -90 : 0); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    g.putImageData(id, 0, 0);
    // Both layers sit straight in the stage: a wrapper with a z-index would be its own stacking context and the blends would see nothing.
    c.style.cssText = `position:absolute;left:0;top:0;mix-blend-mode:overlay;opacity:${o.grain};pointer-events:none;z-index:${o.z}`; stage.appendChild(c);
    const vg = el('div', `left:0;top:0;width:${o.w}px;height:${o.h}px;pointer-events:none;z-index:${o.z + 1};mix-blend-mode:multiply;opacity:${o.vignette};background:radial-gradient(ellipse 72% 72% at 50% 48%, rgba(22,32,31,0) 58%, rgba(22,32,31,.42) 100%)`, stage);
    return { el: c, vignette: vg, seek(t) { const f = Math.floor(t * o.fps + 1e-6); c.style.transform = `translate(${-(hash(f, 1, o.seed) * B | 0)}px,${-(hash(f, 2, o.seed) * B | 0)}px)`; } }; }

  K.paper = { C, F, P, light, ready, listDir, loadImage, halftone, colourCut, silhouette, placeholder, drift, fbm, vnoise, hash, el, cv, svgEl,
    ground, overlay, camera, scene, cutout, words, tuck, masthead, label, tornStrip, tearHole, disc, marker, stamp, tape, scissor, counter, contourOf, archivo: false };
  const R = (name, doc, fn) => K.register(name, { needs: [], doc, create: (stage, o) => fn(stage, o) });
  R('paper-ground', 'cream paper (grain, folds, speckle) or deep-teal newsprint; baked once', ground);
  R('paper-overlay', 'screen-space photocopy grain at 12 fps + edge vignette, top of the stack', overlay);
  R('paper-camera', 'world container: blur-scroll between scenes (vertical blur from spring velocity) + slow push-in', camera);
  R('paper-cutout', 'halftone/colour cut-out with lift shadow; tumble, rise, slide, drop; stepped 12 fps option', cutout);
  R('paper-words', 'blur-to-sharp words, HEAVY, 80 ms stagger', words);
  R('paper-tuck', 'big italic serif word with a small grotesk word tucked at its shoulder', tuck);
  R('paper-masthead', 'huge Instrument Serif word that builds letter by letter, sits behind a cut-out', masthead);
  R('paper-label', 'JetBrains Mono label that types on', label);
  R('paper-strip', 'torn colour strip with white fibrous edges, torn-edge wipe reveal', tornStrip);
  R('paper-tear-hole', 'irregular torn hole grows through a page (needs opts.page)', (stage, o) => tearHole(Object.assign({ rimParent: stage }, o)));
  R('paper-disc', 'flat textured colour disc (the one colour per scene)', disc);
  R('paper-marker', 'vermilion grease-pencil loop / strike / scribble / underline / arrow drawn on a spring', marker);
  R('paper-stamp', 'rubber stamp, scale 1.4 -> 1 with a 2-frame shake, ink texture', stamp);
  R('paper-tape', 'caution tape slapping across at an angle', tape);
  R('paper-scissor', 'dashed red line traced round a cut-out (needs opts.cut), then the piece lifts', (stage, o) => scissor(o.cut, o));
  R('paper-counter', 'Archivo Black number ticking to a target with commas', counter);
})();
