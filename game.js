import * as THREE from './three.module.js';
const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const STAGE = +(q.get('stage') || 0);        // 테스트용: 스크립트 진행 단계
const TEST = STAGE !== 0;
const SAVE_KEY = 'cb2.save.v1';
const SAVE_DEF = () => ({ plays: 0, clears: 0, coins: 0, props: 0, visits: {}, bestTime: {}, wl: [1, 1, 1], dex: {}, shots: 0, hits: 0, hist: [], zone: 2, unlocked: [2] });
function loadSave() { try { const o = Object.assign(SAVE_DEF(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); if (!Array.isArray(o.wl) || o.wl.length !== 3) o.wl = [1, 1, 1]; if (!o.dex || typeof o.dex !== 'object') o.dex = {}; if (!Array.isArray(o.hist)) o.hist = []; return o; } catch (e) { return SAVE_DEF(); } }
function writeSave(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { } }
const save = loadSave();
if (!Array.isArray(save.unlocked) || !save.unlocked.length) save.unlocked = [2];
const ZONE = +(q.get('zone') || save.zone || 2);
const nextZone = z => z % 8 + 1;
const VISIT = +(q.get('visit') || ((save.visits[ZONE] || 0) + 1));

const THEMES = [
  { n: '술창고', p: ['barrel_large', 'barrel_small', 'barrel_small_stack', 'keg', 'bottle_A_green', 'bottle_B_brown', 'box_small'], fl: 'floor_dirt_large', c: 0xffb060 },
  { n: '보물방', p: ['chest', 'chest_gold', 'coin_stack_large', 'coin_stack_medium', 'key', 'box_small'], fl: 'floor_tile_large', c: 0xfff4a8 },
  { n: '연회장', p: ['table_long', 'table_medium', 'chair', 'stool', 'plate_food_A', 'candle_triple', 'bottle_A_green'], fl: 'floor_tile_large', c: 0xff9a50 },
  { n: '무너진 회랑', p: ['rubble_large', 'rubble_half', 'crates_stacked', 'box_large', 'column', 'barrel_small'], fl: 'floor_dirt_large', c: 0xa0b8ff },
  { n: '기둥의 방', p: ['pillar', 'column', 'candle_triple', 'chest', 'box_small', 'coin_stack_medium'], fl: 'floor_tile_large', c: 0xb0a0ff },
  { n: '침실과 서재', p: ['bed_frame', 'shelf_large', 'shelf_small', 'chair', 'table_medium', 'candle_triple', 'bottle_B_brown'], fl: 'floor_tile_large', c: 0xff98c0 },
  { n: '창고', p: ['box_stacked', 'crates_stacked', 'box_large', 'box_small', 'barrel_large', 'barrel_small_stack'], fl: 'floor_dirt_large', c: 0x9fe8b8 },
  { n: '무기고', p: ['shelf_large', 'shelf_small', 'crates_stacked', 'box_large', 'keg'], fl: 'floor_tile_large', c: 0xff5a48 }];
const T = THEMES[(ZONE - 1) % 8];
const MOVEP = {   // 종류별 이동 패턴(속도 배율, 평균 약 1)
  rogue: t => Math.sin(t * 2.6) > .2 ? 1.7 : .5, skelrogue: t => Math.sin(t * 2.6) > .2 ? 1.7 : .5,
  knight: () => .85, skelwar: () => .85, skelminion: () => 1.25, barbarian: t => 1 + .25 * Math.sin(t * 1.7), mage: t => 1 + .35 * Math.sin(t * .9), skelmage: t => 1 + .35 * Math.sin(t * .9) };
let hitStop = 0, chainN = 0, chainT = 0;
const ZRULES = [
  { t: '장전이 빠르다', rl: .8 }, { t: '코인 +50%, 수호자 약간 빠름', coin: 1.5, spd: 1.1 },
  { t: '게이지가 빨리 찬다', gg: 1.6 }, { t: '수호자가 빠르다, 6초 안에 연속 파괴하면 보너스 코인', spd: 1.25, chain: 1 },
  { t: '방어 시간이 짧다, 수호자 약간 빠름', blk: .8, spd: 1.1 }, { t: '장전 느림, 게이지 빠름', rl: 1.3, gg: 1.3 },
  { t: '코인 +30%, 게이지 약간 빨리 참', coin: 1.3, gg: 1.2 }, { t: '수호자 빠름, 방어 짧음, 장전 약간 빠름, 6초 안에 연속 파괴하면 보너스 코인', spd: 1.15, blk: .85, rl: .9, chain: 1 }];
const ZR = ZRULES[(ZONE - 1) % 8];
let s = ZONE * 7919 + VISIT * 104729 + 13;
const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

// ---------- 화면(가로 고정, 레터박스) ----------
const ASPECT = 1266 / 585;
const stageEl = $('stage'), canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: TEST });
renderer.outputColorSpace = THREE.SRGBColorSpace;
function resize() {
  let w = innerWidth, h = innerHeight;
  if (TEST) { w = +(q.get('w') || 1266); h = Math.round(w / ASPECT); }
  let cw = w, ch = w / ASPECT; if (ch > h) { ch = h; cw = h * ASPECT; }
  stageEl.style.width = cw + 'px'; stageEl.style.height = ch + 'px';
  renderer.setPixelRatio(TEST ? 1 : Math.min(devicePixelRatio || 1, 1.75));
  renderer.setSize(cw, ch, false);
  cam.aspect = cw / ch; cam.updateProjectionMatrix();
}
const sc = new THREE.Scene(); sc.background = new THREE.Color(0x120f16); sc.fog = new THREE.Fog(0x120f16, 20, 45);
const cam = new THREE.PerspectiveCamera(24, ASPECT, 0.1, 80);
const CAM0 = new THREE.Vector3(0, 2.6, 11.4);
cam.position.copy(CAM0); cam.lookAt(0, 1.3, -6.2);
addEventListener('resize', resize); resize();
sc.add(new THREE.HemisphereLight(0xb8b0d0, 0x3a3040, 1.15));
const dl = new THREE.DirectionalLight(0xfff0d8, 1.4); dl.position.set(2, 6, 4); sc.add(dl);

// ---------- 데이터 ----------
const [P, KD, GB, GM, GR, GSW, GSM, GSR, GSN] = await Promise.all([fetch('props.json').then(r => r.json()), fetch('knight_demo.json').then(r => r.json()), fetch('guardians/barbarian.json').then(r => r.json()), fetch('guardians/mage.json').then(r => r.json()), fetch('guardians/rogue.json').then(r => r.json()), fetch('guardians/skel_warrior.json').then(r => r.json()), fetch('guardians/skel_mage.json').then(r => r.json()), fetch('guardians/skel_rogue.json').then(r => r.json()), fetch('guardians/skel_minion.json').then(r => r.json())]);
const box = new THREE.BoxGeometry(1, 1, 1);
const mat = new THREE.MeshLambertMaterial();
const col = new THREE.Color(), O = new THREE.Object3D();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function setM(m, i, x, y, z, sz) { O.position.set(x, y, z); O.scale.setScalar(sz); O.updateMatrix(); m.setMatrixAt(i, O.matrix); }
const key = (ix, iy, iz) => ((ix + 512) * 1024 + (iy + 512)) * 1024 + (iz + 512);

// ---------- 파편 ----------
const DN = 3000, FLOOR = 0.4;
const debris = new THREE.InstancedMesh(box, mat, DN);
debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
debris.frustumCulled = false;
const dp = new Float32Array(DN * 3), dv = new Float32Array(DN * 3), dlife = new Float32Array(DN), dsz = new Float32Array(DN);
for (let i = 0; i < DN; i++) debris.setMatrixAt(i, ZERO);
for (let i = 0; i < DN; i++) debris.setColorAt(i, col.setRGB(1, 1, 1));
sc.add(debris);
let dnext = 0;
function spawnDebris(x, y, z, r, g, b, vx, vy, vz, size, life) {
  const i = dnext; dnext = (dnext + 1) % DN;
  dp[i * 3] = x; dp[i * 3 + 1] = y; dp[i * 3 + 2] = z; dv[i * 3] = vx; dv[i * 3 + 1] = vy; dv[i * 3 + 2] = vz;
  dlife[i] = life || (1.6 + Math.random() * 1.2); dsz[i] = size;
  debris.setColorAt(i, col.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)); debris.instanceColor.needsUpdate = true;
}
function burst(x, y, z, r, g, b, n, spd, size) {
  for (let k = 0; k < n; k++) spawnDebris(x, y, z, r, g, b, (Math.random() - .5) * spd, Math.random() * spd * .9 + 1, (Math.random() - .3) * spd, size, 0);
}
function updateDebris(dt) {
  for (let i = 0; i < DN; i++) {
    if (dlife[i] <= 0) continue;
    dlife[i] -= dt;
    if (dlife[i] <= 0) { debris.setMatrixAt(i, ZERO); continue; }
    dv[i * 3 + 1] -= 14 * dt;
    dp[i * 3] += dv[i * 3] * dt; dp[i * 3 + 1] += dv[i * 3 + 1] * dt; dp[i * 3 + 2] += dv[i * 3 + 2] * dt;
    if (dp[i * 3 + 1] < FLOOR + dsz[i] * .5) { dp[i * 3 + 1] = FLOOR + dsz[i] * .5; dv[i * 3 + 1] *= -.3; dv[i * 3] *= .7; dv[i * 3 + 2] *= .7; }
    const sz = dsz[i] * Math.min(1, dlife[i] * 2);
    setM(debris, i, dp[i * 3], dp[i * 3 + 1], dp[i * 3 + 2], sz);
  }
  debris.instanceMatrix.needsUpdate = true;
}

