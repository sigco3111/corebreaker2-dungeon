import * as THREE from './three.module.js';
const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const STAGE = +(q.get('stage') || 0);        // 테스트용: 스크립트 진행 단계
const TEST = STAGE > 0;
const ZONE = +(q.get('zone') || 2);
const SAVE_KEY = 'cb2.save.v1';
function loadSave() { try { return Object.assign({ plays: 0, clears: 0, coins: 0, props: 0, visits: {}, bestTime: {} }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { return { plays: 0, clears: 0, coins: 0, props: 0, visits: {}, bestTime: {} }; } }
function writeSave(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { } }
const save = loadSave();
const VISIT = +(q.get('visit') || ((save.visits[ZONE] || 0) + 1));

const THEMES = [
  { n: '술창고', p: ['barrel_large', 'barrel_small', 'barrel_small_stack', 'keg', 'bottle_A_green', 'bottle_B_brown', 'box_small'], fl: 'floor_dirt_large', c: 0xffb060 },
  { n: '보물방', p: ['chest', 'chest_gold', 'coin_stack_large', 'coin_stack_medium', 'key', 'box_small'], fl: 'floor_tile_large', c: 0xffd070 },
  { n: '연회장', p: ['table_long', 'table_medium', 'chair', 'stool', 'plate_food_A', 'candle_triple', 'bottle_A_green'], fl: 'floor_tile_large', c: 0xff9a50 },
  { n: '무너진 회랑', p: ['rubble_large', 'rubble_half', 'crates_stacked', 'box_large', 'column', 'barrel_small'], fl: 'floor_dirt_large', c: 0xa0b8ff },
  { n: '기둥의 방', p: ['pillar', 'column', 'candle_triple', 'chest', 'box_small', 'coin_stack_medium'], fl: 'floor_tile_large', c: 0xb0a0ff },
  { n: '침실과 서재', p: ['bed_frame', 'shelf_large', 'shelf_small', 'chair', 'table_medium', 'candle_triple', 'bottle_B_brown'], fl: 'floor_tile_large', c: 0xffa070 },
  { n: '창고', p: ['box_stacked', 'crates_stacked', 'box_large', 'box_small', 'barrel_large', 'barrel_small_stack'], fl: 'floor_dirt_large', c: 0xffc080 },
  { n: '무기고', p: ['shelf_large', 'shelf_small', 'crates_stacked', 'box_large', 'keg'], fl: 'floor_tile_large', c: 0xff8a60 }];
const T = THEMES[(ZONE - 1) % 8];
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
const [P, KD] = await Promise.all([fetch('props.json').then(r => r.json()), fetch('knight_demo.json').then(r => r.json())]);
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
function breakProp(e) {
  e.dead = true; propsBroken++;
  let c = 0;
  for (let i = 0; i < e.n; i++) if (e.alive[i]) { removeVoxel(e, i, (c++ % 3) === 0, null); }
  e.mesh.instanceMatrix.needsUpdate = true; sc.remove(e.mesh);
  const cx = e.bb.getCenter(new THREE.Vector3());
  const coins = 1 + Math.min(4, Math.floor(e.total / 700));
  burst(cx.x, cx.y, cx.z, 255, 213, 74, 14, 6, .08);
  addCoins(coins * 10, cx.x, cx.y + .4, cx.z);
}

// ---------- 지형 ----------
const J0 = -3;
for (let i = -1; i <= 1; i++) for (let j = J0; j < 3; j++) put(T.fl, i * 4.2, -2.1 - j * 4.2);
const FEAT = { 1: ['platR', 'nicheL'], 2: ['platL', 'platR'], 3: ['cols'], 4: ['brokencols', 'rubble'], 5: ['cols', 'nicheL', 'nicheR'], 6: ['nicheL', 'platR'], 7: ['platL', 'platR'], 8: ['nicheL', 'nicheR', 'cols2'] }[ZONE];
const WV = ['wall', 'wall', 'wall_cracked', 'wall_arched', 'wall_broken', 'wall_doorway'];
for (let i = -1; i <= 1; i++) { const w_ = WV[Math.floor(R() * WV.length)]; if ((i == -1 && FEAT.includes('nicheL')) || (i == 1 && FEAT.includes('nicheR'))) continue; put(w_, i * 4.2, -12.6, 1); }
for (let j = J0; j < 3; j++) { put(WV[Math.floor(R() * WV.length)], -6.9, -2.1 - j * 4.2, 1, Math.PI / 2); put(WV[Math.floor(R() * WV.length)], 6.9, -2.1 - j * 4.2, 1, -Math.PI / 2); }
const nt = 2 + Math.floor(R() * 3);
for (let i = 0; i < nt; i++) { const side = R() < .5 ? -1 : 1; const z = -3 - R() * 8; put('torch_mounted', side * 6.0, z, 1.0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 1.9); const pl = new THREE.PointLight(T.c, 14, 7, 1.6); pl.position.set(side * 5.5, 2.4, z); sc.add(pl); }

// 수호자 (Knight)
const KZ = -6.2, KS = 1.5;
const kvAll = KD.vox.filter(v => v[6] !== 2 && v[6] !== 5);
const kpt = KD.pitch * KS;
let kcx = 0, kcz = 0; kvAll.forEach(v => { kcx += v[0]; kcz += v[2]; }); kcx /= kvAll.length; kcz /= kvAll.length;
const K = { n: kvAll.length, pt: kpt };
K.mesh = new THREE.InstancedMesh(box, mat, K.n); K.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); K.mesh.frustumCulled = false;
K.pos = new Float32Array(K.n * 3); K.cat = new Uint8Array(K.n); K.alive = new Uint8Array(K.n).fill(1); K.v = kvAll.map(v => [0, 0, 0, v[3], v[4], v[5]]);
K.grid = new Map(); K.count = K.n;
kvAll.forEach((v, i) => {
  const x = (v[0] - kcx) * kpt, y = (v[1] + .5) * kpt, z = KZ + (v[2] - kcz) * kpt;
  K.pos[i * 3] = x; K.pos[i * 3 + 1] = y; K.pos[i * 3 + 2] = z; K.cat[i] = v[6];
  setM(K.mesh, i, x, y, z, kpt * 1.02); col.setRGB(v[3] / 255, v[4] / 255, v[5] / 255, THREE.SRGBColorSpace); K.mesh.setColorAt(i, col);
  const k = key(Math.floor(x / kpt), Math.floor(y / kpt), Math.floor(z / kpt)); (K.grid.get(k) || K.grid.set(k, []).get(k)).push(i);
});
K.bb = new THREE.Box3(); for (let i = 0; i < K.n; i++) K.bb.expandByPoint(O.position.set(K.pos[i * 3], K.pos[i * 3 + 1], K.pos[i * 3 + 2])); K.bb.expandByScalar(kpt);
sc.add(K.mesh);
const sh = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .45 })); sh.rotation.x = -Math.PI / 2; sh.position.set(0, .02, KZ); sc.add(sh);
const PARTS = { 1: { name: '투구', hp: 3, alive: true }, 4: { name: '방패', hp: 3, alive: true }, 3: { name: '검', hp: 2, alive: true } };
for (const c in PARTS) { PARTS[c].total = 0; }
for (let i = 0; i < K.n; i++) if (PARTS[K.cat[i]]) PARTS[K.cat[i]].total++;
const CORE = new THREE.Vector3(0, 1.45, KZ + 0.2);
let kstate = 'guard'; // guard | exposed | collapse | done
let partsBroken = 0;
function setStatus() {
  if (kstate === 'guard') $('tc').innerHTML = `수호 기사<br>장비 ${partsBroken}/3 파괴`;
  else if (kstate === 'exposed') $('tc').innerHTML = `수호 기사<br>코어 노출! 코어를 맞히세요`;
  else $('tc').innerHTML = `수호 기사<br>코어 파괴`;
}
$('tl').innerHTML = `구역 ${ZONE}/8 ${T.n}<br><small>${VISIT}번째 방문</small>`;
setStatus();

