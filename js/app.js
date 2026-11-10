import { Chess } from '../assets/lib/chess.js';
const $ = s => document.querySelector(s);
const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const SYM = { brilliant: '!!', best: '★', inaccuracy: '?!', mistake: '?', blunder: '??' };
const ENG = { lite: 'assets/engine/stockfish-18-lite-single.js', full: 'assets/engine/stockfish-18-single.js' };
const OPERA = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8# 1-0';
const st = { fens: [], mv: [], ev: [], cls: [], ply: 0, flip: false, from: null, tryMode: false };
const win = cp => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

const snd = {};
for (const n of ['move', 'capture', 'check', 'end', 'brilliant', 'blunder']) snd[n] = new Audio(`assets/sfx/${n}.mp3`);
const play = n => { if (!$('#snd').checked) return; const a = snd[n]; a.currentTime = 0; a.play().catch(() => {}); };
const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 1800); };

class Engine {
  constructor(url) {
    this.w = new Worker(url);
    this.ready = new Promise(r => (this.r = r));
    this.w.onmessage = e => this.msg(String(e.data));
    this.w.postMessage('uci');
  }
  msg(l) {
    if (l === 'uciok') this.w.postMessage('isready');
    else if (l === 'readyok') this.r();
    else if (this.q) {
      const m = l.match(/score (cp|mate) (-?\d+)/);
      if (l.startsWith('info') && m && !/bound/.test(l)) this.q.s = m[1] === 'mate' ? Math.sign(m[2]) * (10000 - Math.abs(m[2])) : +m[2];
      if (l.startsWith('bestmove')) { const q = this.q; this.q = null; q.done({ best: l.split(' ')[1], cp: q.s }); }
    }
  }
  go(fen, depth) {
    return new Promise(done => { this.q = { s: 0, done }; this.w.postMessage('position fen ' + fen); this.w.postMessage('go depth ' + depth); });
  }
}

function load(text) {
  const c = new Chess();
  try { c.loadPgn(text); } catch (e) { toast('Could not read this PGN'); return false; }
  const hist = c.history({ verbose: true });
  const r = new Chess(); const fens = [r.fen()];
  for (const m of hist) { r.move(m.san); fens.push(r.fen()); }
  Object.assign(st, { fens, mv: hist, ev: [], cls: [], ply: 0 });
  $('#summary').innerHTML = ''; $('#try').disabled = true;
  renderMoves(); show(0); drawGraph();
  return true;
}

async function analyze() {
  if (!load($('#pgn').value)) return;
  const btn = $('#go'), prog = $('#prog'); btn.disabled = true; prog.hidden = false; prog.max = st.fens.length;
  let eng;
  try {
    eng = new Engine(ENG[$('#eng').value]);
    await Promise.race([eng.ready, new Promise((_, j) => setTimeout(() => j(), 20000))]);
  } catch { toast('Engine files not found: run scripts/fetch-assets.sh'); btn.disabled = false; prog.hidden = true; return; }
  const depth = +$('#depth').value;
  for (let i = 0; i < st.fens.length; i++) {
    const c = new Chess(st.fens[i]);
    if (c.isCheckmate()) st.ev[i] = { best: null, cp: c.turn() === 'w' ? -10000 : 10000 };
    else if (c.isGameOver()) st.ev[i] = { best: null, cp: 0 };
    else { const r = await eng.go(st.fens[i], depth); if (c.turn() === 'b') r.cp = -r.cp; st.ev[i] = r; }
    prog.value = i + 1; drawGraph();
    if (i === st.ply) show(st.ply, true);
  }
  eng.w.terminate(); classify(); prog.hidden = true; btn.disabled = false; $('#try').disabled = false;
  renderMoves(); drawGraph(); show(st.ply, true);
}