// ---------- 소품 ----------
const props = [];
const sceneStatics = [];
function put(name, x, z, sc_ = 1, ry = 0, y = 0, destructible = false) {
  const d = P[name]; if (!d) return null;
  const n = d.v.length, pt = d.pitch * sc_;
  const m = new THREE.InstancedMesh(box, mat, n);
  const [sx, , sz] = d.size; const cs = Math.cos(ry), sn = Math.sin(ry);
  const pos = destructible ? new Float32Array(n * 3) : null;
  const bb = new THREE.Box3();
  d.v.forEach((v, i) => {
    const lx = (v[0] - sx / 2 + .5) * pt, lz = (v[2] - sz / 2 + .5) * pt;
    const px = x + lx * cs + lz * sn, py = y + (v[1] + .5) * pt, pz = z - lx * sn + lz * cs;
    setM(m, i, px, py, pz, pt * 1.02);
    col.setRGB(v[3] / 255, v[4] / 255, v[5] / 255, THREE.SRGBColorSpace); m.setColorAt(i, col);
    if (pos) { pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz; bb.expandByPoint(O.position.set(px, py, pz)); }
  });
  sc.add(m);
  if (!destructible) return null;
  const grid = new Map();
  for (let i = 0; i < n; i++) { const k = key(Math.floor(pos[i * 3] / pt), Math.floor(pos[i * 3 + 1] / pt), Math.floor(pos[i * 3 + 2] / pt)); (grid.get(k) || grid.set(k, []).get(k)).push(i); }
  bb.expandByScalar(pt);
  const pr = { name, mesh: m, pos, n, pt, grid, bb, alive: new Uint8Array(n).fill(1), count: n, total: n, v: d.v, dead: false };
  props.push(pr); return pr;
}
function lookupVoxel(e, p, tol) {
  const ix = Math.floor(p.x / e.pt), iy = Math.floor(p.y / e.pt), iz = Math.floor(p.z / e.pt);
  let best = -1, bd = tol * tol;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
    const l = e.grid.get(key(ix + a, iy + b, iz + c)); if (!l) continue;
    for (const i of l) { if (!e.alive[i]) continue; const dx = e.pos[i * 3] - p.x, dy = e.pos[i * 3 + 1] - p.y, dz = e.pos[i * 3 + 2] - p.z; const dd = dx * dx + dy * dy + dz * dz; if (dd < bd) { bd = dd; best = i; } }
  }
  return best;
}
const ray = new THREE.Ray(), tmpP = new THREE.Vector3(), tmpB = new THREE.Vector3();
function marchVoxels(e, r) {  // returns {t,p,i} or null
  const hit = r.intersectBox(e.bb, tmpB); if (!hit) return null;
  const t0 = hit.distanceTo(r.origin);
  const bb2 = e.bb.clone(); const far = new THREE.Vector3();
  const step = e.pt * .5, tmax = t0 + bb2.getSize(new THREE.Vector3()).length() + 1;
  for (let t = t0 - e.pt; t < tmax; t += step) {
    r.at(t, tmpP); if (!e.bb.containsPoint(tmpP)) { if (t > t0 + 0.5) { /* 상자를 벗어남 */ } continue; }
    const i = lookupVoxel(e, tmpP, e.pt * .8);
    if (i >= 0) return { t, p: tmpP.clone(), i };
  }
  return null;
}

let totalCoins = 0, propsBroken = 0, shots = 0, hitsLanded = 0;
function addCoins(n, wx, wy, wz) {
  n = Math.round(n * (ZR.coin || 1));
  totalCoins += n; $('tr').textContent = '코인 ' + totalCoins;
  const v = new THREE.Vector3(wx, wy, wz).project(cam);
  const el = document.createElement('div'); el.className = 'pop'; el.textContent = '+' + n;
  el.style.left = ((v.x + 1) / 2 * 100) + '%'; el.style.top = ((1 - v.y) / 2 * 100) + '%';
  stageEl.appendChild(el); requestAnimationFrame(() => { el.style.transform = 'translateY(-5vmin)'; el.style.opacity = '0'; });
  setTimeout(() => el.remove(), 1000);
}
function removeVoxel(e, i, burstIt, vel) {
  e.alive[i] = 0; e.count--; e.mesh.setMatrixAt(i, ZERO);
  if (burstIt) { const c = e.v[i]; spawnDebris(e.pos[i * 3], e.pos[i * 3 + 1], e.pos[i * 3 + 2], c[3], c[4], c[5], (Math.random() - .5) * 4 + (vel ? vel.x : 0), Math.random() * 3.5 + 1, (Math.random() - .5) * 4 + (vel ? vel.z : 0), e.pt, 0); }
}
function damageProp(e, p, radius) {
  let k = 0; const r2 = radius * radius;
  for (let i = 0; i < e.n; i++) {
    if (!e.alive[i]) continue;
    const dx = e.pos[i * 3] - p.x, dy = e.pos[i * 3 + 1] - p.y, dz = e.pos[i * 3 + 2] - p.z;
    if (dx * dx + dy * dy + dz * dz < r2) { removeVoxel(e, i, (k++ % 2) === 0, null); }
  }
  e.mesh.instanceMatrix.needsUpdate = true;
  if (!e.dead && e.count < e.total * .4) breakProp(e);
}
// ---------- 효과음 (WebAudio 합성, 외부 에셋 없음) ----------
let AC = null, muted = false;
function ac() { if (muted) return null; if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (AC.state === 'suspended') AC.resume(); return AC; }
function tone(f0, f1, dur, type, vol, delay = 0) { const a = ac(); if (!a) return; const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + .02); }
function noise(dur, vol, delay = 0, hp = 800) { const a = ac(); if (!a) return; const t = a.currentTime + delay, n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; const g = a.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(a.destination); s.start(t); }
const SFX = {
  shot: () => tone(520, 180, .09, 'square', .05),
  prop: () => { noise(.18, .12, 0, 600); tone(200, 80, .12, 'triangle', .08); },
  part: () => { noise(.25, .16, 0, 400); tone(300, 90, .2, 'sawtooth', .08); },
  block: () => { tone(900, 700, .12, 'sine', .08); tone(1350, 1000, .1, 'sine', .05, .02); },
  core: () => { tone(300, 900, .35, 'sine', .1); tone(450, 1300, .35, 'sine', .06, .05); },
  collapse: () => { noise(.9, .22, 0, 120); tone(120, 40, .8, 'sawtooth', .12); },
  warn: () => tone(660, 660, .08, 'sine', .04)
};
const sfx = k => { try { SFX[k](); } catch (e) { } };
window.addEventListener('pointerdown', () => ac(), { once: true });
{ const mb = document.getElementById('mute'); if (mb) { mb.addEventListener('pointerdown', e => e.stopPropagation()); mb.onclick = () => { muted = !muted; mb.textContent = muted ? '소리 끔' : '소리 켬'; }; } }
function breakProp(e) {
  sfx('prop'); e.dead = true; propsBroken++; save.dex[e.name] = (save.dex[e.name] || 0) + 1;
  let c = 0;
  for (let i = 0; i < e.n; i++) if (e.alive[i]) { removeVoxel(e, i, (c++ % 3) === 0, null); }
  e.mesh.instanceMatrix.needsUpdate = true; sc.remove(e.mesh);
  const cx = e.bb.getCenter(new THREE.Vector3());
  const coins = 1 + Math.min(4, Math.floor(e.total / 700));
  burst(cx.x, cx.y, cx.z, 255, 213, 74, 14, 6, .08);
  addCoins(coins * 10, cx.x, cx.y + .4, cx.z);
  if (/barrel|keg/.test(e.name)) explodeAt(cx);
}
const shockFx = [];
function shockwave(cx) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: .55, depthWrite: false }));
  m.position.copy(cx); m.scale.setScalar(.2); sc.add(m); shockFx.push({ m, t: 0 });
}
function updateShock(dt) { for (let i = shockFx.length - 1; i >= 0; i--) { const f = shockFx[i]; f.t += dt; const k = Math.min(1, f.t / .45); f.m.scale.setScalar(.2 + k * 2.2); f.m.material.opacity = .55 * (1 - k); if (k >= 1) { sc.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); shockFx.splice(i, 1); } } }
function explodeAt(cx) {
  shockwave(cx);   // 통/술통 폭발: 가까운 수호자 장비에 약한 피해 (방어 효과 없음)
  burst(cx.x, cx.y, cx.z, 255, 150, 40, 36, 8, .1); burst(cx.x, cx.y, cx.z, 255, 230, 120, 18, 5, .07); shake = Math.max(shake, .25); sfx('block');
  let hit = 0;
  for (const g of GS) {
    if (g.kstate !== 'guard') continue; const K = g.K, gb = g.bob || 0; let bi = -1, bd = 2.2 * 2.2;
    for (let i = 0; i < K.n; i++) { if (!K.alive[i]) continue; const c = K.cat[i]; if (!g.PARTS[c] || !g.PARTS[c].alive) continue;
      const dx = K.pos[i * 3] + g.off - cx.x, dy = K.pos[i * 3 + 1] + gb - cx.y, dz = K.pos[i * 3 + 2] - cx.z; const d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; bi = i; } }
    if (bi >= 0) { const p = new THREE.Vector3(K.pos[bi * 3], K.pos[bi * 3 + 1], K.pos[bi * 3 + 2]); const c = K.cat[bi], pt = g.PARTS[c]; burst(p.x + g.off, p.y + gb, p.z, 255, 200, 90, 8, 4, .05); pt.hp -= 1; if (pt.hp <= 0) breakPart(g, c); hit++; }
  }
  if (hit) { popLabel('폭발!', cx.clone().add(new THREE.Vector3(0, .6, 0))); }
  return hit;
}

// ---------- 지형 ----------
const J0 = -3;
for (let i = -1; i <= 1; i++) for (let j = J0; j < 3; j++) put(T.fl, i * 4.2, -2.1 - j * 4.2);
const FEAT = { 1: ['platR', 'nicheL'], 2: ['platL', 'platR'], 3: ['cols'], 4: ['brokencols', 'rubble'], 5: ['cols', 'nicheL', 'nicheR'], 6: ['nicheL', 'platR'], 7: ['platL', 'platR'], 8: ['nicheL', 'nicheR', 'cols2'] }[ZONE];
const WVS = { 1: ['wall', 'wall', 'wall_cracked', 'wall_doorway'], 2: ['wall', 'wall', 'wall_arched', 'wall_doorway'], 3: ['wall_arched', 'wall_arched', 'wall', 'wall_doorway'], 4: ['wall_broken', 'wall_broken', 'wall_cracked', 'wall_cracked'], 5: ['wall_arched', 'wall', 'wall_arched', 'wall'], 6: ['wall', 'wall', 'wall_doorway', 'wall_cracked'], 7: ['wall', 'wall_cracked', 'wall_cracked', 'wall_broken'], 8: ['wall', 'wall', 'wall', 'wall_cracked'] };
const WV = WVS[ZONE];
const ZBG = { 1: 0x1a1008, 2: 0x1a1a06, 3: 0x1a0e0a, 4: 0x0c1220, 5: 0x120c22, 6: 0x1a0c16, 7: 0x0c1a14, 8: 0x2a0707 }[ZONE];
sc.background.set(ZBG); sc.fog.color.set(ZBG);
for (let i = -1; i <= 1; i++) { const w_ = WV[Math.floor(R() * WV.length)]; if ((i == -1 && FEAT.includes('nicheL')) || (i == 1 && FEAT.includes('nicheR'))) continue; put(w_, i * 4.2, -12.6, 1); }
for (let j = J0; j < 3; j++) { put(WV[Math.floor(R() * WV.length)], -6.9, -2.1 - j * 4.2, 1, Math.PI / 2); put(WV[Math.floor(R() * WV.length)], 6.9, -2.1 - j * 4.2, 1, -Math.PI / 2); }
const nt = 2 + Math.floor(R() * 3);
for (let i = 0; i < nt; i++) { const side = R() < .5 ? -1 : 1; const z = -3 - R() * 8; put('torch_mounted', side * 6.0, z, 1.0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 1.9); const pl = new THREE.PointLight(T.c, 14, 7, 1.6); pl.position.set(side * 5.5, 2.4, z); sc.add(pl); }

