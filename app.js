// VILAQG — landing page v4 (estilo igloo.inc)
// 216 cubos de "gelo" que mudam de forma conforme a rolagem:
// cubo → prédio → esfera de rede → painel de barras → cubo.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ═════════ Texto embaralhado ═════════ */
const GLYPHS = '!<>-_\\/[]{}=+*^?#01';
function scramble(el, text = el.dataset.text || el.textContent, dur = 800) {
  el.dataset.text = text;
  if (reduce) { el.textContent = text; return; }
  cancelAnimationFrame(el._raf);
  const start = performance.now();
  const tick = (now) => {
    const t = clamp((now - start) / dur);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const revealAt = (i / text.length) * 0.6 + 0.4;
      out += ch === ' ' || t >= revealAt ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (t < 1) el._raf = requestAnimationFrame(tick);
  };
  el._raf = requestAnimationFrame(tick);
}

/* ═════════ Carregador ASCII ═════════ */
const bar = $('[data-bar]');
const pct = $('[data-pct]');
let loadShown = 0;
let loadTarget = 0.15;
let loaded = false;
let loaderLast = performance.now();
// Avança por tempo (não por frame): celular lento não fica preso no carregador
function loaderTick(now = performance.now()) {
  const dt = Math.min((now - loaderLast) / 1000, 0.25);
  loaderLast = now;
  loadShown = Math.min(loadTarget, loadShown + dt * 0.9);
  const n = 20, f = Math.round(loadShown * n);
  bar.textContent = `[${'='.repeat(f)}${'+'.repeat(Math.min(3, n - f))}${'-'.repeat(Math.max(0, n - f - 3))}]`;
  pct.textContent = String(Math.round(loadShown * 100)).padStart(3, '0');
  if (loadShown >= 0.999) return finishLoading();
  requestAnimationFrame(loaderTick);
}
function finishLoading() {
  if (loaded) return;
  loaded = true;
  document.documentElement.classList.remove('is-loading');
  document.documentElement.classList.add('is-loaded');
  $$('.hud [data-scramble]').forEach((el) => scramble(el));
  setActiveChapter(currentChapter(), true);
}
requestAnimationFrame(loaderTick);
document.fonts?.ready.then(() => { loadTarget = Math.max(loadTarget, 0.45); });
setTimeout(() => { loadTarget = 1; }, 7000); // nunca prende o visitante no carregador

/* ═════════ Capítulos + HUD ═════════ */
const chapters = $$('[data-chapter]');
const hudIndex = $('[data-hud-index]');
const hudLabel = $('[data-hud-label]');
const hudPct = $('[data-hud-pct]');
let activeChapter = -1;

function currentChapter() {
  const mid = innerHeight * 0.5;
  let best = 0;
  chapters.forEach((c, i) => { if (c.getBoundingClientRect().top <= mid) best = i; });
  return best;
}
function setActiveChapter(i, force = false) {
  if (i === activeChapter && !force) return;
  activeChapter = i;
  chapters.forEach((c, k) => c.classList.toggle('is-active', k === i));
  hudIndex.textContent = String(i).padStart(2, '0');
  scramble(hudLabel, chapters[i].dataset.label, 600);
  const kicker = $('.kicker [data-scramble], .kicker[data-scramble]', chapters[i]);
  if (kicker) scramble(kicker, undefined, 900);
}

/* ═════════ Rolagem ═════════ */
let scrollTarget = 0; // capítulo "contínuo": 0 → 4
function readScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = max > 0 ? clamp(scrollY / max) : 0;
  scrollTarget = p * (chapters.length - 1);
  hudPct.textContent = String(Math.round(p * 100)).padStart(3, '0');
  if (loaded) setActiveChapter(currentChapter());
}
addEventListener('scroll', readScroll, { passive: true });
readScroll();