// 코어
let coreMesh = null, coreMat = null;
function exposeCore() {
  kstate = 'exposed'; setStatus();
  for (let i = 0; i < K.n; i++) if (K.alive[i] && K.cat[i] === 0) {
    const dx = K.pos[i * 3] - CORE.x, dy = K.pos[i * 3 + 1] - CORE.y, dz = K.pos[i * 3 + 2] - CORE.z;
    if (dx * dx + dy * dy + dz * dz < .55 * .55) { K.alive[i] = 0; K.count--; K.mesh.setMatrixAt(i, ZERO); if (Math.random() < .5) spawnDebris(K.pos[i * 3], K.pos[i * 3 + 1], K.pos[i * 3 + 2], K.v[i][3], K.v[i][4], K.v[i][5], (Math.random() - .5) * 3, Math.random() * 3, Math.random() * 3, kpt, 0); }
  }
  K.mesh.instanceMatrix.needsUpdate = true;
  const pts = []; const rr = .34, cp = .07;
  for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) for (let c = -5; c <= 5; c++) { if (a * a + b * b + c * c <= 25 && a * a + b * b + c * c >= 12) pts.push([a * cp, b * cp, c * cp]); }
  coreMat = new THREE.MeshBasicMaterial({ color: 0x66f0ff });
  coreMesh = new THREE.InstancedMesh(box, coreMat, pts.length);
  pts.forEach((p, i) => setM(coreMesh, i, CORE.x + p[0], CORE.y + p[1], CORE.z + p[2], cp * 1.05));
  coreMesh.frustumCulled = false; sc.add(coreMesh);
  const pl = new THREE.PointLight(0x66f0ff, 5, 4, 1.8); pl.position.set(CORE.x, CORE.y + .2, CORE.z + 1.2); sc.add(pl); coreMesh.userData.light = pl;
  burst(CORE.x, CORE.y, CORE.z, 120, 240, 255, 30, 8, .07);
  shake = .5;
}
function breakPart(c) {
  const pt = PARTS[c]; pt.alive = false; partsBroken++; let k = 0;
  for (let i = 0; i < K.n; i++) if (K.alive[i] && K.cat[i] == c) {
    K.alive[i] = 0; K.count--; K.mesh.setMatrixAt(i, ZERO);
    if ((k++ % 4) === 0) spawnDebris(K.pos[i * 3], K.pos[i * 3 + 1], K.pos[i * 3 + 2], K.v[i][3], K.v[i][4], K.v[i][5], (Math.random() - .5) * 8, Math.random() * 6 + 1, Math.random() * 6, kpt, 0);
  }
  K.mesh.instanceMatrix.needsUpdate = true; shake = .35;
  addCoins(20, 0, 2.6, KZ + .5);
  if (partsBroken === 3) exposeCore(); else setStatus();
}
function hitKnight(h) {
  const c = K.cat[h.i];
  if (kstate === 'collapse' || kstate === 'done') return;
  if (PARTS[c] && PARTS[c].alive) {
    const pt = PARTS[c]; pt.hp--;
    let k = 0;
    for (let i = 0; i < K.n; i++) if (K.alive[i] && K.cat[i] == c) {
      const dx = K.pos[i * 3] - h.p.x, dy = K.pos[i * 3 + 1] - h.p.y, dz = K.pos[i * 3 + 2] - h.p.z;
      if (dx * dx + dy * dy + dz * dz < .3 * .3) { K.alive[i] = 0; K.count--; K.mesh.setMatrixAt(i, ZERO); if ((k++ % 2) == 0) spawnDebris(K.pos[i * 3], K.pos[i * 3 + 1], K.pos[i * 3 + 2], K.v[i][3], K.v[i][4], K.v[i][5], (Math.random() - .5) * 5, Math.random() * 4 + 1, Math.random() * 5, kpt, 0); }
    }
    K.mesh.instanceMatrix.needsUpdate = true; shake = .15;
    if (pt.hp <= 0) breakPart(c);
  } else {
    burst(h.p.x, h.p.y, h.p.z, 200, 200, 210, 6, 4, .05);   // 몸통은 코어 전까지 깎이지 않음
    flashText('몸통은 단단하다. 장비를 먼저!');
  }
}
let flashT = 0;
function flashText(t) { if (kstate !== 'guard') return; $('tc').innerHTML = `수호 기사<br>${t}`; flashT = .8; }