function classify() {
  const tally = {};
  st.cls = st.mv.map((m, i) => {
    const s = m.color === 'w' ? 1 : -1, wb = win(s * st.ev[i].cp), wa = win(s * st.ev[i + 1].cp), drop = Math.max(0, wb - wa);
    const uci = m.from + m.to + (m.promotion || '');
    let k = uci === st.ev[i].best ? 'best' : drop <= 2 ? 'excellent' : drop <= 5 ? 'good' : drop <= 10 ? 'inaccuracy' : drop <= 20 ? 'mistake' : 'blunder';
    const after = new Chess(st.fens[i + 1]);
    const hanging = after.moves({ verbose: true }).some(o => o.to === m.to && o.captured);
    if (drop <= 2 && hanging && V[m.piece] > (V[m.captured] || 0) && m.piece !== 'p' && wa >= 45 && wb < 92) k = 'brilliant';
    tally[k] = (tally[k] || 0) + 1; return k;
  });
  $('#summary').innerHTML = Object.entries(tally).map(([k, n]) => `<span>${k} ${n}</span>`).join('');
}

function renderMoves() {
  const box = $('#moves'); box.innerHTML = '';
  st.mv.forEach((m, i) => {
    if (i % 2 === 0) box.insertAdjacentHTML('beforeend', `<span class="n">${i / 2 + 1}.</span>`);
    const b = document.createElement('button'); const k = st.cls[i];
    b.className = k || ''; b.dataset.p = i + 1; b.textContent = m.san + (SYM[k] || '');
    b.onclick = () => show(i + 1); box.append(b);
  });
}

function show(ply, quiet) {
  const prev = st.ply; st.ply = ply = Math.max(0, Math.min(ply, st.fens.length - 1)); st.from = null;
  const c = new Chess(st.fens[ply]), board = $('#board'); board.innerHTML = '';
  const m = st.mv[ply - 1], k = st.cls[ply - 1];
  const rows = c.board(); const order = [...Array(8).keys()]; if (st.flip) order.reverse();
  for (const r of order) for (const f of order) {
    const col = st.flip ? 7 - f : f; const p = rows[r][col]; const name = 'abcdefgh'[col] + (8 - r);
    const d = document.createElement('div'); d.className = 'sq' + ((r + col) % 2 ? ' d' : ''); d.dataset.sq = name;
    if (m && (m.from === name || m.to === name)) d.classList.add('last');
    if (p) d.innerHTML = `<img alt="" src="assets/pieces/${p.color}${p.type.toUpperCase()}.svg">`;
    if (m && m.to === name && k && SYM[k]) { d.insertAdjacentHTML('beforeend', `<span class="badge ${k}">${SYM[k]}</span>`); if (k === 'brilliant' && !quiet) d.classList.add('pulse'); }
    d.onclick = () => tap(name); board.append(d);
  }
  document.querySelectorAll('.moves button').forEach(b => b.classList.toggle('on', +b.dataset.p === ply));
  document.querySelector('.moves button.on')?.scrollIntoView({ block: 'nearest' });
  const e = st.ev[ply]; if (e) {
    $('#evalfill').style.height = win(e.cp) + '%';
    $('#evaltxt').textContent = Math.abs(e.cp) > 9000 ? 'M' : (e.cp / 100).toFixed(1);
  }
  drawArrow(); drawGraph();
  if (quiet || ply !== prev + 1 || !m) return;
  if (k === 'brilliant') { play('brilliant'); burst(m.to); toast('Brilliant move!'); }
  else if (k === 'blunder') { play('blunder'); $('#boardwrap').classList.remove('shake'); void $('#boardwrap').offsetWidth; $('#boardwrap').classList.add('shake'); }
  else play(m.san.includes('#') ? 'end' : m.san.includes('+') ? 'check' : m.captured ? 'capture' : 'move');
}

function drawArrow() {
  const svg = $('#arrow'); svg.innerHTML = ''; const b = st.ev[st.ply]?.best;
  if (!b || !$('#best').checked) return;
  const pt = s => { const f = s.charCodeAt(0) - 97, r = 8 - +s[1]; return [(st.flip ? 7 - f : f) + .5, (st.flip ? 7 - r : r) + .5]; };
  const [x1, y1] = pt(b.slice(0, 2)), [x2, y2] = pt(b.slice(2, 4));
  svg.innerHTML = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#26c9c3" stroke-width=".16" stroke-linecap="round" opacity=".85"/><circle cx="${x2}" cy="${y2}" r=".24" fill="#26c9c3" opacity=".85"/>`;
}