/* ═════════ Cena 3D ═════════ */
const canvas = $('.webgl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch {
  document.documentElement.classList.add('no-webgl');
  loadTarget = 1;
}

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0d0f13, 14, 34);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const world = new THREE.Group();
  scene.add(world);

  scene.add(new THREE.AmbientLight(0xbfd0e6, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(5, 8, 6);
  scene.add(key);

  /* ── Cubos de gelo ── */
  const N = 216;
  const geo = new RoundedBoxGeometry(0.5, 0.5, 0.5, 3, 0.07);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.16,
    metalness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    iridescence: 0.55,
    iridescenceIOR: 1.3,
    sheen: 0.4,
    sheenColor: new THREE.Color(0x9fc3ff),
  });
  const cubes = new THREE.InstancedMesh(geo, mat, N);
  cubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  world.add(cubes);

  // Cores: gelo, com alguns cubos em vermelho VILAQG (sempre os mesmos)
  const ice = new THREE.Color(0xdfe7f0);
  const red = new THREE.Color(0xe84545);
  const slate = new THREE.Color(0x5d6675);
  const rng = mulberry32(7);
  const accent = Array.from({ length: N }, () => rng() < 0.1); // cubos vermelhos das formas "neutras"
  for (let i = 0; i < N; i++) cubes.setColorAt(i, ice);

  // Direção e eixo aleatórios de cada cubo, usados no "estilhaço" entre formas
  const scatter = Array.from({ length: N }, () => new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(0.8 + rng() * 1.6));
  const spinAxis = Array.from({ length: N }, () => new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize());

  /* ── As 5 formações ──
     Cada cubo tem, por formação: posição, escala, giro no eixo Y e cor.
     Barras ainda têm base + altura, para "respirar" como dados ao vivo. */
  const F = [];
  const make = (fn, live = null, anim = null) => {
    const f = { pos: [], scl: [], yaw: [], col: [], base: [], h: [], live, anim };
    for (let i = 0; i < N; i++) {
      const o = fn(i);
      f.pos.push(o.p); f.scl.push(o.s); f.yaw.push(o.yaw || 0);
      f.col.push(o.c || (accent[i] ? red : ice));
      f.base.push(o.base ?? null); f.h.push(o.h ?? 0);
    }
    return f;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ONE = V(1, 1, 1);
  const TAU = Math.PI * 2;

  // 0 · rack de servidor
  //   0–55    4 colunas (14 cubos cada)
  //   56–85   tampa de cima e de baixo (5×3 cada)
  //   86–117  8 gavetas × 4 cubos
  //   118–141 8 gavetas × 3 LEDs
  //   142–215 espiral de "dados" subindo em volta
  const green = new THREE.Color(0x1f9d57);
  const drawerOf = (i) => (i < 118 ? ((i - 86) / 4) | 0 : ((i - 118) / 3) | 0);
  F.push(make((i) => {
    if (i < 56) {
      const post = (i / 14) | 0, k = i % 14;
      return { p: V(post % 2 ? 1.15 : -1.15, -2.08 + k * 0.32, post < 2 ? 0.8 : -0.8), s: V(0.28, 0.28, 0.28), c: slate };
    }
    if (i < 86) {
      const k = i - 56, m = k % 15;
      return { p: V(-1 + (m % 5) * 0.5, k < 15 ? 2.32 : -2.32, -0.6 + ((m / 5) | 0) * 0.6), s: V(1, 0.2, 1.2), c: ice };
    }
    if (i < 118) {
      const k = i - 86;
      return { p: V(-0.79 + (k % 4) * 0.527, -1.75 + ((k / 4) | 0) * 0.5, 0), s: V(1.04, 0.72, 3), c: ice };
    }
    if (i < 142) {
      const k = i - 118, c = k % 3;
      return { p: V(0.52 + c * 0.14, -1.75 + ((k / 3) | 0) * 0.5, 0.79), s: V(0.12, 0.12, 0.12), c: c === 0 ? red : c === 1 ? green : ice };
    }
    const k = i - 142, a = (k / 74) * TAU * 3;
    return { p: V(Math.cos(a) * 2.1, -2.4 + (k / 74) * 4.8, Math.sin(a) * 2.1), s: V(0.16, 0.16, 0.16), c: k % 5 === 0 ? red : ice };
  }, null, (i, time, p, s) => {
    if (i >= 86 && i < 142) {
      // de vez em quando uma gaveta desliza para fora e volta
      const out = Math.max(0, Math.sin(time * 0.6 + drawerOf(i) * 1.7));
      p.z += out ** 8 * 0.9;
    }
    if (i >= 118 && i < 142) {
      // LEDs piscando em ritmos diferentes
      s.setScalar(Math.sin(time * (3 + (i % 5)) + i * 1.7) > -0.2 ? 0.12 : 0.05);
    }
    if (i >= 142) {
      // dados sobem em espiral
      const k = i - 142, u = (k / 74 + time * 0.05) % 1, a = (k / 74) * TAU * 3 + time * 0.25;
      p.set(Math.cos(a) * 2.1, -2.4 + u * 4.8, Math.sin(a) * 2.1);
    }
  }));

  // Número "aleatório" estável 0–1: janelas mudam de estado de tempos em tempos, sem piscar a cada frame
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

  // 1 · prédio: 8 andares com lajes, janelas, antena, câmeras nas quinas e praça com varredura
  //   0–8     lajes (9)
  //   9–72    janelas: 8 andares × 8 (perímetro 3×3)
  //   73–79   antena (6) + luz vermelha no topo
  //   80–103  8 câmeras × 3 (suporte, corpo, lente)
  //   104–187 praça 10×10 sem o miolo 4×4
  //   188–215 anel de monitoramento girando
  const FLOOR_H = 0.62, BASE = -2.5;
  const ring3 = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  const plaza = [];
  for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) if (!(x >= 3 && x <= 6 && z >= 3 && z <= 6)) plaza.push([x, z]);
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const camSpots = Array.from({ length: 8 }, (_, k) => ({ corner: corners[k % 4], floor: 1 + ((k * 3) % 7) }));
  F.push(make((i) => {
    if (i < 9) return { p: V(0, BASE + i * FLOOR_H, 0), s: V(4.1, 0.14, 4.1), c: slate };
    if (i < 73) {
      const k = i - 9, fl = (k / 8) | 0, [gx, gz] = ring3[k % 8];
      return { p: V(gx * 0.62, BASE + fl * FLOOR_H + FLOOR_H / 2, gz * 0.62), s: V(1, 1.02, 1), c: ice };
    }
    if (i < 80) {
      const k = i - 73, top = BASE + 8 * FLOOR_H + 0.12;
      if (k < 6) return { p: V(0.3, top + k * 0.16, 0.3), s: V(0.12, 0.34, 0.12), c: slate };
      return { p: V(0.3, top + 6 * 0.16 + 0.05, 0.3), s: V(0.2, 0.2, 0.2), c: red };
    }
    if (i < 104) {
      const k = i - 80, cam = camSpots[(k / 3) | 0], part = k % 3;
      const [cx, cz] = cam.corner;
      const dir = V(cx, 0, cz).normalize();
      const wall = V(cx * 0.92, BASE + cam.floor * FLOOR_H + FLOOR_H * 0.85, cz * 0.92);
      const yaw = Math.atan2(-dir.z, dir.x); // eixo X do cubo apontando para fora da quina
      if (part === 0) return { p: wall, s: V(0.18, 0.18, 0.18), c: slate, yaw };
      if (part === 1) return { p: wall.clone().addScaledVector(dir, 0.22), s: V(0.6, 0.26, 0.26), c: ice, yaw };
      return { p: wall.clone().addScaledVector(dir, 0.39), s: V(0.1, 0.16, 0.16), c: red, yaw };
    }
    if (i < 188) {
      const [x, z] = plaza[i - 104];
      return { p: V((x - 4.5) * 0.55, BASE - 0.12, (z - 4.5) * 0.55), s: V(0.95, 0.12, 0.95), c: slate };
    }
    const k = i - 188, a = (k / 28) * TAU;
    return { p: V(Math.cos(a) * 2.3, BASE + 2.6, Math.sin(a) * 2.3), s: V(0.14, 0.14, 0.14), c: k % 4 === 0 ? red : ice };
  }, null, (i, time, p, s, c) => {
    if (i >= 9 && i < 73) {
      // janelas acendendo e apagando
      const k = i - 9, r = hash(k, Math.floor(time * 0.4 + k * 0.13));
      c.copy(r > 0.93 ? red : r > 0.45 ? ice : slate);
    } else if (i === 79) {
      s.setScalar(Math.sin(time * 4) > 0 ? 0.2 : 0.08); // luz da antena
    } else if (i >= 80 && i < 104 && (i - 80) % 3 === 2) {
      s.setScalar(Math.sin(time * 3 + i) > 0.3 ? 0.18 : 0.1); // lente gravando
    } else if (i >= 104 && i < 188) {
      // onda de varredura saindo do prédio
      const w = Math.max(0, Math.sin(Math.hypot(p.x, p.z) * 2.2 - time * 2.4));
      p.y += w ** 6 * 0.35;
      if (w > 0.97) c.copy(red);
    } else if (i >= 188) {
      const k = i - 188, a = (k / 28) * TAU + time * 0.35;
      p.set(Math.cos(a) * 2.3, BASE + 2.6 + Math.sin(a * 2 + time) * 0.25, Math.sin(a) * 2.3);
    }
  }));

  // 2 · roteador Wi-Fi: ondas de sinal se expandem e acendem os dispositivos em volta
  //   0–11    corpo do roteador (4×3)
  //   12–15   LEDs na frente
  //   16–30   3 antenas × 5 segmentos
  //   31–40   6 dispositivos (notebook, celular, câmera, monitor, tablet, fechadura)
  //   41–46   indicador de sinal acima de cada dispositivo
  //   47–214  3 ondas × 56 cubos
  //   215     sobra (escondido)
  const WAVE_N = 56, WAVE_R0 = 0.9, WAVE_SPAN = 3.6, DEV_R = 3.4, WAVE_Y = -0.35;
  const DEV_U = (DEV_R - WAVE_R0) / WAVE_SPAN; // em que ponto da onda ela passa pelos dispositivos
  const devAngle = (d) => (d / 6) * TAU + 0.3;
  const devYaw = (d) => { const a = devAngle(d); return Math.atan2(-Math.cos(a), -Math.sin(a)); }; // tela virada para o roteador
  const devCenter = (d) => V(Math.cos(devAngle(d)) * DEV_R, 0, Math.sin(devAngle(d)) * DEV_R);
  // Peças de cada dispositivo no referencial dele: [dispositivo, deslocamento, escala, cor]
  const devParts = [
    [0, V(0, -0.5, 0.3), V(2.2, 0.1, 1.4), ice],   // notebook: base
    [0, V(0, -0.1, -0.05), V(2.2, 1.4, 0.08), ice], // notebook: tela
    [1, V(0, -0.1, 0), V(0.7, 1.4, 0.12), ice],     // celular
    [2, V(0, 0.25, -0.2), V(0.2, 0.6, 0.2), slate], // câmera: suporte
    [2, V(0, 0.05, 0.1), V(0.4, 0.4, 1), ice],      // câmera: corpo
    [3, V(0, 0.15, 0), V(2.4, 1.4, 0.1), ice],      // monitor: tela
    [3, V(0, -0.4, 0), V(0.25, 0.6, 0.25), slate],  // monitor: pé
    [4, V(0, 0, 0), V(1.3, 1.7, 0.1), ice],         // tablet
    [5, V(0, 0, 0), V(0.7, 1.1, 0.25), slate],      // fechadura: corpo
    [5, V(0, 0.25, 0.12), V(0.16, 0.16, 0.16), red], // fechadura: luz
  ];
  const wave = (w, j, u) => {
    const a = (j / WAVE_N) * TAU, r = WAVE_R0 + u * WAVE_SPAN;
    return V(Math.cos(a) * r, WAVE_Y + Math.sin(u * Math.PI) * 0.35, Math.sin(a) * r);
  };
  const waveScale = (u) => 0.18 * Math.pow(Math.max(0, 1 - u), 0.6);
  const antennaTop = (a) => 16 + a * 5 + 4;
  const UP_AXIS = V(0, 1, 0);
  // Linhas de sinal: da ponta de uma antena até o indicador de cada dispositivo
  const edgeIdx = Array.from({ length: 6 }, (_, d) => [antennaTop(d % 3), 41 + d]);
  F.push(make((i) => {
    if (i < 12) return { p: V(((i % 4) - 1.5) * 0.45, -0.5, (((i / 4) | 0) - 1) * 0.45), s: V(0.92, 0.5, 0.92), c: ice };
    if (i < 16) return { p: V(((i - 12) - 1.5) * 0.28, -0.5, 0.72), s: V(0.12, 0.12, 0.12), c: (i - 12) % 2 ? green : red };
    if (i < 31) {
      const a = ((i - 16) / 5) | 0, seg = (i - 16) % 5;
      return { p: V((a - 1) * 0.6, -0.3 + seg * 0.17, -0.5), s: V(0.12, 0.36, 0.12), c: slate };
    }
    if (i < 41) {
      const [d, off, scl, c] = devParts[i - 31];
      return { p: devCenter(d).add(off.clone().applyAxisAngle(UP_AXIS, devYaw(d))), s: scl, c, yaw: devYaw(d) };
    }
    if (i < 47) {
      const d = i - 41;
      return { p: devCenter(d).add(V(0, 1.05, 0)), s: V(0.18, 0.18, 0.18), c: ice };
    }
    if (i < 215) {
      const k = i - 47, w = (k / WAVE_N) | 0, j = k % WAVE_N, u = w / 3;
      return { p: wave(w, j, u), s: V(1, 1, 1).multiplyScalar(waveScale(u) / 0.5), c: j % 8 === 0 ? red : ice };
    }
    return { p: V(0, -0.5, 0), s: V(0.001, 0.001, 0.001), c: ice };
  }, null, (i, time, p, s, c) => {
    if (i >= 12 && i < 16) {
      s.setScalar(Math.sin(time * (4 + i) + i) > -0.3 ? 0.12 : 0.04); // LEDs do roteador
    } else if (i >= 41 && i < 47) {
      // o indicador acende quando uma onda passa pelo dispositivo
      let hit = 0;
      for (let w = 0; w < 3; w++) {
        const u = (time * 0.32 + w / 3) % 1;
        hit = Math.max(hit, 1 - Math.min(1, Math.abs(u - DEV_U) / 0.06));
      }
      s.setScalar(0.18 + hit * 0.14);
      if (hit > 0.2) c.copy(red);
    } else if (i >= 47 && i < 215) {
      const k = i - 47, w = (k / WAVE_N) | 0, j = k % WAVE_N;
      const u = (time * 0.32 + w / 3) % 1;
      p.copy(wave(w, j, u));
      s.setScalar(Math.max(0.001, waveScale(u) / 0.5));
    }
  }));

  // 3 · painel de barras 18×12 (as mais altas em vermelho)
  F.push(make((i) => {
    const x = i % 18, z = (i / 18) | 0;
    const h = 0.25 + 2.1 * (0.5 + 0.25 * Math.sin(x * 0.55) + 0.25 * Math.cos(z * 0.7 + x * 0.2)) ** 2;
    return { p: V((x - 8.5) * 0.42, 0, (z - 5.5) * 0.42), s: V(0.72, 1, 0.72), base: -1.2, h, c: h > 1.55 ? red : ice };
  }, (i, time) => 1 + 0.18 * Math.sin(time * 1.3 + (i % 18) * 0.5 + ((i / 18) | 0) * 0.35)));

  // 4 · logo VILAQG em voxel, numa linha só, com 2 camadas de profundidade e um sublinhado vermelho fino
  const GLYPH = {
    V: ['10001', '10001', '10001', '01010', '01010', '00100', '00100'],
    I: ['111', '010', '010', '010', '010', '010', '111'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  };
  const LOGO_G = 0.2;            // tamanho de cada "pixel"
  const LOGO_COLS = 33;          // V I L A Q G + espaços
  const LOGO_W = LOGO_COLS * LOGO_G;
  F.push((() => {
    const word = 'VILAQG';
    const pix = [];
    let col = 0;
    [...word].forEach((ch) => {
      GLYPH[ch].forEach((line, y) => [...line].forEach((b, x) => {
        if (b === '1') pix.push([col + x - (LOGO_COLS - 1) / 2, -y]);
      }));
      col += GLYPH[ch][0].length + 1;
    });
    // letras de y=0 a y=-6; sublinhado em y=-8
    const yMid = -4;
    const cube = LOGO_G * 0.92 / 0.5;
    const size = V(cube, cube, cube);
    return make((i) => {
      if (i < pix.length * 2) {
        const [x, y] = pix[i >> 1];
        return { p: V(x * LOGO_G, (y - yMid) * LOGO_G, (i % 2 ? 0.5 : -0.5) * LOGO_G), s: size, c: ice };
      }
      const k = i - pix.length * 2;
      const pos = V((k - (LOGO_COLS - 1) / 2) * LOGO_G, (-8 - yMid) * LOGO_G, 0);
      if (k < LOGO_COLS) return { p: pos, s: V(cube, cube * 0.4, cube), c: red };
      // cubos que sobram ficam escondidos no meio do sublinhado
      return { p: V(0, (-8 - yMid) * LOGO_G, 0), s: V(0.001, 0.001, 0.001), c: red };
    });
  })());

  // Câmera e enquadramento por capítulo
  const CAM_DIST = [10.5, 13, 11, 12, 10];
  const TILT = [0.22, 0.18, 0.45, 0.6, 0.04];

  // Resolve posição/escala/giro/cor de um cubo numa formação, já com o "ao vivo"
  const sample = (f, i, time, outP, outS, outC) => {
    outP.copy(f.pos[i]);
    outS.copy(f.scl[i]);
    outC.copy(f.col[i]);
    if (f.base[i] !== null) {
      const h = f.h[i] * (f.live && !reduce ? f.live(i, time) : 1);
      outP.y = f.base[i] + h / 2;
      outS.y = h / 0.5;
    }
    if (f.anim && !reduce) f.anim(i, time, outP, outS, outC);
    return f.yaw[i];
  };

  /* ── Linhas de sinal (só aparecem no roteador) ── */
  const lineGeo = new THREE.BufferGeometry();
  const linePos = new Float32Array(edgeIdx.length * 6);
  const lineCol = new Float32Array(edgeIdx.length * 6);
  edgeIdx.forEach((_, k) => {
    const c = red;
    lineCol.set([c.r, c.g, c.b, c.r, c.g, c.b], k * 6);
  });
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3).setUsage(THREE.DynamicDrawUsage));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  world.add(lines);

  /* ── Brilho vermelho dentro do rack ── */
  const coreLight = new THREE.PointLight(0xe84545, 18, 7, 1.6);
  world.add(coreLight);

  /* ── Partículas (neve/poeira) ── */
  const P = 700;
  const pPos = new Float32Array(P * 3);
  for (let i = 0; i < P; i++) {
    pPos[i * 3] = (rng() - 0.5) * 30;
    pPos[i * 3 + 1] = (rng() - 0.5) * 20;
    pPos[i * 3 + 2] = (rng() - 0.5) * 30;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xcfd8e3, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(particles);

  /* ── Mouse ── */
  const mouse = new THREE.Vector2();
  const mouseSmooth = new THREE.Vector2();
  addEventListener('pointermove', (e) => {
    mouse.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  });

  /* ── Tamanho da tela ── */
  let portrait = innerWidth / innerHeight < 1;
  function resize() {
    const w = innerWidth, h = innerHeight;
    portrait = w / h < 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  /* ── Loop ── */
  const dummy = new THREE.Object3D();
  const q = new THREE.Quaternion();
  const tmp = new THREE.Vector3();
  const tmpS = new THREE.Vector3();
  const pA = new THREE.Vector3(), pB = new THREE.Vector3();
  const sA = new THREE.Vector3(), sB = new THREE.Vector3();
  const cA = new THREE.Color(), cB = new THREE.Color(), cMix = new THREE.Color();
  const yawQ = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);
  const current = Array.from({ length: N }, () => new THREE.Vector3());
  let t = scrollTarget; // capítulo suavizado
  const clock = new THREE.Clock();
  let firstFrame = true;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    // Inércia: a cena "persegue" a rolagem, o que dá o movimento suave
    t += (scrollTarget - t) * (reduce ? 1 : 1 - Math.pow(0.001, dt));
    const last = F.length - 1;
    const i0 = Math.min(Math.floor(t), last - 1);
    const f = clamp(t - i0);
    const e = smooth(0.12, 0.88, f);          // segura a forma parada no começo e no fim do trecho
    const burst = Math.sin(Math.PI * e);      // 0 → 1 → 0 no meio da transição
    const A = F[i0], B = F[i0 + 1];

    for (let i = 0; i < N; i++) {
      const yawA = sample(A, i, time, pA, sA, cA);
      const yawB = sample(B, i, time, pB, sB, cB);
      tmp.lerpVectors(pA, pB, e);
      if (!reduce) tmp.addScaledVector(scatter[i], burst * 1.4);
      current[i].copy(tmp);
      tmpS.lerpVectors(sA, sB, e);
      yawQ.setFromAxisAngle(UP, lerp(yawA, yawB, e));
      q.setFromAxisAngle(spinAxis[i], reduce ? 0 : burst * 2.2).multiply(yawQ);
      dummy.position.copy(tmp);
      dummy.quaternion.copy(q);
      dummy.scale.copy(tmpS);
      dummy.updateMatrix();
      cubes.setMatrixAt(i, dummy.matrix);
      cubes.setColorAt(i, cMix.copy(cA).lerp(cB, e));
    }
    cubes.instanceMatrix.needsUpdate = true;
    cubes.instanceColor.needsUpdate = true;

    // Linhas de sinal acompanham os cubos e aparecem só perto do capítulo 2
    const netW = clamp(1 - Math.abs(t - 2) * 1.6);
    lineMat.opacity = netW * 0.35;
    if (netW > 0) {
      edgeIdx.forEach(([a, b], k) => {
        linePos.set([current[a].x, current[a].y, current[a].z, current[b].x, current[b].y, current[b].z], k * 6);
      });
      lineGeo.attributes.position.needsUpdate = true;
    }

    // Brilho vermelho pulsando dentro do rack
    const coreW = clamp(1 - t * 1.4);
    const pulse = reduce ? 1 : 1 + Math.sin(time * 2.2) * 0.15;
    coreLight.intensity = 3 + coreW * 20 * pulse;

    // Enquadramento: objeto à direita no desktop, em cima no celular
    const k = clamp(t - i0);
    let dist = lerp(CAM_DIST[i0], CAM_DIST[i0 + 1], smooth(0, 1, k)) * (portrait ? 1.5 : 1);
    const tilt = lerp(TILT[i0], TILT[i0 + 1], smooth(0, 1, k));
    mouseSmooth.lerp(mouse, 1 - Math.pow(0.02, dt));
    // Na logo (capítulo 4) a cena para de girar e fica de frente, e a câmera se afasta o
    // suficiente para a palavra caber: ~86% da largura no celular, ~40% no desktop (lado direito).
    const wL = smooth(3.3, 3.95, t);
    const perUnit = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); // altura visível por unidade de distância
    const fit = LOGO_W / ((portrait ? 0.86 : 0.4) * perUnit * camera.aspect);
    dist = lerp(dist, Math.max(fit, portrait ? 12 : 9), wL);
    const logoX = 0.24 * perUnit * camera.aspect * dist; // centro da logo a 74% da largura
    const logoY = 0.2 * perUnit * dist;                  // centro da logo a 30% da altura (celular)
    const free = (reduce ? 0 : time * 0.1) + t * 1.1;
    const facing = Math.round(free / (Math.PI * 2)) * Math.PI * 2;
    world.position.set(portrait ? 0 : lerp(2.6, logoX, wL), portrait ? lerp(1.6, logoY, wL) : 0, 0);
    world.rotation.y = lerp(free, facing, wL) + mouseSmooth.x * 0.25 * (1 - wL * 0.6);
    world.rotation.x = tilt + mouseSmooth.y * 0.12 * (1 - wL * 0.6);
    camera.position.set(0, 0, dist);
    camera.lookAt(portrait ? 0 : lerp(1.2, 0, wL), portrait ? lerp(1.2, 0, wL) : 0, 0);

    // Partículas sobem devagar
    if (!reduce) {
      particles.rotation.y = time * 0.01;
      particles.position.y = ((time * 0.15) % 4) - 2;
    }

    renderer.render(scene, camera);
    if (firstFrame) { firstFrame = false; loadTarget = 1; }
  }

  // Pausa quando a aba não está visível
  let running = true;
  renderer.setAnimationLoop(frame);
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    renderer.setAnimationLoop(running ? frame : null);
    if (running) clock.getDelta();
  });
}

// Gerador aleatório com semente: a cena é sempre igual a cada visita
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