// ---------- 수호자들 (기사, 야만전사, 마법사) ----------
const GTYPES = {
  knight: { go: 1, gb: 1, name: '기사', d: KD, legacy: true, parts: { 1: ['투구', 3], 4: ['방패', 3], 3: ['검', 2] } },
  barbarian: { go: 1.2, gl: 6, gb: 0.8, name: '야만전사', d: GB, parts: { 1: ['털모자', 3], 4: ['방패', 3], 3: ['도끼', 2] } },
  mage: { go: 1, gb: 1, name: '마법사', d: GM, parts: { 1: ['모자', 3], 3: ['지팡이', 2] } },
  rogue: { go: 1, gl: 8, gb: 0.7, hs: .9, name: '도적', d: GR, parts: { 4: ['단검', 3], 3: ['석궁', 2] } },
  skelwar: { go: 1, gl: 6, gb: 1, hs: 1.0, name: '해골 전사', d: GSW, parts: { 1: ['투구', 3], 4: ['방패', 3], 3: ['검', 2] } },
  skelmage: { go: 1, gb: 1, name: '해골 마법사', d: GSM, parts: { 1: ['모자', 3], 3: ['지팡이', 2] } },
  skelrogue: { go: 1, gl: 8, gb: 0.7, hs: .95, name: '해골 도적', d: GSR, parts: { 1: ['두건', 3], 3: ['석궁', 2] } },
  skelminion: { go: 1.3, gl: 6, gb: 0.6, hs: .8, name: '해골 병사', d: GSN, parts: { 4: ['방패', 2], 3: ['도끼', 2] } } };
const SLOTS = [
  { x: -3.0, z: -6.5, H: 2.0, amp: .4, per: 4.8, gopen: 2.4, gblock: 1.2 },
  { x: 0, z: -7.6, H: 2.2, amp: .4, per: 6.0, gopen: 3.0, gblock: 1.4 },
  { x: 3.0, z: -6.5, H: 2.0, amp: .4, per: 4.2, gopen: 2.0, gblock: 1.1 }];