// 구조물 (측면 단 등)
const obst = [[0, KZ, 2.3], [0, -4.2, 2.4]];
function block(x, z, w, d, h, y0, tint) {
  const pt = 0.2, nx = Math.round(w / pt), nz = Math.round(d / pt), ny = Math.round(h / pt); const cells = [];
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) { const edge = i == 0 || i == nx - 1 || k == 0 || k == nz - 1 || j == ny - 1; if (!edge) continue; cells.push([x - w / 2 + (i + .5) * pt, y0 + (j + .5) * pt, z - d / 2 + (k + .5) * pt, j == ny - 1]); }
  const m = new THREE.InstancedMesh(box, mat, cells.length);
  cells.forEach((c, i) => { setM(m, i, c[0], c[1], c[2], pt * 1.02); const v = (R() * .12) - .06; const t = c[3] ? 0.5 : 0.4; col.setRGB(t + v + tint[0], t + v + tint[1], t + v + tint[2]); m.setColorAt(i, col); });
  sc.add(m);
}
function platform(side, h) {
  const w = 2.8, d = 4.4, zc = -5.0 - R() * 3.5, x = side * (6.1 - w / 2 - 0.05);
  block(x, zc, w, d, h, 0, [0, 0, 0.03 * side]);
  const n = 3 + Math.floor(R() * 3); const pp = [];
  for (let k = 0, t = 0; k < n && t < 60; t++) {
    const px = x + (R() * 2 - 1) * (w / 2 - .55), pz = zc + (R() * 2 - 1) * (d / 2 - .55);
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
  zs.forEach(z => { [-1, 1].forEach(sd => { const x = sd * (3.7 + R() * .3); if (broken && R() < .6) { put('column', x, z, 1.5, 0, 0, true); put('rubble_half', x + (R() - .5) * .6, z + .3, .7, R() * 3, 0, true); } else put('pillar', x, z, 1.0, 0, 0, true); obst.push([x, z, 1.0]); }); });
}
const big = ZONE == 2 || ZONE == 7;
FEAT.forEach(f => {
  if (f == 'platL') platform(-1, big ? 0.8 + R() * .4 : 0.6); else if (f == 'platR') platform(1, big ? 0.8 + R() * .4 : 0.6);
  else if (f == 'nicheL') niche(-1); else if (f == 'nicheR') niche(1);
  else if (f == 'cols') columns(false, 3); else if (f == 'cols2') columns(false, 2); else if (f == 'brokencols') columns(true, 3);
  else if (f == 'rubble') { [-1, 1].forEach(sd => { const x = sd * (3.6 + R() * 1.2), z = -3.6 - R() * 7; put('rubble_large', x, z, .8, R() * 6, 0, true); obst.push([x, z, 1.8]); }); }
});
// 부술 물체: 카메라 기준 약 4.8~9.2m 뒤 구간(z -4.8..-9.2), 가운데 통로와 수호자 주변은 비움
const placed = obst.slice(); const cnt = 10 + Math.floor(R() * 5);
for (let k = 0, t = 0; k < cnt && t < 400; t++) {
  const x = (R() * 2 - 1) * 5.2, z = -4.8 - R() * 4.4;
  if (Math.abs(x) < 2.0 && z > KZ - 2.2) continue;
  const nm = T.p[Math.floor(R() * T.p.length)]; const d = P[nm]; if (!d) continue;
  const sz_ = 0.85 + R() * .35; const rad = Math.max(d.size[0], d.size[2]) * d.pitch * sz_ * .55;
  if (placed.some(p => Math.hypot(p[0] - x, p[1] - z) < p[2] + rad)) continue;
  placed.push([x, z, rad]); put(nm, x, z, sz_, Math.floor(R() * 4) * Math.PI / 2 + (R() - .5) * .4, 0, true); k++;
}
{ const LOW = ['box_small', 'coin_stack_medium', 'bottle_A_green', 'plate_food_A', 'stool', 'candle_triple', 'barrel_small'];
  for (let k = 0, t = 0; k < 4 && t < 100; t++) { const x = (R() * 2 - 1) * 5, z = -2.4 - R() * 2.0; if (Math.abs(x) < 2.4) continue; const nm = LOW[Math.floor(R() * LOW.length)]; const d = P[nm]; if (!d) continue; const rad = Math.max(d.size[0], d.size[2]) * d.pitch * .6; if (placed.some(p => Math.hypot(p[0] - x, p[1] - z) < p[2] + rad)) continue; placed.push([x, z, rad]); put(nm, x, z, 1.0, Math.floor(R() * 4) * Math.PI / 2, 0, true); k++; } }
const TOTAL_PROPS = props.length;

// ---------- 사격 ----------
const proj = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd54a }));
proj.visible = false; sc.add(proj);
const flying = [];
let cooldown = 0, started = TEST, shake = 0;
const rc = new THREE.Raycaster();
function pickHit(nx, ny) {
  rc.setFromCamera(new THREE.Vector2(nx, ny), cam);
  ray.copy(rc.ray);
  let best = null;
  for (const e of props) { if (e.dead) continue; const h = marchVoxels(e, ray); if (h && (!best || h.t < best.t)) best = { kind: 'prop', e, ...h }; }
  if (kstate !== 'collapse' && kstate !== 'done') {
    const h = marchVoxels(K, ray); if (h && (!best || h.t < best.t)) best = { kind: 'knight', ...h };
    if (kstate === 'exposed') { const sp = new THREE.Sphere(CORE, .42); const pt = ray.intersectSphere(sp, new THREE.Vector3()); if (pt) { const t = pt.distanceTo(ray.origin); if (!best || t < best.t + .05) best = { kind: 'core', t, p: pt }; } }
  }
  return { best, far: ray.at(30, new THREE.Vector3()) };
}
function applyHit(h) {
  hitsLanded++;
  if (h.kind === 'prop') { burst(h.p.x, h.p.y, h.p.z, 255, 240, 200, 5, 3, .04); damageProp(h.e, h.p, .55); }
  else if (h.kind === 'knight') hitKnight(h);
  else if (h.kind === 'core') collapse();
}
const ORIGIN = new THREE.Vector3(.8, 1.6, 10.4);
function fire(nx, ny) {
  if (cooldown > 0 || kstate === 'collapse' || kstate === 'done') return;
  cooldown = TEST ? 0 : .22; shots++;
  const { best, far } = pickHit(nx, ny);
  const target = best ? best.p : far;
  if (TEST) { if (best) applyHit(best); return; }
  const dist = ORIGIN.distanceTo(target);
  flying.push({ from: ORIGIN.clone(), to: target.clone(), t: 0, dur: Math.max(.08, dist / 55), hit: best });
}
function updateFlying(dt) {
  for (let i = flying.length - 1; i >= 0; i--) {
    const f = flying[i]; f.t += dt; const u = Math.min(1, f.t / f.dur);
    proj.visible = true; proj.position.lerpVectors(f.from, f.to, u);
    if (u >= 1) { if (f.hit) applyHit(f.hit); flying.splice(i, 1); proj.visible = flying.length > 0; }
  }
}

