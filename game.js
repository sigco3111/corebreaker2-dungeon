import * as THREE from './three.module.js';
const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const STAGE = +(q.get('stage') || 0);        // 테스트용: 스크립트 진행 단계
const TEST = STAGE !== 0;
const ZONE = +(q.get('zone') || 2);
const SAVE_KEY = 'cb2.save.v1';
const SAVE_DEF = () => ({ plays: 0, clears: 0, coins: 0, props: 0, visits: {}, bestTime: {}, wl: [1, 1, 1], dex: {} });
function loadSave() { try { const o = Object.assign(SAVE_DEF(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); if (!Array.isArray(o.wl) || o.wl.length !== 3) o.wl = [1, 1, 1]; if (!o.dex || typeof o.dex !== 'object') o.dex = {}; return o; } catch (e) { return SAVE_DEF(); } }
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
const [P, KD, GB, GM] = await Promise.all([fetch('props.json').then(r => r.json()), fetch('knight_demo.json').then(r => r.json()), fetch('guardians/barbarian.json').then(r => r.json()), fetch('guardians/mage.json').then(r => r.json())]);
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
  e.dead = true; propsBroken++; save.dex[e.name] = (save.dex[e.name] || 0) + 1;
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

// ---------- 수호자들 (기사, 야만전사, 마법사) ----------
const GTYPES = {
  knight: { name: '기사', d: KD, legacy: true, parts: { 1: ['투구', 3], 4: ['방패', 3], 3: ['검', 2] } },
  barbarian: { name: '야만전사', d: GB, parts: { 1: ['털모자', 3], 4: ['방패', 3], 3: ['도끼', 2] } },
  mage: { name: '마법사', d: GM, parts: { 1: ['모자', 3], 4: ['마법서', 3], 3: ['마법봉', 2] } } };
const SLOTS = [
  { x: -3.0, z: -6.5, H: 2.0, amp: .4, per: 4.8, gopen: 2.4, gblock: 1.2 },
  { x: 0, z: -7.6, H: 2.2, amp: .4, per: 6.0, gopen: 3.0, gblock: 1.4 },
  { x: 3.0, z: -6.5, H: 2.0, amp: .4, per: 4.2, gopen: 2.0, gblock: 1.1 }];
const GOKEYS = ['knight', 'barbarian', 'mage'];
const GWARN = .5;
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
    out.push([e.x, e.y, e.z, e.r / e.n, e.g / e.n, e.b / e.n, cat]);
  }
  return out;
}
function makeGuardian(typeKey, slot, idx) {
  const T_ = GTYPES[typeKey], D = T_.d;
  const hgt = D.height || 81, pitch = D.pitch;
  const scale = slot.H / ((hgt + 1) * pitch);
  const kpt = pitch * scale * 2;                        // 2x2x2 묶음이므로 복셀 크기 2배
  const rel = kpt / .045;
  const kv0 = downsample(D.vox.filter(v => v[6] !== 5)).filter(v => v[6] !== 2);
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
  K.g = g; return g;
}
{
  const keys = []; // 방문마다 구성이 바뀜: 기사/야만전사/마법사를 섞어서 3체
  for (let i = 0; i < 3; i++) keys.push(GOKEYS[Math.floor(R() * 3)]);
  if (new Set(keys).size === 1) keys[1] = GOKEYS[(GOKEYS.indexOf(keys[0]) + 1) % 3];   // 최소 2종류
  const slots = SLOTS.map(s_ => ({ ...s_ }));
  keys.forEach((k, i) => GS.push(makeGuardian(k, slots[i], i)));
}
let KOFF = 0;   // (호환용) 사용 안 함
const MOVE = !TEST || q.get('move') === '1';
let flashT = 0, deflects = 0;
function gStatus(g) {
  if (g.kstate === 'guard') return `${g.name} 장비 ${g.partsBroken}/3`;
  if (g.kstate === 'exposed') return `${g.name} <span style="color:#7ff">코어 노출!</span>`;
  return `${g.name} 처치`;
}
function setStatus() { const left = GS.filter(g => g.kstate !== 'collapse' && g.kstate !== 'done').length; $('tc').innerHTML = `수호자 ${GS.length - left}/${GS.length} 처치<br>` + GS.map(gStatus).join(' · '); }
function flashText(t) { $('tc').innerHTML = t; flashT = .8; }
const flashSetStatusSoon = () => { };
function exposeCore(g) {
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
function breakPart(g, c) {
  const { K } = g; const pt = g.PARTS[c]; pt.alive = false; g.partsBroken++; let k = 0;
  for (let i = 0; i < K.n; i++) if (K.alive[i] && K.cat[i] == c) {
    K.alive[i] = 0; K.count--; K.mesh.setMatrixAt(i, ZERO);
    if ((k++ % 3) === 0) spawnDebris(K.pos[i * 3] + g.off, K.pos[i * 3 + 1], K.pos[i * 3 + 2], K.v[i][3], K.v[i][4], K.v[i][5], (Math.random() - .5) * 8, Math.random() * 6 + 1, Math.random() * 6, g.kpt, 0);
  }
  K.mesh.instanceMatrix.needsUpdate = true; shake = .35;
  addCoins(20, g.off, g.slot.H * 1.1, g.slot.z + .5);
  if (g.partsBroken === 3) exposeCore(g); else setStatus();
}
function hitKnight(h) {
  const g = h.g, K = g.K, c = K.cat[h.i];
  if (g.kstate === 'collapse' || g.kstate === 'done') return;
  if (g.PARTS[c] && g.PARTS[c].alive) {
    const pt = g.PARTS[c]; pt.hp--;
    let k = 0; const cr = .3 * g.rel * (h.mult || 1); if ((h.mult || 1) >= 1.8) pt.hp--;
    for (let i = 0; i < K.n; i++) if (K.alive[i] && K.cat[i] == c) {
      const dx = K.pos[i * 3] - h.p.x, dy = K.pos[i * 3 + 1] - h.p.y, dz = K.pos[i * 3 + 2] - h.p.z;
      if (dx * dx + dy * dy + dz * dz < cr * cr) { K.alive[i] = 0; K.count--; K.mesh.setMatrixAt(i, ZERO); if ((k++ % 2) == 0) spawnDebris(K.pos[i * 3] + g.off, K.pos[i * 3 + 1], K.pos[i * 3 + 2], K.v[i][3], K.v[i][4], K.v[i][5], (Math.random() - .5) * 5, Math.random() * 4 + 1, Math.random() * 5, g.kpt, 0); }
    }
    K.mesh.instanceMatrix.needsUpdate = true; shake = .15;
    if (pt.hp <= 0) breakPart(g, c);
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
let cooldown = 0, started = TEST, shake = 0;
const rc = new THREE.Raycaster();
function pickHit(nx, ny, t0 = 0) {
  rc.setFromCamera(new THREE.Vector2(nx, ny), cam);
  ray.copy(rc.ray); if (t0) ray.origin.addScaledVector(ray.direction, t0);
  let best = null;
  for (const e of props) { if (e.dead) continue; const h = marchVoxels(e, ray); if (h && (!best || h.t < best.t)) best = { kind: 'prop', e, ...h }; }
  for (const g of GS) {
    if (g.kstate === 'collapse' || g.kstate === 'done') continue;
    const kr = new THREE.Ray(ray.origin.clone().sub(new THREE.Vector3(g.off, 0, 0)), ray.direction); const h = marchVoxels(g.K, kr);
    if (h && (!best || h.t < best.t)) best = { kind: 'knight', g, ...h, wp: h.p.clone().add(new THREE.Vector3(g.off, 0, 0)) };
    if (g.kstate === 'exposed') { const sp = new THREE.Sphere(g.CORE.clone().add(new THREE.Vector3(g.off, 0, 0)), .42 * Math.max(.9, g.rel)); const pt = ray.intersectSphere(sp, new THREE.Vector3()); if (pt) { const t = pt.distanceTo(ray.origin); if (!best || t < best.t + .05) best = { kind: 'core', g, t, p: pt }; } }
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
function applyHit(h) {
  hitsLanded++;
  if ((h.kind === 'knight' || h.kind === 'core') && h.g.gmode === 'block') {
    const q = h.wp || h.p; burst(q.x, q.y, q.z, 150, 190, 255, 8, 4, .05); shake = Math.max(shake, .1);
    $('tc').innerHTML = '수호자 방어!<br>막혔다'; flashT = .6; deflects++; return 'stop';
  }
  if (h.kind === 'prop') { burst(h.p.x, h.p.y, h.p.z, 255, 240, 200, 5, 3, .04); damageProp(h.e, h.p, .55 * (h.mult || 1)); }
  else if (h.kind === 'knight') hitKnight(h);
  else if (h.kind === 'core') collapse(h.g);
  else if (h.kind === 'wall') burst(h.p.x, h.p.y, h.p.z, 255, 220, 120, 4, 2, .03);
}
const ORIGIN = new THREE.Vector3(.8, 1.6, 10.4);
// ---------- 무기 3종 (기본탄 / 범위탄 / 관통탄), 각 5단계 강화 ----------
const WEAPONS = [
  { n: '기본탄', d: '빠르게 연사', cd: .22, rad: 1, pierce: 0, col: 0xffd54a },
  { n: '범위탄', d: '넓게 깨짐, 장비에 2배 피해', cd: .5, rad: 2.0, pierce: 0, col: 0xff7a4a },
  { n: '관통탄', d: '여러 물체를 뚫음', cd: .38, rad: .9, pierce: 2, col: 0x6ad0ff }];
let cw = 0;
const wLvl = w => save.wl[w] || 1;
const wCd = w => WEAPONS[w].cd * (1 - .06 * (wLvl(w) - 1));
const wRad = w => WEAPONS[w].rad * (1 + .1 * (wLvl(w) - 1));
const wPierce = w => w === 2 ? 2 + (wLvl(w) - 1) : (w === 0 && wLvl(w) >= 4 ? 1 : 0);
const upCost = w => 30 * wLvl(w);
function resolveShot(nx, ny, mult, pierce) {
  let t0 = 0;
  for (let k = 0; k <= pierce; k++) {
    const h = pickHit(nx, ny, t0).best; if (!h) break; h.mult = mult;
    const stop = applyHit(h); if (stop || h.kind === 'wall' || h.kind === 'core') break;
    t0 += h.t + .25;
  }
}
function selectWeapon(w) { cw = w; proj.material.color.setHex(WEAPONS[w].col); renderBar(); }
function renderBar() {
  const b = $('bot'); b.innerHTML = '';
  WEAPONS.forEach((W, i) => { const d = document.createElement('div'); d.textContent = `${W.n} Lv${wLvl(i)}`; d.style.pointerEvents = 'auto'; d.style.cursor = 'pointer'; d.style.display = 'inline-block'; d.style.margin = '0 .6vmin'; d.style.borderColor = i === cw ? '#ffd54a' : 'rgba(255,255,255,.25)'; d.style.opacity = i === cw ? 1 : .65; d.style.background = i === cw ? 'rgba(80,60,0,.7)' : 'rgba(0,0,0,.5)'; d.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); selectWeapon(i); }; b.appendChild(d); });
}
const NAMES = { chest: '상자', chest_gold: '황금 상자', coin_stack_large: '큰 동전더미', coin_stack_medium: '동전더미', key: '열쇠', box_small: '작은 상자', barrel_large: '큰 통', barrel_small: '작은 통', barrel_small_stack: '쌓인 통', keg: '술통', bottle_A_green: '초록 병', bottle_B_brown: '갈색 병', plate_food_A: '접시', stool: '의자', candle_triple: '촛대', table_long: '긴 탁자', table_medium: '탁자', chair: '의자', pillar: '기둥', column: '돌기둥', rubble_large: '큰 잔해', rubble_half: '잔해' };
function dexHTML() { const e = Object.entries(save.dex).sort((a, b) => b[1] - a[1]); return e.length ? e.map(([k, v]) => `${NAMES[k] || k} ×${v}`).join(' · ') : '아직 없음'; }
function shopHTML() {
  return `<div style="margin:1.2vmin 0;font-size:1.9vmin">보유 코인 <b>${save.coins}</b></div>` + WEAPONS.map((W, i) => { const L = wLvl(i); return `<div style="margin:.6vmin 0;font-size:1.8vmin">${W.n} Lv${L}/5 <span style="opacity:.7">${W.d}</span> ` + (L >= 5 ? '<b>최대</b>' : `<button class="up" data-w="${i}" ${save.coins >= upCost(i) ? '' : 'disabled'}>강화 ${upCost(i)}코인</button>`) + '</div>'; }).join('') + `<div style="margin-top:1vmin;font-size:1.5vmin;opacity:.85">수집 도감: ${dexHTML()}</div>`;
}
function bindShop(box) { box.querySelectorAll('.up').forEach(b => { b.onclick = () => { const w = +b.dataset.w; if (save.coins >= upCost(w) && wLvl(w) < 5) { save.coins -= upCost(w); save.wl[w]++; writeSave(save); renderBar(); box.innerHTML = shopHTML(); bindShop(box); } }; }); }
function fire(nx, ny) {
  if (cooldown > 0 || false) return;
  cooldown = TEST ? 0 : wCd(cw); shots++;
  const { best, far } = pickHit(nx, ny);
  const target = best ? (best.wp || best.p) : far;
  if (TEST) { if (best) applyHit(best); return; }
  const dist = ORIGIN.distanceTo(target);
  flying.push({ from: ORIGIN.clone(), to: target.clone(), t: 0, dur: Math.max(.08, dist / 55), hit: best, n: [nx, ny], mult: wRad(cw), pierce: wPierce(cw) });
}
function updateFlying(dt) {
  for (let i = flying.length - 1; i >= 0; i--) {
    const f = flying[i]; f.t += dt; const u = Math.min(1, f.t / f.dur);
    proj.visible = true; proj.position.lerpVectors(f.from, f.to, u);
    if (u >= 1) { if (f.n) resolveShot(f.n[0], f.n[1], f.mult, f.pierce); else if (f.hit) applyHit(f.hit); flying.splice(i, 1); proj.visible = flying.length > 0; }
  }
}

// ---------- 붕괴와 결과 ----------
function collapse(g) {
  const { K, CORE, kv } = g; g.kstate = 'collapse'; g.collapseT = 0; g.aura.material.opacity = 0; setStatus();
  for (let i = 0; i < K.n; i++) {
    if (!K.alive[i]) continue;
    let dx = K.pos[i * 3] - CORE.x, dy = K.pos[i * 3 + 1] - CORE.y, dz = K.pos[i * 3 + 2] - CORE.z; const l = Math.hypot(dx, dy, dz) + .01;
    const sp = (1 + Math.random() * 3) * Math.max(.6, g.rel); kv[i * 3] = dx / l * sp; kv[i * 3 + 1] = dy / l * sp * .5 + .3 + Math.random() * 1.8; kv[i * 3 + 2] = dz / l * sp * .8;
  }
  burst(CORE.x + g.off, CORE.y, CORE.z, 120, 240, 255, 60, 12, .09); shake = .7;
  addCoins(100, g.off, g.slot.H * 1.2, g.slot.z);
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
  g.gT += dt;
  const gopen = g.slot.gopen, gblock = g.slot.gblock;
  if (g.gmode === 'open' && g.gT > gopen) { g.gmode = 'warn'; g.gT = 0; }
  else if (g.gmode === 'warn' && g.gT > GWARN) { g.gmode = 'block'; g.gT = 0; }
  else if (g.gmode === 'block' && g.gT > gblock) { g.gmode = 'open'; g.gT = 0; }
  const sp = g.gmode === 'open' ? 1 : g.gmode === 'warn' ? .35 : 0;
  g.ph += dt * (2 * Math.PI / g.slot.per) * sp; g.off = g.slot.x + g.slot.amp * Math.sin(g.ph);
  g.K.mesh.position.x = g.off; g.sh.position.x = g.off; g.aura.position.x = g.off;
  if (g.coreMesh) { g.coreMesh.position.x = g.off; g.coreMesh.userData.light.position.x = g.CORE.x + g.off; }
  g.aura.material.opacity = g.gmode === 'block' ? .28 : g.gmode === 'warn' ? .1 + .08 * Math.sin(g.gT * 40) : 0;
}
const t0 = performance.now(); let elapsed = 0;
function showResult() {
  save.plays++; save.clears++; save.coins += totalCoins; save.props += propsBroken; save.visits[ZONE] = VISIT;
  const bt = save.bestTime[ZONE]; if (!bt || elapsed < bt) save.bestTime[ZONE] = Math.round(elapsed);
  if (!TEST) writeSave(save);
  const acc = shots ? Math.round(hitsLanded / shots * 100) : 0;
  const ov = $('ov'); ov.style.display = 'flex';
  ov.firstElementChild.innerHTML = `<h1>구역 ${ZONE} ${T.n} 클리어</h1><p>코인 ${totalCoins}<br>부순 소품 ${propsBroken}/${TOTAL_PROPS}<br>걸린 시간 ${Math.round(elapsed)}초 · 명중률 ${acc}%</p><div class="shop"></div><p style="opacity:.7;font-size:13px">다음 방문에서는 수호자 구성과 소품 위치가 바뀝니다.</p><button id="again">다시 도전 (${VISIT + 1}번째 방문)</button>`;
  { const sh_ = ov.querySelector('.shop'); sh_.innerHTML = shopHTML(); bindShop(sh_); }
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
  ov.firstElementChild.innerHTML = `<h1>코어브레이커2 : 와장창 던전</h1><p>구역 ${ZONE} ${T.n} · ${VISIT}번째 방문</p><p>화면을 눌러 발사합니다.<br>수호자 3명이 움직입니다. 장비(머리 장식, 방패, 무기)를 모두 부수면 코어가 드러납니다.<br>푸른 빛이 나는 동안은 막히니, 빛이 꺼질 때를 노리세요.<br>코어를 맞히면 몸 전체가 무너집니다.</p><div class="shop"></div><button id="go">시작</button>`;
  { const sh_ = ov.querySelector('.shop'); sh_.innerHTML = shopHTML(); bindShop(sh_); }
  $('go').onclick = () => { ov.style.display = 'none'; started = true; };
}

// ---------- 루프 ----------
let last = performance.now();
const shakeBase = cam.position.clone();
function update(dt) {
  if (cooldown > 0) cooldown -= dt;
  if (started && !GS.every(q => q.kstate === 'done')) elapsed += dt;
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) setStatus(); }
  updateFlying(dt); updateDebris(dt);
  for (const g of GS) { if (MOVE && started && (g.kstate === 'guard' || g.kstate === 'exposed')) updateGuardian(g, dt); if (g.kstate === 'collapse') updateCollapse(g, dt); if (g.coreMesh && g.kstate === 'exposed') { const p = 1 + Math.sin(performance.now() / 160) * .06; g.coreMesh.scale.setScalar(p); } }
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); cam.position.set(shakeBase.x + (Math.random() - .5) * shake * .25, shakeBase.y + (Math.random() - .5) * shake * .2, shakeBase.z); } else cam.position.copy(shakeBase);
}
function frame() { const now = performance.now(); const dt = Math.min(.05, (now - last) / 1000); last = now; update(dt); renderer.render(sc, cam); requestAnimationFrame(frame); }

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
    for (const e of tgt) { for (let k = 0; k < 40 && !e.dead; k++) { if (!aimFor(r => r.kind === 'prop' && r.e === e, e)) { info.unreachable.push(e.name); break; } sim(.05); } }
    sim(.3); info.propsBroken = propsBroken; info.coins = totalCoins;
  }
  if (STAGE >= 2) {
    info.parts = 0;
    for (const g of GS) for (const c of [1, 4, 3]) { for (let k = 0; k < 30 && g.PARTS[c].alive; k++) { if (!aimFor(r => r.kind === 'knight' && r.g === g && g.K.cat[r.i] == c, g.K)) { info.unreachable.push(g.name + ':part' + c); break; } sim(.05); } }
    sim(.5); info.guardians = GS.map(g => g.name + ':' + g.kstate + ':' + g.partsBroken);
  }
  if (STAGE >= 3) { for (const g of GS) if (g.kstate === 'exposed') { aimAt(g.CORE.clone().add(new THREE.Vector3(g.off, 0, 0))); sim(.1); } sim(STAGE === 3 ? .45 : STAGE === 4 ? 1.4 : 5); info.guardians = GS.map(g => g.name + ':' + g.kstate); }
  { const rg = GS.map(g => [g.slot.x - g.slot.amp + g.K.bb.min.x, g.slot.x + g.slot.amp + g.K.bb.max.x]); info.gaps = [+(rg[1][0] - rg[0][1]).toFixed(2), +(rg[2][0] - rg[1][1]).toFixed(2)]; info.edge = [+rg[0][0].toFixed(2), +rg[2][1].toFixed(2)]; }
  if (q.get('adv')) { sim(+q.get('adv')); info.off = GS.map(g => +g.off.toFixed(2)); info.modes = GS.map(g => g.gmode); }
  info.hits = hitsLanded; info.shots = shots;
  document.title = 'done:' + JSON.stringify(info);
  const d = document.createElement('div'); d.id = 'info'; d.style.cssText = 'position:fixed;left:0;top:0;color:#0f0;font-size:9px'; d.textContent = 'done:' + JSON.stringify(info); document.body.appendChild(d);
  renderer.render(sc, cam);
}
window.__cb2 = { save, pickHit, resolveShot, selectWeapon, WEAPONS, get cw() { return cw; }, GS, get deflects() { return deflects; }, cam, flying, get hits() { return hitsLanded; }, get broken() { return propsBroken; }, sim, fire, aimAt, props, get coins() { return totalCoins; } };
setStatus(); selectWeapon(+(q.get('w') || 0));
if (TEST) runStage(); else frame();