const GOKEYS = ['knight', 'barbarian', 'mage', 'rogue', 'skelwar', 'skelmage', 'skelrogue', 'skelminion'];
const GWARN = .5;
const ZRANK = (ZONE - 2 + 8) % 8;   // 진행 순서 0..7 (2→3→…→8→1)
const DIFF = Math.min(9, Math.max(0, VISIT - 1) + Math.floor(ZRANK / 2));
const D_BLOCK = (1 + .08 * DIFF) * .7, D_OPEN = Math.max(.7, 1 - .04 * DIFF) * 1.9, D_SPEED = (1 + .05 * DIFF) * (ZR.spd || 1);
const GS = [];
const kcolor = new THREE.Color();
function downsample(vox) {   // 2x2x2 묶음: 부위(장비)가 있으면 그 부위가 우선
  const m = new Map();
  for (const v of vox) {
    if (v[6] === 5) continue;
    const k = (v[0] >> 1) + ',' + (v[1] >> 1) + ',' + (v[2] >> 1); let e = m.get(k);
    if (!e) { e = { x: v[0] >> 1, y: v[1] >> 1, z: v[2] >> 1, r: 0, g: 0, b: 0, n: 0, cat: 0, w: {} }; m.set(k, e); }
    e.r += v[3]; e.g += v[4]; e.b += v[5]; e.n++; e.w[v[6]] = (e.w[v[6]] || 0) + 1;
  }
  const out = [];
  for (const e of m.values()) {
    let cat = 0, best = 0; for (const c in e.w) { if (+c !== 0 && e.w[c] >= best) { best = e.w[c]; cat = +c; } }
    if (cat === 0 && e.w[0]) cat = 0;
    const lift = cat > 0 ? 1.3 : 1; out.push([e.x, e.y, e.z, Math.min(255, e.r / e.n * lift), Math.min(255, e.g / e.n * lift), Math.min(255, e.b / e.n * lift), cat]);   // 장비는 밝게 해서 구분
  }
  return out;
}
// 장비 위치 표시(조준 보조): 남은 장비 위에 맥동하는 노란 고리
const MARK_TEX = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.strokeStyle = '#ffe14a'; x.lineWidth = 6; x.beginPath(); x.arc(32, 32, 22, 0, 7); x.stroke(); x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 2; x.beginPath(); x.arc(32, 32, 14, 0, 7); x.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
function makeGuardian(typeKey, slot, idx) {
  const T_ = GTYPES[typeKey], D = T_.d;
  slot = Object.assign({}, slot, { H: slot.H * (T_.hs || 1) });   // 종류별 크기 보정(겹침 방지)
  const hgt = D.height || 81, pitch = D.pitch;
  const scale = slot.H / ((hgt + 1) * pitch);
  const kpt = pitch * scale * 2;                        // 2x2x2 묶음이므로 복셀 크기 2배
  const rel = kpt / .045;
  const GL = T_.gl || 0;   // 바닥에 깔린 장비를 들어 올림(복셀 단위)
  const kv0 = downsample(D.vox.filter(v => v[6] !== 5).map(v => (GL && (v[6] === 3 || v[6] === 4)) ? [v[0], v[1] + GL, v[2], v[3], v[4], v[5], v[6]] : v)).filter(v => v[6] !== 2);
  let kcx = 0, kcz = 0; kv0.forEach(v => { kcx += v[0]; kcz += v[2]; }); kcx /= kv0.length; kcz /= kv0.length;
  const K = { n: kv0.length, pt: kpt };
  K.mesh = new THREE.InstancedMesh(box, mat, K.n); K.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); K.mesh.frustumCulled = false;
  K.pos = new Float32Array(K.n * 3); K.cat = new Uint8Array(K.n); K.alive = new Uint8Array(K.n).fill(1); K.v = kv0.map(v => [0, 0, 0, v[3], v[4], v[5]]);
  K.grid = new Map(); K.count = K.n;
  kv0.forEach((v, i) => {
    const x = (v[0] + .5 - kcx) * kpt, y = (v[1] + .5) * kpt, z = slot.z + (v[2] + .5 - kcz) * kpt;
    K.pos[i * 3] = x; K.pos[i * 3 + 1] = y; K.pos[i * 3 + 2] = z; K.cat[i] = v[6];
    setM(K.mesh, i, x, y, z, kpt * 1.02); col.setRGB(v[3] / 255, v[4] / 255, v[5] / 255, THREE.SRGBColorSpace); K.mesh.setColorAt(i, col);
    const k = key(Math.floor(x / kpt), Math.floor(y / kpt), Math.floor(z / kpt)); (K.grid.get(k) || K.grid.set(k, []).get(k)).push(i);
  });
  K.bb = new THREE.Box3(); for (let i = 0; i < K.n; i++) K.bb.expandByPoint(O.position.set(K.pos[i * 3], K.pos[i * 3 + 1], K.pos[i * 3 + 2])); K.bb.expandByScalar(kpt);
  K.mesh.position.x = slot.x; sc.add(K.mesh);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(slot.H * .42, 32), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .45 })); sh.rotation.x = -Math.PI / 2; sh.position.set(slot.x, .02, slot.z); sc.add(sh);
  const PARTS = {}; for (const c in T_.parts) PARTS[c] = { name: T_.parts[c][0], hp: T_.parts[c][1], alive: true, total: 0 };
  for (let i = 0; i < K.n; i++) if (PARTS[K.cat[i]]) PARTS[K.cat[i]].total++;
  // 코어 위치: 기사는 기존 기준, 새 모델은 정면 가슴 높이
  const CORE = T_.legacy ? new THREE.Vector3(0, slot.H * .39, slot.z + .2 * slot.H / 3.69) : new THREE.Vector3(0, slot.H * .5, slot.z + (D.core[2] / 2 - kcz) * kpt * 1 + .1);
  if (!T_.legacy) { const cz = (D.core[2] / 2 - kcz) * kpt; CORE.z = slot.z + cz; }
  const aura = new THREE.Mesh(new THREE.BoxGeometry(slot.H * .75, slot.H * 1.12, slot.H * .5), new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0, depthWrite: false }));
  aura.position.set(slot.x, slot.H * .55, slot.z); sc.add(aura);
  const g = { idx, key: typeKey, name: T_.name, slot, K, PARTS, CORE, rel, kpt, kstate: 'guard', partsBroken: 0, off: slot.x, ph: Math.random() * 6.28, gmode: 'open', gT: Math.random() * 1.5, coreMesh: null, collapseT: 0, kv: new Float32Array(K.n * 3), sh, aura };
  g.marks = {};
  for (const c in PARTS) { let sx = 0, sy = 0, sz = 0, n = 0; for (let i = 0; i < K.n; i++) if (K.cat[i] == c) { sx += K.pos[i * 3]; sy += K.pos[i * 3 + 1]; sz += K.pos[i * 3 + 2]; n++; } if (!n) continue;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: MARK_TEX, transparent: true, depthTest: false, opacity: .85 })); sp.renderOrder = 10; sp.scale.setScalar(.34); sp.position.set(sx / n + slot.x, sy / n + .04, sz / n + .25); sc.add(sp); g.marks[c] = { sp, x: sx / n, y: sy / n, z: sz / n }; }
  K.g = g; return g;
}
{
  const keys = []; // 방문마다 구성이 바뀜: 기사/야만전사/마법사를 섞어서 3체
  const SIG = { 1: 'barbarian', 2: 'knight', 3: 'skelmage', 4: 'knight', 5: 'rogue', 6: 'skelmage', 7: 'rogue', 8: 'barbarian' }[ZONE];   // 구역별 대표 수호자(약 절반 확률)
  const ZPOOL = { 2: ['knight', 'skelwar', 'barbarian'], 3: ['skelwar', 'skelmage', 'skelrogue', 'skelminion'], 5: ['rogue', 'skelrogue', 'mage', 'skelmage'], 6: ['skelwar', 'skelmage', 'skelrogue', 'skelminion'], 7: ['rogue', 'skelrogue', 'mage', 'skelmage'] }[ZONE] || GOKEYS;   // 구역 테마: 갑옷/해골/민첩 구역
  for (let i = 0; i < 3; i++) { let k = R() < .4 ? SIG : ZPOOL[Math.floor(R() * ZPOOL.length)]; for (let t = 0; t < 6 && keys.includes(k) && ZPOOL.some(p => !keys.includes(p)); t++) k = ZPOOL[Math.floor(R() * ZPOOL.length)]; keys.push(k); }
  if (q.get('g')) q.get('g').split(',').forEach((k, i) => { if (GTYPES[k]) keys[i] = k; });   // 테스트용 강제 지정
  if (new Set(keys).size === 1) keys[1] = GOKEYS[(GOKEYS.indexOf(keys[0]) + 1) % GOKEYS.length];   // 최소 2종류
  const slots = SLOTS.map(s_ => ({ ...s_ }));
  keys.forEach((k, i) => GS.push(makeGuardian(k, slots[i], i)));
  if (ZONE % 8 === 0) { const eg = GS[1]; eg.elite = true; eg.name = '★정예 ' + eg.name; }   // 마지막 구역: 가운데 수호자는 정예(보상만 3배, 방어 변화 없음)
}
let KOFF = 0;   // (호환용) 사용 안 함
const MOVE = !TEST || q.get('move') === '1';
let flashT = 0, deflects = 0;
function gStatus(g) {
  if (g.kstate === 'guard') return `${g.name} 장비 ${g.partsBroken}/${Object.keys(g.PARTS).length}`;
  if (g.kstate === 'exposed') return `${g.name} <span style="color:#7ff">코어 노출!</span>`;
  return `${g.name} 처치`;
}
function setStatus() { const left = GS.filter(g => g.kstate !== 'collapse' && g.kstate !== 'done').length; $('tc').innerHTML = `수호자 ${GS.length - left}/${GS.length} 처치<br>` + GS.map(gStatus).join(' · '); }
function flashText(t) { $('tc').innerHTML = t; flashT = .8; }
const flashSetStatusSoon = () => { };
function exposeCore(g) {
  sfx('core');
  const { K, CORE } = g; g.kstate = 'exposed'; setStatus();
  const r1 = .55 * g.rel;
  for (let i = 0; i < K.n; i++) if (K.alive[i] && K.cat[i] === 0) {
    const dx = K.pos[i * 3] - CORE.x, dy = K.pos[i * 3 + 1] - CORE.y, dz = K.pos[i * 3 + 2] - CORE.z;
    if (dx * dx + dy * dy + dz * dz < r1 * r1) { K.alive[i] = 0; K.count--; K.mesh.setMatrixAt(i, ZERO); if (Math.random() < .5) spawnDebris(K.pos[i * 3] + g.off, K.pos[i * 3 + 1], K.pos[i * 3 + 2], K.v[i][3], K.v[i][4], K.v[i][5], (Math.random() - .5) * 3, Math.random() * 3, Math.random() * 3, g.kpt, 0); }
  }
  K.mesh.instanceMatrix.needsUpdate = true;
  const pts = []; const rr = .34 * g.rel, cp = .07 * g.rel;
  for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) for (let c = -5; c <= 5; c++) { if (a * a + b * b + c * c <= 25 && a * a + b * b + c * c >= 12) pts.push([a * cp, b * cp, c * cp]); }
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x66f0ff });
  const cm = new THREE.InstancedMesh(box, coreMat, pts.length);
  pts.forEach((p, i) => setM(cm, i, CORE.x + p[0], CORE.y + p[1], CORE.z + p[2], cp * 1.05));
  cm.frustumCulled = false; cm.position.x = g.off; sc.add(cm); g.coreMesh = cm;
  const pl = new THREE.PointLight(0x66f0ff, 5, 4, 1.8); pl.position.set(CORE.x + g.off, CORE.y + .2, CORE.z + 1.2); sc.add(pl); cm.userData.light = pl;
  burst(CORE.x + g.off, CORE.y, CORE.z, 120, 240, 255, 30, 8, .07);
  shake = .5;
}
function popLabel(text, wp) {
  const v = wp.clone().project(cam); const d = document.createElement('div');
  d.textContent = text; d.style.cssText = `position:absolute;left:${(v.x * .5 + .5) * 100}%;top:${(-v.y * .5 + .5) * 100}%;transform:translate(-50%,-50%);z-index:30;pointer-events:none;color:#fff;font-weight:900;font-size:4.4vmin;white-space:nowrap;-webkit-text-stroke:1px #000;text-shadow:0 0 8px #f80,0 0 18px #f40,0 3px 0 #000;transition:all .9s ease-out;opacity:1`;
  document.body.appendChild(d); requestAnimationFrame(() => { d.style.top = `calc(${(-v.y * .5 + .5) * 100}% - 8vmin)`; d.style.opacity = '0'; d.style.transform = 'translate(-50%,-50%) scale(1.4)'; }); setTimeout(() => d.remove(), 1000);
}
function breakPart(g, c) {
  const mk = g.marks && g.marks[c] ? { x: g.marks[c].x, y: g.marks[c].y, z: g.marks[c].z } : null;
  if (g.marks && g.marks[c]) { sc.remove(g.marks[c].sp); delete g.marks[c]; }
  sfx('part');
  const { K } = g; const pt = g.PARTS[c]; pt.alive = false; g.partsBroken++; let k = 0;
  for (let i = 0; i < K.n; i++) if (K.alive[i] && K.cat[i] == c) {
    K.alive[i] = 0; K.count--; K.mesh.setMatrixAt(i, ZERO);
    if ((k++ % 3) === 0) spawnDebris(K.pos[i * 3] + g.off, K.pos[i * 3 + 1], K.pos[i * 3 + 2], K.v[i][3], K.v[i][4], K.v[i][5], (Math.random() - .5) * 8, Math.random() * 6 + 1, Math.random() * 6, g.kpt, 0);
  }
  K.mesh.instanceMatrix.needsUpdate = true; shake = .35; if (!TEST) hitStop = .1;
  { const wp = mk ? new THREE.Vector3(mk.x + g.off, mk.y, mk.z + .25) : new THREE.Vector3(g.off, g.slot.H * .5, g.slot.z + .3);
    popLabel(`${pt.name || '장비'} 파괴!`, wp); burst(wp.x, wp.y, wp.z, 255, 255, 255, 40, 7, .09); burst(wp.x, wp.y, wp.z, 255, 200, 60, 30, 5, .07); }
  addCoins(20, g.off, g.slot.H * 1.1, g.slot.z + .5);
  if (ZR.chain) { chainN = chainT > 0 ? chainN + 1 : 1; chainT = 6; if (chainN > 1) { addCoins(15 * (chainN - 1), g.off, g.slot.H * 1.3, g.slot.z + .5); popLabel(`연쇄 x${chainN}! 보너스 +${15 * (chainN - 1)}`, new THREE.Vector3(g.off, g.slot.H * 1.15, g.slot.z + .5)); } }
  if (g.partsBroken === Object.keys(g.PARTS).length) exposeCore(g); else setStatus();
}
// 표식을 실제로 맞는 복셀 위로 옮긴다(깎여 나간 구멍 위에 표식이 떠 있으면 명중이 빗나가 버그처럼 느껴짐)
function relocateMark(g, c) {
  const m = g.marks && g.marks[c]; if (!m) return; const K = g.K;
  let sx = 0, sy = 0, sz = 0, n = 0; for (let i = 0; i < K.n; i++) if (K.alive[i] && K.cat[i] == c) { sx += K.pos[i * 3]; sy += K.pos[i * 3 + 1]; sz += K.pos[i * 3 + 2]; n++; }
  if (!n) return; sx /= n; sy /= n; sz /= n;
  const cand = []; for (let i = 0; i < K.n; i++) if (K.alive[i] && K.cat[i] == c) { const dx = K.pos[i * 3] - sx, dy = K.pos[i * 3 + 1] - sy, dz = K.pos[i * 3 + 2] - sz; cand.push([dx * dx + dy * dy + dz * dz, i]); }
  cand.sort((a, b) => a[0] - b[0]);
  const gb = g.bob || 0, stepN = Math.max(1, Math.floor(cand.length / 200));
  for (let k = 0; k < cand.length; k += stepN) {
    const i = cand[k][1], px = K.pos[i * 3], py = K.pos[i * 3 + 1], pz = K.pos[i * 3 + 2];
    const v = new THREE.Vector3(px + g.off, py + .04 + gb, pz + .25).project(cam); if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
    const r = pickHit(v.x, v.y).best;
    if (r && r.kind === 'knight' && r.g === g && K.cat[r.i] == c) { m.x = px; m.y = py; m.z = pz; return; }
  }
  // 후보 복셀이 모두 가려진 경우: 화면에서 이 부위가 실제로 맞는 지점을 격자로 찾는다
  let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
  for (const [, i] of cand) { const v = new THREE.Vector3(K.pos[i * 3] + g.off, K.pos[i * 3 + 1] + gb, K.pos[i * 3 + 2]).project(cam); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const cv = new THREE.Vector3(sx + g.off, sy + gb, sz).project(cam); let bestD = 1e9, bp = null;
  for (let a_ = 0; a_ <= 40; a_++) for (let b_ = 0; b_ <= 40; b_++) {
    const nx = x0 + (x1 - x0) * a_ / 40, ny = y0 + (y1 - y0) * b_ / 40; if (Math.abs(nx) > 1 || Math.abs(ny) > 1) continue;
    const r = pickHit(nx, ny).best; if (!(r && r.kind === 'knight' && r.g === g && K.cat[r.i] == c)) continue;
    const d = (nx - cv.x) ** 2 + (ny - cv.y) ** 2; if (d >= bestD) continue;
    const v = new THREE.Vector3(r.p.x + g.off, r.p.y + .04 + gb, r.p.z + .25).project(cam); const r2 = pickHit(v.x, v.y).best;
    if (r2 && r2.kind === 'knight' && r2.g === g && K.cat[r2.i] == c) { bestD = d; bp = r.p.clone(); }
  }
  if (bp) { m.x = bp.x; m.y = bp.y; m.z = bp.z; return; }
  m.x = sx; m.y = sy; m.z = sz;
}
function hitKnight(h) {
  const g = h.g, K = g.K, c = K.cat[h.i];
  if (g.kstate === 'collapse' || g.kstate === 'done') return;
  if (g.PARTS[c] && g.PARTS[c].alive) {
    const pt = g.PARTS[c]; let crit = 1; { const mk = g.marks && g.marks[c]; if (mk && !h.sg) { const dx = h.p.x - mk.x, dy = h.p.y - mk.y; if (dx * dx + dy * dy < Math.pow(.32 * g.rel, 2)) { crit = 1.5; if (!TEST) popLabel('급소!', new THREE.Vector3(h.p.x + g.off, h.p.y + (g.bob || 0) + .3, h.p.z + .25)); } } } pt.hp -= (h.dmg || 1) * crit * (h.pshot && pt.name === '방패' ? 1.5 : 1) * (h.sg && /모자|두건|지팡이|석궁/.test(pt.name) ? 1.6 : 1); if (pt.hp > 0) flashPart(g, c); if (!TEST) hitStop = Math.max(hitStop, (h.dmg || 1) >= 1 ? .05 : .02);
    let k = 0; const cr = .3 * g.rel * (h.mult || 1);
    for (let i = 0; i < K.n; i++) if (K.alive[i] && K.cat[i] == c) {
      const dx = K.pos[i * 3] - h.p.x, dy = K.pos[i * 3 + 1] - h.p.y, dz = K.pos[i * 3 + 2] - h.p.z;
      if (dx * dx + dy * dy + dz * dz < cr * cr) { K.alive[i] = 0; K.count--; K.mesh.setMatrixAt(i, ZERO); if ((k++ % 2) == 0) spawnDebris(K.pos[i * 3] + g.off, K.pos[i * 3 + 1], K.pos[i * 3 + 2], K.v[i][3], K.v[i][4], K.v[i][5], (Math.random() - .5) * 5, Math.random() * 4 + 1, Math.random() * 5, g.kpt, 0); }
    }
    K.mesh.instanceMatrix.needsUpdate = true; shake = .15;
    if (pt.hp <= 0) breakPart(g, c); else relocateMark(g, c);
  } else {
    burst(h.wp.x, h.wp.y, h.wp.z, 200, 200, 210, 6, 4, .05);   // 몸통은 코어 전까지 깎이지 않음
    flashText('몸통은 단단하다. 장비를 먼저!');
  }
}

// 구조물 (측면 단 등)
const obst = [[-3.0, -6.5, 1.9], [0, -7.6, 1.9], [3.0, -6.5, 1.9], [0, -4.2, 2.4]];
function block(x, z, w, d, h, y0, tint) {
  const pt = 0.2, nx = Math.round(w / pt), nz = Math.round(d / pt), ny = Math.round(h / pt); const cells = [];
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) { const edge = i == 0 || i == nx - 1 || k == 0 || k == nz - 1 || j == ny - 1; if (!edge) continue; cells.push([x - w / 2 + (i + .5) * pt, y0 + (j + .5) * pt, z - d / 2 + (k + .5) * pt, j == ny - 1]); }
  const m = new THREE.InstancedMesh(box, mat, cells.length);
  cells.forEach((c, i) => { setM(m, i, c[0], c[1], c[2], pt * 1.02); const v = (R() * .12) - .06; const t = c[3] ? 0.5 : 0.4; col.setRGB(t + v + tint[0], t + v + tint[1], t + v + tint[2]); m.setColorAt(i, col); });
  sc.add(m);
}
function platform(side, h) {
  const w = 1.9, d = 4.0, zc = -6.2 - R() * 2.6, x = side * (6.1 - w / 2 - 0.05);
  block(x, zc, w, d, h, 0, [0, 0, 0.03 * side]);
  const n = 3 + Math.floor(R() * 3); const pp = [];
  for (let k = 0, t = 0; k < n && t < 60; t++) {
    const px = x + (R() * 2 - 1) * (w / 2 - .6), pz = zc + (R() * 2 - 1) * (d / 2 - .55);
    const nm = T.p[Math.floor(R() * T.p.length)]; const dd = P[nm]; if (!dd) continue; if (pp.some(q => Math.hypot(q[0] - px, q[1] - pz) < .95)) continue;
    pp.push([px, pz]); put(nm, px, pz, .8 + R() * .25, Math.floor(R() * 4) * Math.PI / 2, h, true); k++;
  }
  obst.push([x, zc, 2.6]);
}
function niche(i) {
  const cx = i * 4.2, zb = -12.6 - 2.4;
  put('wall', cx, zb, 1, 0); put('wall', cx - 2.5, zb + 1.8, 1, Math.PI / 2); put('wall', cx + 2.5, zb + 1.8, 1, -Math.PI / 2);
  put(T.fl, cx, -12.6 - 2.1); const nm = T.p[Math.floor(R() * T.p.length)]; put(nm, cx, -14.4, 1.0, Math.floor(R() * 4) * Math.PI / 2);
  const pl = new THREE.PointLight(T.c, 10, 6, 1.6); pl.position.set(cx, 2.3, -13.5); sc.add(pl);
}
function columns(broken, pairs) {
  const zs = pairs == 2 ? [-6.4, -10] : [-5.8, -8.4, -11];
  zs.forEach(z => { [-1, 1].forEach(sd => { const x = sd * (5.1 + R() * .3); if (broken && R() < .6) { put('column', x, z, 1.5, 0, 0, true); put('rubble_half', x + (R() - .5) * .6, z + .3, .7, R() * 3, 0, true); } else put('pillar', x, z, 1.0, 0, 0, true); obst.push([x, z, 1.0]); }); });
}
const big = ZONE == 2 || ZONE == 7;
FEAT.forEach(f => {
  if (f == 'platL') platform(-1, big ? 0.8 + R() * .4 : 0.6); else if (f == 'platR') platform(1, big ? 0.8 + R() * .4 : 0.6);
  else if (f == 'nicheL') niche(-1); else if (f == 'nicheR') niche(1);
  else if (f == 'cols') columns(false, 3); else if (f == 'cols2') columns(false, 2); else if (f == 'brokencols') columns(true, 3);
  else if (f == 'rubble') { [-1, 1].forEach(sd => { const x = sd * (5.1 + R() * .7), z = -3.6 - R() * 7; put('rubble_large', x, z, .8, R() * 6, 0, true); obst.push([x, z, 1.8]); }); }
});
// 부술 물체: 카메라 기준 약 4.8~9.2m 뒤 구간(z -4.8..-9.2), 가운데 통로와 수호자 주변은 비움
const placed = obst.slice(); const cnt = 10 + Math.floor(R() * 5);
for (let k = 0, t = 0; k < cnt && t < 400; t++) {
  const x = (R() * 2 - 1) * 6.0, z = -4.8 - R() * 4.4;
  if (z < -5.3 && Math.abs(x) < 4.9) continue;   // 수호자 구역을 가리지 않음
  const nm = T.p[Math.floor(R() * T.p.length)]; const d = P[nm]; if (!d) continue;
  const sz_ = 0.85 + R() * .35; const rad = Math.max(d.size[0], d.size[2]) * d.pitch * sz_ * .55;
  if (placed.some(p => Math.hypot(p[0] - x, p[1] - z) < p[2] + rad)) continue;
  placed.push([x, z, rad]); put(nm, x, z, sz_, Math.floor(R() * 4) * Math.PI / 2 + (R() - .5) * .4, 0, true); k++;
}
{ const LOW = ['box_small', 'coin_stack_medium', 'bottle_A_green', 'plate_food_A', 'stool', 'candle_triple', 'barrel_small'];
  for (let k = 0, t = 0; k < 4 && t < 100; t++) { const x = (R() * 2 - 1) * 5, z = -2.4 - R() * 2.0; if (Math.abs(x) < 2.4) continue; const nm = LOW[Math.floor(R() * LOW.length)]; const d = P[nm]; if (!d) continue; const rad = Math.max(d.size[0], d.size[2]) * d.pitch * .6; if (placed.some(p => Math.hypot(p[0] - x, p[1] - z) < p[2] + rad)) continue; placed.push([x, z, rad]); put(nm, x, z, 1.0, Math.floor(R() * 4) * Math.PI / 2, 0, true); k++; } }