// ---------- 붕괴와 결과 ----------
let collapseT = 0; const kv = new Float32Array(K.n * 3);
function collapse() {
  kstate = 'collapse'; setStatus(); collapseT = 0;
  for (let i = 0; i < K.n; i++) {
    if (!K.alive[i]) continue;
    let dx = K.pos[i * 3] - CORE.x, dy = K.pos[i * 3 + 1] - CORE.y, dz = K.pos[i * 3 + 2] - CORE.z; const l = Math.hypot(dx, dy, dz) + .01;
    const sp = 1 + Math.random() * 3; kv[i * 3] = dx / l * sp; kv[i * 3 + 1] = dy / l * sp * .5 + .3 + Math.random() * 1.8; kv[i * 3 + 2] = dz / l * sp * .8;
  }
  burst(CORE.x, CORE.y, CORE.z, 120, 240, 255, 60, 12, .09); shake = .7;
  if (coreMesh) { coreMesh.userData.t = 0; }
  addCoins(100, 0, 3.0, KZ);
}
function updateCollapse(dt) {
  collapseT += dt;
  if (coreMesh) { const k = Math.max(0, 1 - collapseT * 2.2); coreMesh.scale.setScalar(Math.max(.001, k)); coreMesh.position.set(CORE.x * (1 - k), CORE.y * (1 - k), CORE.z * (1 - k)); if (k <= 0 && coreMesh.visible) { coreMesh.visible = false; coreMesh.userData.light.intensity = 0; } }
  for (let i = 0; i < K.n; i++) {
    if (!K.alive[i]) continue;
    kv[i * 3 + 1] -= 14 * dt;
    K.pos[i * 3] += kv[i * 3] * dt; K.pos[i * 3 + 1] += kv[i * 3 + 1] * dt; K.pos[i * 3 + 2] += kv[i * 3 + 2] * dt;
    if (K.pos[i * 3 + 1] < FLOOR + kpt * .5) { K.pos[i * 3 + 1] = FLOOR + kpt * .5; kv[i * 3 + 1] *= -.25; kv[i * 3] *= .6; kv[i * 3 + 2] *= .6; }
    const sz = collapseT > 3.0 ? Math.max(0, 1 - (collapseT - 3.0) / 1.2) : 1;
    setM(K.mesh, i, K.pos[i * 3], K.pos[i * 3 + 1], K.pos[i * 3 + 2], kpt * 1.02 * sz);
  }
  K.mesh.instanceMatrix.needsUpdate = true;
  if (collapseT > 4.4 && kstate === 'collapse') { kstate = 'done'; showResult(); }
}
const t0 = performance.now(); let elapsed = 0;
function showResult() {
  save.plays++; save.clears++; save.coins += totalCoins; save.props += propsBroken; save.visits[ZONE] = VISIT;
  const bt = save.bestTime[ZONE]; if (!bt || elapsed < bt) save.bestTime[ZONE] = Math.round(elapsed);
  if (!TEST) writeSave(save);
  const acc = shots ? Math.round(hitsLanded / shots * 100) : 0;
  const ov = $('ov'); ov.style.display = 'flex';
  ov.firstElementChild.innerHTML = `<h1>구역 ${ZONE} ${T.n} 클리어</h1><p>코인 ${totalCoins}<br>부순 소품 ${propsBroken}/${TOTAL_PROPS}<br>걸린 시간 ${Math.round(elapsed)}초 · 명중률 ${acc}%</p><p style="opacity:.7;font-size:13px">다음 방문에서는 소품의 종류와 위치가 바뀝니다.</p><button id="again">다시 도전 (${VISIT + 1}번째 방문)</button>`;
  $('again').onclick = () => { save.visits[ZONE] = VISIT; writeSave(save); const u = new URL(location.href); u.searchParams.delete('visit'); location.href = u.toString(); };
}