function burst(sq) {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const cv = $('#fx'), w = cv.width = cv.offsetWidth, h = cv.height = cv.offsetHeight, x = ((sq.charCodeAt(0) - 97 + .5) / 8), y = ((8 - +sq[1] + .5) / 8);
  const cx = (st.flip ? 1 - x : x) * w, cy = (st.flip ? 1 - y : y) * h, g = cv.getContext('2d'), t0 = performance.now();
  const ps = Array.from({ length: 60 }, () => { const a = Math.random() * 6.28, v = 1 + Math.random() * 4; return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: Math.random() < .5 ? '#26c9c3' : '#d6a84f' }; });
  (function f(t) {
    const k = (t - t0) / 1100; g.clearRect(0, 0, w, h); if (k >= 1) return;
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += .08; g.globalAlpha = 1 - k; g.fillStyle = p.c; g.fillRect(p.x, p.y, 4, 4); }
    requestAnimationFrame(f);
  })(t0);
}

function drawGraph() {
  const cv = $('#graph'), w = cv.width = cv.offsetWidth * devicePixelRatio, h = cv.height = 90 * devicePixelRatio, g = cv.getContext('2d');
  g.fillStyle = '#12141c'; g.fillRect(0, h / 2, w, 1); const n = st.fens.length - 1; if (n < 1) return;
  const X = i => (i / n) * w, Y = i => h - (win(st.ev[i].cp) / 100) * h;
  g.beginPath(); g.moveTo(0, h);
  st.ev.forEach((e, i) => e && g.lineTo(X(i), Y(i))); g.lineTo(X(st.ev.length - 1), h); g.fillStyle = '#e9e6dd'; g.fill();
  g.fillStyle = '#d6a84f'; g.fillRect(X(st.ply) - 1, 0, 2 * devicePixelRatio, h);
  st.cls.forEach((k, i) => { if (k === 'brilliant') { g.fillStyle = '#26c9c3'; g.beginPath(); g.arc(X(i + 1), Y(i + 1), 5 * devicePixelRatio, 0, 6.28); g.fill(); } });
}

function tap(sq) {
  if (!st.tryMode) return;
  const c = new Chess(st.fens[st.ply]), p = c.get(sq);
  if (!st.from) { if (p && p.color === c.turn()) { st.from = sq; document.querySelector(`[data-sq=${sq}]`).classList.add('sel'); } return; }
  const guess = st.from + sq; st.from = null; document.querySelectorAll('.sel').forEach(e => e.classList.remove('sel'));
  const best = st.ev[st.ply]?.best;
  if (best && best.startsWith(guess)) { toast('That is the engine move!'); play('brilliant'); burst(sq); st.tryMode = false; $('#try').textContent = 'Find the best move'; }
  else { toast('Not the best move. Try again.'); play('blunder'); }
}

$('#go').onclick = analyze;
$('#try').onclick = () => { st.tryMode = !st.tryMode; $('#try').textContent = st.tryMode ? 'Stop practice' : 'Find the best move'; if (st.tryMode) toast('Select a piece, then its square'); };
$('#flip').onclick = () => { st.flip = !st.flip; show(st.ply, true); };
$('#first').onclick = () => show(0, true); $('#last').onclick = () => show(st.fens.length - 1, true);
$('#prev').onclick = () => show(st.ply - 1, true); $('#next').onclick = () => show(st.ply + 1);
$('#best').onchange = drawArrow; $('#depth').oninput = e => ($('#dv').textContent = e.target.value);
$('#graph').onclick = e => { const r = e.target.getBoundingClientRect(); show(Math.round(((e.clientX - r.left) / r.width) * (st.fens.length - 1)), true); };
addEventListener('keydown', e => { if (e.target.matches('textarea,select')) return; if (e.key === 'ArrowRight') show(st.ply + 1); if (e.key === 'ArrowLeft') show(st.ply - 1, true); });
addEventListener('resize', drawGraph);
$('#pgn').value = OPERA; load(OPERA);