// 안전망: 수호자의 이동 범위 안에서 장비/코어를 가리는 소품은 제거(조준 시야 확보)
{
  const cp = cam.position.clone(); let removed = 0;
  for (let pi = props.length - 1; pi >= 0; pi--) {
    const e = props[pi]; let blocked = false;
    for (const g of GS) { if (blocked) break;
      for (let o = -g.slot.amp; o <= g.slot.amp + 1e-6 && !blocked; o += .4) for (const yy of [.15, .4, .7, .95]) for (const dx of [-.5, 0, .5]) {
        const P_ = new THREE.Vector3(g.slot.x + o + dx, g.slot.H * yy, g.slot.z); const dist = P_.distanceTo(cp);
        const rr_ = new THREE.Ray(cp, P_.clone().sub(cp).normalize()); const hit = rr_.intersectBox(e.bb, new THREE.Vector3());
        if (hit && hit.distanceTo(cp) < dist - .25) { blocked = true; break; } } }
    if (blocked) { e.dead = true; e.mesh.visible = false; props.splice(pi, 1); removed++; }
  }
  window.__removedProps = removed;
}
const TOTAL_PROPS = props.length;

// ---------- 사격 ----------
const proj = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd54a }));
proj.visible = false; sc.add(proj);
const flying = [];
let reloadW = 0; let cooldown = 0, started = TEST, shake = 0;
const rc = new THREE.Raycaster();
function pickHit(nx, ny, t0 = 0) {
  rc.setFromCamera(new THREE.Vector2(nx, ny), cam);
  ray.copy(rc.ray); if (t0) ray.origin.addScaledVector(ray.direction, t0);
  let best = null;
  for (const e of props) { if (e.dead) continue; const h = marchVoxels(e, ray); if (h && (!best || h.t < best.t)) best = { kind: 'prop', e, ...h }; }
  for (const g of GS) {
    if (g.kstate === 'collapse' || g.kstate === 'done') continue;
    const gb = g.bob || 0; const kr = new THREE.Ray(ray.origin.clone().sub(new THREE.Vector3(g.off, gb, 0)), ray.direction); const h = marchVoxels(g.K, kr);
    if (h && (!best || h.t < best.t)) best = { kind: 'knight', g, ...h, wp: h.p.clone().add(new THREE.Vector3(g.off, gb, 0)) };
    if (g.kstate === 'guard' && g.marks) for (const c in g.marks) {   // 표식(노란 고리)을 겨누면 그 부위가 맞는다: 조준 보조
      const m = g.marks[c]; if (!(g.PARTS[c] && g.PARTS[c].alive)) continue;
      const msp = new THREE.Sphere(new THREE.Vector3(m.x + g.off, m.y + .04 + gb, m.z + .25), .25 * Math.max(.9, g.rel)); const mp = ray.intersectSphere(msp, new THREE.Vector3()); if (!mp) continue;
      const mt = mp.distanceTo(ray.origin); if (best && best.kind === 'prop' && best.t < mt - .3) continue;
      let bi = -1, bd = 1e9; const K = g.K; for (let i = 0; i < K.n; i++) if (K.alive[i] && K.cat[i] == c) { const dx = K.pos[i * 3] - m.x, dy = K.pos[i * 3 + 1] - m.y, dz = K.pos[i * 3 + 2] - m.z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; bi = i; } }
      if (bi < 0) continue; if (best && best.kind === 'knight' && best.g === g && K.cat[best.i] == c) continue;
      const lp = new THREE.Vector3(K.pos[bi * 3], K.pos[bi * 3 + 1], K.pos[bi * 3 + 2]);
      best = { kind: 'knight', g, t: mt, i: bi, p: lp, wp: lp.clone().add(new THREE.Vector3(g.off, gb, 0)), assist: true };
    }
    if (g.kstate === 'exposed') { const sp = new THREE.Sphere(g.CORE.clone().add(new THREE.Vector3(g.off, gb, 0)), .42 * Math.max(.9, g.rel)); const pt = ray.intersectSphere(sp, new THREE.Vector3()); if (pt) { const t = pt.distanceTo(ray.origin); if (!best || t < best.t + .05) best = { kind: 'core', g, t, p: pt }; } }
  }
  // 비파괴 구조물(바닥, 좌우 벽, 뒷벽): 닿으면 투사체가 거기서 멈추고 불꽃이 튄다
  const planes = [['y', 0.02, 1], ['x', -6.3, -1], ['x', 6.3, 1], ['z', -12.3, -1]];
  for (const [ax, val, sg] of planes) {
    const o = ray.origin[ax], d = ray.direction[ax]; if (Math.abs(d) < 1e-6) continue;
    const t = (val - o) / d; if (t <= 0) continue;
    const p = ray.at(t, new THREE.Vector3());
    if (ax !== 'y' && (p.y < 0.02 || p.y > 6)) continue;
    if (ax === 'y' && (Math.abs(p.x) > 6.3 || p.z < -12.3 || p.z > 11)) continue;
    if (!best || t < best.t) best = { kind: 'wall', t, p };
  }
  return { best, far: ray.at(30, new THREE.Vector3()) };
}
const MAG = [{ n: 12, rl: 1.4 }, { n: 6, rl: 1.8 }, { n: 3, rl: 0 }];
const ammo = [12, 6, 3]; let reloadT = 0, gauge = 0; const GAUGE_MAX = 100;
function gaugeUp(h) {
  if (TEST || (h.kind !== 'knight' && h.kind !== 'core')) return;
  if (ammo[2] >= MAG[2].n) return;
  gauge += (h.pshot ? 6 : 14) * (h.dmg || 1) * (ZR.gg || 1);
  if (gauge >= GAUGE_MAX) { gauge = 0; ammo[2] = MAG[2].n + (wLvl(2) >= 4 ? 1 : 0); $('tc').innerHTML = '게이지 완충!<br>관통탄 장전'; flashT = .9; sfx('warn'); }
}
function applyHit(h) {
  hitsLanded++;
  if ((h.kind === 'knight' || h.kind === 'core') && h.g.gmode !== 'block' || h.pshot) gaugeUp(h);
  if ((h.kind === 'knight' || h.kind === 'core') && h.g.gmode === 'block' && !h.pshot) {
    const q = h.wp || h.p; burst(q.x, q.y, q.z, 150, 190, 255, 8, 4, .05); shake = Math.max(shake, .1);
    $('tc').innerHTML = '수호자 방어!<br>막혔다'; flashT = .6; deflects++; sfx('block'); return 'stop';
  }
  if (h.kind === 'prop') { burst(h.p.x, h.p.y, h.p.z, 255, 240, 200, 5, 3, .04); damageProp(h.e, h.p, .55 * (h.mult || 1)); }
  else if (h.kind === 'knight') { if (!TEST) { const q = h.wp || h.p; burst(q.x, q.y, q.z, 255, 235, 150, 6, 3.5, .04); } hitKnight(h); }
  else if (h.kind === 'core') { if (h.g.kstate === 'exposed') collapse(h.g); }
  else if (h.kind === 'wall') burst(h.p.x, h.p.y, h.p.z, 255, 220, 120, 4, 2, .03);
}
const ORIGIN = new THREE.Vector3(.8, 1.6, 10.4);
// ---------- 무기 3종 (기본탄 / 범위탄 / 관통탄), 각 5단계 강화 ----------
const WEAPONS = [
  { n: '기본탄', d: '12발 연사, 소진 시 장전', cd: .22, rad: 1, pierce: 0, col: 0xffd54a },
  { n: '산탄', d: '약한 파편 9발이 넓게 퍼짐·근거리 강함, 모자·지팡이·석궁에 1.6배, 6발 소진 시 장전', cd: .6, rad: 1.0, pierce: 0, col: 0xff7a4a },
  { n: '관통탄', d: '방패 관통·여러 물체 뚫음, 방패 장비에 1.5배, 3발. 적 명중 게이지 100%면 장전', cd: .38, rad: .9, pierce: 2, col: 0x6ad0ff }];