// ---------- 입력 ----------
const cross = $('cross');
function ndc(e) { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
function moveCross(e) { const [, , px, py] = ndc(e); cross.style.left = (px * 100) + '%'; cross.style.top = (py * 100) + '%'; }
canvas.addEventListener('pointermove', moveCross);
canvas.addEventListener('pointerdown', e => { e.preventDefault(); if (!started) return; moveCross(e); const [nx, ny] = ndc(e); fire(nx, ny); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
if (!TEST) {
  const ov = $('ov'); ov.style.display = 'flex';
  ov.firstElementChild.innerHTML = `<h1>코어브레이커2 : 와장창 던전</h1><p>구역 ${ZONE} ${T.n} · ${VISIT}번째 방문</p><p>화면을 눌러 발사합니다.<br>수호자의 장비(투구, 방패, 검)를 모두 부수면 코어가 드러납니다.<br>코어를 맞히면 몸 전체가 무너집니다.</p><button id="go">시작</button>`;
  $('go').onclick = () => { ov.style.display = 'none'; started = true; };
}

// ---------- 루프 ----------
let last = performance.now();
const shakeBase = cam.position.clone();
function update(dt) {
  if (cooldown > 0) cooldown -= dt;
  if (started && kstate !== 'done') elapsed += dt;
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) setStatus(); }
  updateFlying(dt); updateDebris(dt);
  if (kstate === 'collapse') updateCollapse(dt);
  if (coreMesh && kstate === 'exposed') { const p = 1 + Math.sin(performance.now() / 160) * .06; coreMesh.scale.setScalar(p); }
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); cam.position.set(shakeBase.x + (Math.random() - .5) * shake * .25, shakeBase.y + (Math.random() - .5) * shake * .2, shakeBase.z); } else cam.position.copy(shakeBase);
}
function frame() { const now = performance.now(); const dt = Math.min(.05, (now - last) / 1000); last = now; update(dt); renderer.render(sc, cam); requestAnimationFrame(frame); }

// ---------- 테스트 진행(화면 확인용, 시간 시뮬레이션) ----------
function aimAt(p) { const v = p.clone().project(cam); fire(v.x, v.y); }
function sim(sec) { for (let t = 0; t < sec; t += 1 / 30) update(1 / 30); }
function centroid(pred) { let mz=-1e9; for (let i = 0; i < K.n; i++) if (K.alive[i] && pred(i) && K.pos[i*3+2]>mz) mz=K.pos[i*3+2]; const c = new THREE.Vector3(); let n = 0; for (let i = 0; i < K.n; i++) if (K.alive[i] && pred(i) && K.pos[i*3+2]>mz-.08) { c.x += K.pos[i * 3]; c.y += K.pos[i * 3 + 1]; c.z += K.pos[i * 3 + 2]; n++; } return n ? c.multiplyScalar(1 / n) : null; }
function centroidOld(pred) { const c = new THREE.Vector3(); let n = 0; for (let i = 0; i < K.n; i++) if (K.alive[i] && pred(i)) { c.x += K.pos[i * 3]; c.y += K.pos[i * 3 + 1]; c.z += K.pos[i * 3 + 2]; n++; } return n ? c.multiplyScalar(1 / n) : null; }
function aimFor(match, list) {   // 해당 대상이 실제로 맞는 화면 위치를 찾아 발사
  const step = Math.max(1, Math.floor(list.n / 400));
  for (let i = 0; i < list.n; i += step) {
    if (!list.alive[i]) continue;
    const v = new THREE.Vector3(list.pos[i * 3], list.pos[i * 3 + 1], list.pos[i * 3 + 2]).project(cam);
    if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
    const r = pickHit(v.x, v.y).best; if (r && match(r)) { fire(v.x, v.y); return true; }
  }
  return false;
}
function runStage() {
  const info = { stage: STAGE, props: TOTAL_PROPS, unreachable: [] };
  if (STAGE >= 1) {
    const tgt = props.slice(0, Math.min(STAGE === 1 ? 5 : TOTAL_PROPS, props.length));
    for (const e of tgt) { for (let k = 0; k < 40 && !e.dead; k++) { if (!aimFor(r => r.kind === 'prop' && r.e === e, e)) { info.unreachable.push(e.name); break; } sim(.05); } }
    sim(.3); info.propsBroken = propsBroken; info.coins = totalCoins;
  }
  if (STAGE >= 2) {
    for (const c of [1, 4, 3]) { for (let k = 0; k < 30 && PARTS[c].alive; k++) { if (!aimFor(r => r.kind === 'knight' && K.cat[r.i] == c, K)) { info.unreachable.push('part' + c); break; } sim(.05); } }
    sim(.5); info.kstate = kstate; info.partsBroken = partsBroken;
  }
  if (STAGE >= 3) { aimAt(CORE); sim(STAGE === 3 ? .45 : STAGE === 4 ? 1.4 : 5); info.kstate = kstate; }
  info.hits = hitsLanded; info.shots = shots;
  document.title = 'done:' + JSON.stringify(info);
  const d = document.createElement('div'); d.id = 'info'; d.style.cssText = 'position:fixed;left:0;top:0;color:#0f0;font-size:9px'; d.textContent = 'done:' + JSON.stringify(info); document.body.appendChild(d);
  renderer.render(sc, cam);
}
window.__cb2 = { cam, flying, get hits() { return hitsLanded; }, get broken() { return propsBroken; }, sim, fire, aimAt, props, K, PARTS, get state() { return kstate; }, get coins() { return totalCoins; } };
if (TEST) runStage(); else frame();