let cw = 0;
const wLvl = w => save.wl[w] || 1;
const wCd = w => WEAPONS[w].cd * (1 - .06 * (wLvl(w) - 1));
const wRad = w => WEAPONS[w].rad * (1 + .1 * (wLvl(w) - 1));
const wPierce = w => w === 2 ? 2 + (wLvl(w) - 1) : (w === 0 && wLvl(w) >= 4 ? 1 : 0);
const upCost = w => 30 * wLvl(w);
function collectShot(nx, ny, mult, pierce, pshot, dmg) {   // 발사 순간에 조준점 기준으로 맞는 대상을 확정(표적 태그와 일치)
  const hits = []; let t0 = 0;
  for (let k = 0; k <= pierce; k++) {
    const h = pickHit(nx, ny, t0).best; if (!h) break; h.mult = mult; h.dmg = dmg || 1; if (dmg === .5) h.sg = true; if (pshot) h.pshot = true; hits.push(h);
    const blocked = (h.kind === 'knight' || h.kind === 'core') && h.g.gmode === 'block' && !pshot;
    if (blocked || h.kind === 'wall' || h.kind === 'core') break;
    t0 += h.t + .25;
  }
  return hits;
}
function applyShot(hits) { for (const h of hits) { const stop = applyHit(h); if (stop || h.kind === 'wall' || h.kind === 'core') break; } }
function resolveShot(nx, ny, mult, pierce, pshot, dmg) { applyShot(collectShot(nx, ny, mult, pierce, pshot, dmg)); }
function selectWeapon(w) { cw = w; proj.material.color.setHex(WEAPONS[w].col); renderBar(); }
function renderBar() {
  const b = $('bot'); b.innerHTML = '';
  WEAPONS.forEach((W, i) => { const d = document.createElement('div'); d.textContent = `${W.n} Lv${wLvl(i)}`; d.style.pointerEvents = 'auto'; d.style.cursor = 'pointer'; d.style.display = 'inline-block'; d.style.margin = '0 .6vmin'; d.style.borderColor = i === cw ? '#ffd54a' : 'rgba(255,255,255,.25)'; d.style.opacity = i === cw ? 1 : .65; d.style.background = i === cw ? 'rgba(80,60,0,.7)' : 'rgba(0,0,0,.5)'; d.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); selectWeapon(i); }; d.dataset.i = i; b.appendChild(d); });
  updBar();
}
function updBar() {
  const b = $('bot'); if (!b) return;
  [...b.children].forEach(d => { const i = +d.dataset.i; if (isNaN(i)) return; const W = WEAPONS[i];
    let t = `[${i + 1}] ${W.n} Lv${wLvl(i)}`;
    if (i < 2) t += reloadT > 0 && reloadW === i ? ' 장전중…' : ` ${ammo[i]}/${MAG[i].n}`;
    else t += ammo[2] > 0 ? ` ${ammo[2]}발 · 방패 관통` : ` 게이지 ${Math.round(gauge)}%`;
    if (d.textContent !== t) d.textContent = t; });
}
window.addEventListener('keydown', e => {
  if (!started || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === '1' || k === '2' || k === '3') { selectWeapon(+k - 1); }
  else if (k === 'r') {
    if (cw === 2) { $('tc').innerHTML = '관통탄은 장전 불가<br>적 명중 게이지를 채우세요'; flashT = .8; return; }
    if (reloadT <= 0 && ammo[cw] < MAG[cw].n) { reloadT = MAG[cw].rl * (ZR.rl || 1); reloadW = cw; }
  }
});
const NAMES = { chest: '상자', chest_gold: '황금 상자', coin_stack_large: '큰 동전더미', coin_stack_medium: '동전더미', key: '열쇠', box_small: '작은 상자', barrel_large: '큰 통', barrel_small: '작은 통', barrel_small_stack: '쌓인 통', keg: '술통', bottle_A_green: '초록 병', bottle_B_brown: '갈색 병', plate_food_A: '접시', stool: '의자', candle_triple: '촛대', table_long: '긴 탁자', table_medium: '탁자', chair: '의자', pillar: '기둥', column: '돌기둥', rubble_large: '큰 잔해', rubble_half: '잔해' };
function dexHTML() { const e = Object.entries(save.dex).sort((a, b) => b[1] - a[1]); return e.length ? e.map(([k, v]) => `${NAMES[k] || k} ×${v}`).join(' · ') : '아직 없음'; }
function shopHTML() {
  return `<div class="coinline">보유 코인 <b>${save.coins}</b></div><div class="cards">` + WEAPONS.map((W, i) => { const L = wLvl(i); return `<div class="card"><div class="cn">${W.n} <span>Lv${L}/5</span></div><div class="cd">${W.d}</div>` + (L >= 5 ? '<div class="cm">최대</div>' : `<button class="up" data-w="${i}" ${save.coins >= upCost(i) ? '' : 'disabled'}>강화 ${upCost(i)}</button>`) + '</div>'; }).join('') + `</div><div class="dex">수집 도감: ${dexHTML()}</div><button class="recbtn">기록 보기</button><div class="recwrap"></div>`;
}
function recHTML() {
  const acc = save.shots ? Math.round(save.hits / save.shots * 100) : 0; const bt = save.bestTime[ZONE];
  const rows = save.hist.slice().reverse().map(h => `<tr><td>${h.z ? THEMES[h.z - 1].n + ' ' : ''}${h.v}번째</td><td>${h.t}초</td><td>${h.a}%</td><td>${h.c}</td></tr>`).join('') || '<tr><td colspan=4>아직 기록 없음</td></tr>';
  return `<div class="rec"><div class="rg"><div><b>${save.plays}</b>플레이</div><div><b>${save.clears}</b>클리어</div><div><b>${bt ? bt + '초' : '-'}</b>최단(구역${ZONE})</div><div><b>${acc}%</b>누적 명중률</div><div><b>${save.props}</b>부순 소품</div><div><b>${save.coins}</b>보유 코인</div></div><table><tr><th>방문</th><th>시간</th><th>명중</th><th>코인</th></tr>${rows}</table></div>`;
}
function bindRec(box) { const b = box.querySelector('.recbtn'); if (!b) return; b.onclick = () => { const r = box.querySelector('.recwrap'); const on = !r.innerHTML; r.innerHTML = on ? recHTML() : ''; b.textContent = on ? '상점으로' : '기록 보기'; const bx = document.querySelector('#ov .box'); bx && bx.classList.toggle('showrec', on); }; }
function bindShop(box) { bindRec(box); box.querySelectorAll('.up').forEach(b => { b.onclick = () => { const w = +b.dataset.w; if (save.coins >= upCost(w) && wLvl(w) < 5) { save.coins -= upCost(w); save.wl[w]++; writeSave(save); renderBar(); box.innerHTML = shopHTML(); bindShop(box); } }; }); bindRec(box.parentElement || box); }
function fire(nx, ny) {
  if (cooldown > 0 || false) return;
  if (!TEST) {
    if (reloadT > 0 && reloadW === cw) return;
    if (cw === 2 && ammo[2] <= 0) { $('tc').innerHTML = '관통탄 탄약 없음<br>적을 명중해 게이지 충전'; flashT = .7; return; }
    ammo[cw]--; if (cw < 2 && ammo[cw] <= 0) { reloadT = MAG[cw].rl * (ZR.rl || 1); reloadW = cw; }
  }
  cooldown = TEST ? 0 : wCd(cw); shots++; sfx('shot');
  if (TEST) { const { best } = pickHit(nx, ny); if (best) applyHit(best); return; }
  const N = cw === 1 ? 9 : 1;
  for (let q = 0; q < N; q++) {
    let ax = nx, ay = ny;
    if (cw === 1) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * .16; ax += Math.cos(a) * r * .6; ay += Math.sin(a) * r; }
    const { best, far } = pickHit(ax, ay);
    const target = best ? (best.wp || best.p) : far;
    const dist = ORIGIN.distanceTo(target);
    const spd = cw === 0 ? 60 : cw === 1 ? 34 + Math.random() * 14 : 90;
    flying.push({ from: ORIGIN.clone(), to: target.clone(), t: 0, dur: Math.max(.08, dist / spd), hit: best, hits: collectShot(ax, ay, cw === 1 ? .62 : wRad(cw), wPierce(cw), cw === 2, cw === 1 ? .5 : 1), kind: cw });
  }
}
const GEO = { cap: new THREE.CapsuleGeometry(.06, .34, 4, 8), pel: new THREE.SphereGeometry(.07, 8, 6), spike: new THREE.ConeGeometry(.09, 1.1, 8), trail: new THREE.CylinderGeometry(.03, .005, 1, 6, 1, true) };
function mkProj(kind) {
  const col = WEAPONS[kind].col, grp = new THREE.Group();
  const bodyG = kind === 0 ? GEO.cap : kind === 1 ? GEO.pel : GEO.spike;
  const body = new THREE.Mesh(bodyG, new THREE.MeshBasicMaterial({ color: kind === 2 ? 0xe8fbff : kind === 0 ? 0xfff3b0 : 0xffc890 }));
  const halo = new THREE.Mesh(bodyG, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(1.7);
  const len = kind === 0 ? 1.4 : kind === 1 ? .9 : 3.2;
  const tr = new THREE.Mesh(GEO.trail, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  tr.scale.set(kind === 2 ? 2.2 : 1, len, kind === 2 ? 2.2 : 1); tr.position.y = -len / 2 - (kind === 2 ? .45 : .15);
  if (kind === 2) { body.rotation.x = 0; body.position.y = .1; halo.position.y = .1; }
  grp.add(body, halo, tr); sc.add(grp); return grp;
}
const UPV = new THREE.Vector3(0, 1, 0), DIRV = new THREE.Vector3();
function updateFlying(dt) {
  for (let i = flying.length - 1; i >= 0; i--) {
    const f = flying[i]; f.t += dt; const u = Math.min(1, f.t / f.dur);
    if (!f.m) { f.m = mkProj(f.kind || 0); DIRV.subVectors(f.to, f.from).normalize(); f.m.quaternion.setFromUnitVectors(UPV, DIRV); }
    f.m.position.lerpVectors(f.from, f.to, u);
    if (f.kind === 1) f.m.position.y -= 0.35 * u * u * 0.4;
    if (u >= 1) { if (f.hits) applyShot(f.hits); else if (f.hit) applyHit(f.hit); sc.remove(f.m); flying.splice(i, 1); }
  }
  proj.visible = false;
}

// ---------- 붕괴와 결과 ----------
function collapse(g) {
  sfx('collapse'); for (const c in g.marks) { sc.remove(g.marks[c].sp); } g.marks = {};
  const { K, CORE, kv } = g; g.kstate = 'collapse'; g.collapseT = 0; g.aura.material.opacity = 0; setStatus();
  for (let i = 0; i < K.n; i++) {
    if (!K.alive[i]) continue;
    let dx = K.pos[i * 3] - CORE.x, dy = K.pos[i * 3 + 1] - CORE.y, dz = K.pos[i * 3 + 2] - CORE.z; const l = Math.hypot(dx, dy, dz) + .01;
    const sp = (1 + Math.random() * 3) * Math.max(.6, g.rel); kv[i * 3] = dx / l * sp; kv[i * 3 + 1] = dy / l * sp * .5 + .3 + Math.random() * 1.8; kv[i * 3 + 2] = dz / l * sp * .8;
  }
  burst(CORE.x + g.off, CORE.y, CORE.z, 120, 240, 255, 60, 12, .09); shake = .7;
  addCoins(g.elite ? 300 : 100, g.off, g.slot.H * 1.2, g.slot.z);
}
function updateCollapse(g, dt) {
  const { K, kv, kpt } = g; g.collapseT += dt; const collapseT = g.collapseT;
  if (g.coreMesh) { const k = Math.max(0, 1 - collapseT * 2.2); const cm = g.coreMesh; cm.scale.setScalar(Math.max(.001, k)); cm.position.set(g.CORE.x * (1 - k) + g.off, g.CORE.y * (1 - k), g.CORE.z * (1 - k)); if (k <= 0 && cm.visible) { cm.visible = false; cm.userData.light.intensity = 0; } }
  for (let i = 0; i < K.n; i++) {
    if (!K.alive[i]) continue;
    kv[i * 3 + 1] -= 14 * dt;
    K.pos[i * 3] += kv[i * 3] * dt; K.pos[i * 3 + 1] += kv[i * 3 + 1] * dt; K.pos[i * 3 + 2] += kv[i * 3 + 2] * dt;
    if (K.pos[i * 3 + 1] < FLOOR + kpt * .5) { K.pos[i * 3 + 1] = FLOOR + kpt * .5; kv[i * 3 + 1] *= -.25; kv[i * 3] *= .6; kv[i * 3 + 2] *= .6; }
    const sz = collapseT > 3.0 ? Math.max(0, 1 - (collapseT - 3.0) / 1.2) : 1;
    setM(K.mesh, i, K.pos[i * 3], K.pos[i * 3 + 1], K.pos[i * 3 + 2], kpt * 1.02 * sz);
  }
  K.mesh.instanceMatrix.needsUpdate = true;
  if (collapseT > 4.4 && g.kstate === 'collapse') { g.kstate = 'done'; if (GS.every(q => q.kstate === 'done')) showResult(); else setStatus(); }
}
function updateGuardian(g, dt) {
  g.gT += dt; g.age = (g.age || 0) + dt;
  const gopen = g.slot.gopen * D_OPEN * (GTYPES[g.key].go || 1), gblock = g.slot.gblock * D_BLOCK * (ZR.blk || 1) * (GTYPES[g.key].gb || 1);
  if (g.gmode === 'open' && g.gT > gopen) { g.gmode = 'warn'; g.gT = 0; sfx('warn'); }
  else if (g.gmode === 'warn' && g.gT > GWARN) { g.gmode = 'block'; g.gT = 0; }
  else if (g.gmode === 'block' && g.gT > gblock) { g.gmode = 'open'; g.gT = 0; }
  const sp = g.gmode === 'open' ? 1 : g.gmode === 'warn' ? .35 : 0;
  g.mt = (g.mt || 0) + dt; const mv = MOVEP[g.key] ? MOVEP[g.key](g.mt + g.slot.x) : 1; g.ph += dt * D_SPEED * mv * (2 * Math.PI / g.slot.per) * sp; g.off = g.slot.x + g.slot.amp * Math.sin(g.ph);
  { const tb = Math.abs(Math.sin(g.ph * 5)) * .11 * sp; g.bob = (g.bob || 0) + (tb - (g.bob || 0)) * Math.min(1, dt * 14); }
  g.K.mesh.position.set(g.off, g.bob, 0); for (const c in g.marks) { const m = g.marks[c]; m.sp.position.set(m.x + g.off, m.y + .04 + g.bob, m.z + .25); m.sp.material.opacity = g.gmode === 'block' ? .25 : .55 + .35 * Math.sin(g.age * 6); m.sp.scale.setScalar(.3 + .04 * Math.sin(g.age * 6)); } g.sh.position.x = g.off; g.aura.position.x = g.off;
  if (g.coreMesh) { g.coreMesh.position.set(g.off, g.bob, 0); g.coreMesh.userData.light.position.set(g.CORE.x + g.off, g.CORE.y + .2 + g.bob, g.CORE.z + 1.2); }
  g.aura.material.opacity = g.gmode === 'block' ? .28 : g.gmode === 'warn' ? .1 + .08 * Math.sin(g.gT * 40) : 0;
}
const t0 = performance.now(); let elapsed = 0;
function showResult() {
  save.plays++; save.clears++; save.coins += totalCoins; save.props += propsBroken; save.visits[ZONE] = VISIT; { const nz = nextZone(ZONE); if (!save.unlocked.includes(ZONE)) save.unlocked.push(ZONE); if (!save.unlocked.includes(nz)) save.unlocked.push(nz); } save.shots += shots; save.hits += hitsLanded; save.hist.push({ z: ZONE, v: VISIT, t: Math.round(elapsed), c: totalCoins, a: shots ? Math.round(hitsLanded / shots * 100) : 0 }); if (save.hist.length > 8) save.hist.shift();
  const bt = save.bestTime[ZONE]; if (!bt || elapsed < bt) save.bestTime[ZONE] = Math.round(elapsed);
  if (!TEST) writeSave(save);
  const acc = shots ? Math.round(hitsLanded / shots * 100) : 0;
  const ov = $('ov'); ov.style.display = 'flex';
  ov.firstElementChild.innerHTML = `<h1>구역 ${ZONE} ${T.n} 클리어</h1><p>코인 ${totalCoins}<br>부순 소품 ${propsBroken}/${TOTAL_PROPS}<br>걸린 시간 ${Math.round(elapsed)}초 · 명중률 ${acc}%</p><div class="shop"></div><p style="opacity:.7;font-size:13px">다음 방문에서는 수호자 구성과 소품 위치가 바뀝니다.</p><button id="nextz" class="alt">다음 구역: ${THEMES[nextZone(ZONE) - 1].n}</button> <button id="again" class="alt">다시 도전 (${VISIT + 1}번째 방문)</button>`;
  { const sh_ = ov.querySelector('.shop'); sh_.innerHTML = shopHTML(); bindShop(sh_); }
  $('nextz').onclick = () => { save.zone = nextZone(ZONE); writeSave(save); const u = new URL(location.href); u.searchParams.delete('visit'); u.searchParams.delete('zone'); location.href = u.toString(); };
  $('again').onclick = () => { save.visits[ZONE] = VISIT; writeSave(save); const u = new URL(location.href); u.searchParams.delete('visit'); location.href = u.toString(); };
}

// ---------- 입력 ----------
const cross = $('cross');
function ndc(e) { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
let crossTag = null;
let lastAim = null;
function aimInfo(nx, ny) {
  const h = pickHit(nx, ny).best; if (!h) return null;
  const pierceSel = cw === 2;
  if (h.kind === 'core') return h.g.gmode === 'block' && !pierceSel ? ['#6ab0ff', '방어중'] : ['#ff5a5a', h.g.gmode === 'block' ? '코어 (관통!)' : '코어!'];
  if (h.kind === 'knight') { const c = h.g.K.cat[h.i], P = h.g.PARTS[c];
    if (P && P.alive) { if (h.g.gmode === 'block') return pierceSel ? ['#6ae0ff', P.name + ' (방패 관통!)'] : ['#6ab0ff', '방어중']; return ['#5aff7a', P.name]; }
    return ['#aaaaaa', '몸통(단단)']; }
  return null;
}
let hlG = null, hlC = -1;
const flashQ = [];
function paintCat(G, C, k) { if (!G || C < 0 || !G.K.mesh.instanceColor) return; const K = G.K; for (let i = 0; i < K.n; i++) if (K.cat[i] == C && K.alive[i]) { const v = K.v[i]; col.setRGB(Math.min(1, v[3] / 255 * k + (k > 1 ? .12 : 0)), Math.min(1, v[4] / 255 * k + (k > 1 ? .12 : 0)), Math.min(1, v[5] / 255 * k + (k > 1 ? .12 : 0)), THREE.SRGBColorSpace); K.mesh.setColorAt(i, col); } K.mesh.instanceColor.needsUpdate = true; }
function setHL(g, c) { if (hlG === g && hlC === c) return; paintCat(hlG, hlC, 1); hlG = g; hlC = c; paintCat(g, c, 1.55); }
function flashPart(g, c) { if (TEST) return; const f = flashQ.find(x => x.g === g && x.c === c); if (f) { f.t = .07; return; } paintCat(g, c, 1.9); flashQ.push({ g, c, t: .07 }); }   // 이미 번쩍이는 중이면 타이머만 연장(재색칠 없음)
function updateFlash(dt) { for (let i = flashQ.length - 1; i >= 0; i--) { const f = flashQ[i]; f.t -= dt; if (f.t <= 0) { paintCat(f.g, f.c, f.g === hlG && f.c === hlC ? 1.55 : 1); flashQ.splice(i, 1); } } }
function showAim() {
  if (!lastAim) return;
  if (!crossTag) { crossTag = document.createElement('div'); crossTag.style.cssText = 'position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:.4vmin;white-space:nowrap;font-size:2vmin;font-weight:800;text-shadow:0 1px 3px #000'; cross.appendChild(crossTag); }
  const a = aimInfo(lastAim[0], lastAim[1]);
  { const hh = pickHit(lastAim[0], lastAim[1]).best; let hg = null, hc = -1; if (hh && hh.kind === 'knight' && a && a[0] !== '#aaaaaa' && a[0] !== '#6ab0ff') { const c = hh.g.K.cat[hh.i]; if (hh.g.PARTS[c] && hh.g.PARTS[c].alive) { hg = hh.g; hc = c; } } setHL(window.__noHL ? null : hg, window.__noHL ? -1 : hc); }
  cross.style.borderColor = a ? a[0] : '#fff'; crossTag.style.color = a ? a[0] : '#fff'; if (crossTag.textContent !== (a ? a[1] : '')) crossTag.textContent = a ? a[1] : '';
}
function moveCross(e) {
  const [nx, ny, px, py] = ndc(e); cross.style.left = (px * 100) + '%'; cross.style.top = (py * 100) + '%'; lastAim = [nx, ny]; showAim();
}
canvas.addEventListener('pointermove', moveCross);
canvas.addEventListener('pointerdown', e => { e.preventDefault(); if (!started) return; moveCross(e); const [nx, ny] = ndc(e); fire(nx, ny); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
if (!TEST) {
  const ov = $('ov'); ov.style.display = 'flex';
  ov.firstElementChild.innerHTML = `<h1>코어브레이커2 : 와장창 던전</h1><p>구역 ${ZONE} ${T.n} · ${VISIT}번째 방문</p><p style="color:#ffd54a">구역 규칙: ${ZR.t}${({ 2: ' · 중장갑 구역', 3: ' · 해골 구역', 6: ' · 해골 구역', 5: ' · 민첩 구역', 7: ' · 민첩 구역', 8: ' · 가운데 ★정예(처치 보상 3배)' })[ZONE] || ''}</p><p class="rules">화면을 눌러 발사합니다.<br>수호자 3명이 움직입니다. 장비(머리 장식, 방패, 무기)를 모두 부수면 코어가 드러납니다.<br>푸른 빛이 나는 동안은 막히니, 빛이 꺼질 때를 노리세요.<br>코어를 맞히면 몸 전체가 무너집니다.</p><div class="zones">${THEMES.map((t, i) => `<button class="zb${i + 1 === ZONE ? ' cur' : ''}" data-z="${i + 1}" ${save.unlocked.includes(i + 1) ? '' : 'disabled'}>${save.unlocked.includes(i + 1) ? t.n : '잠김'}</button>`).join('')}</div><div class="shop"></div><button id="go">시작</button>`;
  ov.querySelectorAll('.zb').forEach(b => { b.onclick = () => { save.zone = +b.dataset.z; writeSave(save); const u = new URL(location.href); u.searchParams.delete('visit'); u.searchParams.delete('zone'); location.href = u.toString(); }; });
  { const sh_ = ov.querySelector('.shop'); sh_.innerHTML = shopHTML(); bindShop(sh_); }
  $('go').onclick = () => { ov.style.display = 'none'; started = true; for (const g of GS) for (const c in g.marks) relocateMark(g, c); };
}

// ---------- 루프 ----------
let last = performance.now();
const shakeBase = cam.position.clone();
function update(dt) {
  if (chainT > 0) chainT -= dt; updateShock(dt); updateFlash(dt);
  if (cooldown > 0) cooldown -= dt;
  if (reloadT > 0) { reloadT -= dt; if (reloadT <= 0) { ammo[reloadW] = MAG[reloadW].n; } }
  updBar();
  if (started && !GS.every(q => q.kstate === 'done')) elapsed += dt;
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) setStatus(); }
  updateFlying(dt); updateDebris(dt); showAim();
  for (const g of GS) { if (MOVE && started && (g.kstate === 'guard' || g.kstate === 'exposed')) updateGuardian(g, dt); if (g.kstate === 'collapse') updateCollapse(g, dt); if (g.coreMesh && g.kstate === 'exposed') { const p = 1 + Math.sin(performance.now() / 160) * .06; g.coreMesh.scale.setScalar(p); } }
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); cam.position.set(shakeBase.x + (Math.random() - .5) * shake * .25, shakeBase.y + (Math.random() - .5) * shake * .2, shakeBase.z); } else cam.position.copy(shakeBase);
}
function frame() { const now = performance.now(); let dt = Math.min(.05, (now - last) / 1000); last = now; if (hitStop > 0) { hitStop -= dt; dt *= .12; } update(dt); renderer.render(sc, cam); requestAnimationFrame(frame); }

// ---------- 테스트 진행(화면 확인용, 시간 시뮬레이션) ----------
function aimAt(p) { const v = p.clone().project(cam); fire(v.x, v.y); }
function sim(sec) { for (let t = 0; t < sec; t += 1 / 30) update(1 / 30); }
function aimFor(match, list) {   // 해당 대상이 실제로 맞는 화면 위치를 찾아 발사
  const step = Math.max(1, Math.floor(list.n / 3000));
  for (let i = 0; i < list.n; i += step) {
    if (!list.alive[i]) continue;
    const v = new THREE.Vector3(list.pos[i * 3] + (list.g ? list.g.off : 0), list.pos[i * 3 + 1], list.pos[i * 3 + 2]).project(cam);
    if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
    const r = pickHit(v.x, v.y).best; if (r && match(r)) { fire(v.x, v.y); return true; }
  }
  return false;
}
function runStage() {
  const info = { stage: STAGE, props: TOTAL_PROPS, unreachable: [] };
  if (STAGE >= 1) {
    const tgt = props.slice(0, Math.min(STAGE === 1 ? 5 : TOTAL_PROPS, props.length));
    for (const e of tgt) { for (let k = 0; k < 40 && !e.dead; k++) { if (!aimFor(r => r.kind === 'prop' && r.e === e, e)) { info.unreachable.push(e.name + ':' + e.count + '/' + e.total + ':z' + e.bb.getCenter(new THREE.Vector3()).z.toFixed(1) + 'x' + e.bb.getCenter(new THREE.Vector3()).x.toFixed(1)); break; } sim(.05); } }
    sim(.3); info.propsBroken = propsBroken; info.coins = totalCoins;
  }
  if (STAGE >= 2) {
    info.parts = 0;
    for (const g of GS) for (const c of [1, 4, 3].filter(c => g.PARTS[c])) { for (let k = 0, w = 0; k < 400 && g.PARTS[c].alive; k++) { if (!aimFor(r => r.kind === 'knight' && r.g === g && g.K.cat[r.i] == c, g.K)) { if (++w > 200) { info.unreachable.push(g.name + ':part' + c + ':hp' + g.PARTS[c].hp + ':' + g.gmode + ':' + g.kstate); break; } sim(.1); continue; } sim(.05); } }
    sim(.5); info.guardians = GS.map(g => g.name + ':' + g.kstate + ':' + g.partsBroken);
  }
  if (STAGE >= 3) { for (const g of GS) { for (let k = 0; k < 30 && g.kstate === 'exposed'; k++) { aimAt(g.CORE.clone().add(new THREE.Vector3(g.off, 0, 0))); sim(.1); } if (g.kstate === 'exposed') info.coreMiss = (info.coreMiss || 0) + 1; } sim(STAGE === 3 ? .45 : STAGE === 4 ? 1.4 : 5); info.guardians = GS.map(g => g.name + ':' + g.kstate); }
  { const rg = GS.map(g => [g.slot.x - g.slot.amp + g.K.bb.min.x, g.slot.x + g.slot.amp + g.K.bb.max.x]); info.gaps = [+(rg[1][0] - rg[0][1]).toFixed(2), +(rg[2][0] - rg[1][1]).toFixed(2)]; info.edge = [+rg[0][0].toFixed(2), +rg[2][1].toFixed(2)]; }
  if (q.get('adv')) { sim(+q.get('adv')); info.off = GS.map(g => +g.off.toFixed(2)); info.modes = GS.map(g => g.gmode); }
  info.hits = hitsLanded; info.shots = shots;
  document.title = 'done:' + JSON.stringify(info);
  const d = document.createElement('div'); d.id = 'info'; d.style.cssText = 'position:fixed;left:0;top:0;color:#0f0;font-size:9px'; d.textContent = 'done:' + JSON.stringify(info); document.body.appendChild(d);
  renderer.render(sc, cam);
}
window.__cb2 = { ZR, collapse, breakProp, explodeAt, get DSPEED() { return D_SPEED; }, get totalCoinsNow() { return totalCoins; }, addCoins, MAGS: MAG, projectPoint: (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(cam); return [v.x, v.y]; }, aimInfo, showAim, get lastAim() { return lastAim; }, breakPart, update, fire, ammo, get gauge() { return gauge; }, get reloadT() { return reloadT; }, gaugeUp, save, pickHit, resolveShot, selectWeapon, WEAPONS, get cw() { return cw; }, GS, get deflects() { return deflects; }, cam, flying, get hits() { return hitsLanded; }, get broken() { return propsBroken; }, sim, fire, aimAt, props, get coins() { return totalCoins; } };
setStatus(); selectWeapon(+(q.get('w') || 0));
if (TEST) runStage(); else frame();
