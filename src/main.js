import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';

const app = document.querySelector('#app');

let scene;
let camera;
let renderer;
let controls;
let waterMesh;
let waterBasePositions;
let clock;
let skyMaterial;
let sunLight;
let hemisphereLight;
let fillLight;

const animatedBoats = [];
const mangroveGlowMeshes = [];
const nightPointLights = [];
const windowMaterials = [];
const keyboard = new Set();
const phaseGroups = {};

let isNight = false;
let isWalkMode = false;
let currentPhase = 1;

const phaseCopy = {
  1: {
    title: 'Fase 1: Estado actual del borde',
    text: 'Antes: ciudad en la orilla, manglar sin intervencion y residuos flotando en el agua. Se evidencia deterioro y poca apropiacion.',
  },
  2: {
    title: 'Fase 2: Planificar el sistema',
    text: 'Durante: aparecen trazas, estaciones de observacion y aulas ligeras. La red se ensaya como ruta ambiental antes de consolidarse.',
  },
  3: {
    title: 'Fase 3: Levantar comunidad',
    text: 'Despues: los puentes habitables conectan plaza, centro comunitario, cultura local y recorridos seguros sobre el manglar.',
  },
};

const deckY = 2.25;
const waterSize = 180;
const houseColors = [
  0x50c7c7,
  0xf1d45b,
  0xf38c4a,
  0x7cc96f,
  0x8bd3f7,
  0xd9c3a2,
];

const materials = {
  wood: new THREE.MeshStandardMaterial({ color: 0x8b633e, roughness: 0.78 }),
  paleWood: new THREE.MeshStandardMaterial({ color: 0xbd9b72, roughness: 0.82 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x4f3928, roughness: 0.85 }),
  rail: new THREE.MeshStandardMaterial({ color: 0xc9b393, roughness: 0.75 }),
  straw: new THREE.MeshStandardMaterial({ color: 0xcaa66a, roughness: 0.9 }),
  metalRoof: new THREE.MeshStandardMaterial({
    color: 0xb9c6ca,
    roughness: 0.36,
    metalness: 0.38,
  }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x2f5e70,
    emissive: 0x071319,
    roughness: 0.18,
  }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x5b3d25, roughness: 0.9 }),
  sand: new THREE.MeshStandardMaterial({ color: 0x8a7a4e, roughness: 1 }),
};

windowMaterials.push(materials.glass);

function random(seed) {
  const x = Math.sin(seed * 127.1) * 43758.5453123;
  return x - Math.floor(x);
}

function addBox(parent, color, size, position, rotation = [0, 0, 0], options = {}) {
  const material = options.material || new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.68,
    metalness: options.metalness ?? 0,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, color, radius, height, position, options = {}) {
  const material = options.material || new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.72,
  });
  const geometry = options.geometry || new THREE.CylinderGeometry(
    radius,
    options.bottomRadius ?? radius,
    height,
    options.segments ?? 12,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  if (options.rotation) {
    mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
  }
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function createGableRoof(width, depth, height, color, roughness = 0.55) {
  const geometry = new THREE.BufferGeometry();
  const w = width / 2;
  const d = depth / 2;
  const vertices = new Float32Array([
    -w, 0, d,
    w, 0, d,
    0, height, d,
    -w, 0, -d,
    w, 0, -d,
    0, height, -d,
  ]);
  const indices = [
    0, 1, 2,
    5, 4, 3,
    3, 0, 2,
    3, 2, 5,
    1, 4, 5,
    1, 5, 2,
    3, 4, 1,
    3, 1, 0,
  ];
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.1 });
  const roof = new THREE.Mesh(geometry, material);
  roof.castShadow = true;
  roof.receiveShadow = true;
  return roof;
}

function createScene() {
  app.innerHTML = `
    <canvas id="scene-canvas" aria-label="Pueblo palafítico en manglar"></canvas>
    <aside class="info-panel">
      <strong>Pueblo palafítico en manglar - maqueta 3D</strong>
      <span>Arrastra para mirar, rueda para zoom. Usa WASD o flechas para caminar.</span>
      <div class="panel-actions">
        <button id="theme-toggle" type="button">Modo noche</button>
        <button id="walk-toggle" type="button">Caminar</button>
      </div>
      <section class="phase-panel" aria-label="Fases del proyecto">
        <div class="phase-buttons">
          <button class="phase-button" type="button" data-phase="1">Transformar</button>
          <button class="phase-button" type="button" data-phase="2">Planificar</button>
          <button class="phase-button" type="button" data-phase="3">Levantar</button>
        </div>
        <div class="phase-track" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <strong id="phase-title"></strong>
        <p id="phase-description"></p>
      </section>
      <details>
        <summary>Buenaventura y visión</summary>
        <p>
          Inspirado en la idea de que el manglar es infraestructura viva: la comunidad
          habita y se mueve en el agua sin rellenar cuerpos de agua ni reemplazar el
          bosque. Esta maqueta imagina un borde costero navegable, cultural y cuidadoso
          con la biodiversidad.
        </p>
      </details>
    </aside>
  `;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe7f4);
  scene.fog = new THREE.Fog(0xbfe7f4, 75, 165);

  const canvas = document.querySelector('#scene-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = false;

  camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 260);
  camera.position.set(40, 34, 48);
  camera.lookAt(0, 0, -8);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 18;
  controls.maxDistance = 115;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.set(0, 2, -4);

  clock = new THREE.Clock();

  createSky();
  createLighting();
  createWater();
  createPhaseGroups();

  assignToPhase(3, createBoardwalk([
    [-48, 11],
    [-30, 2],
    [-9, -3],
    [14, -2],
    [31, 8],
  ], 2.7));
  assignToPhase(3, createBoardwalk([
    [-11, -3],
    [-16, -19],
    [-15, -33],
  ], 2.4));
  assignToPhase(2, createBoardwalk([
    [13, -2],
    [21, 10],
    [28, 21],
  ], 2.6));
  assignToPhase(2, createBoardwalk([
    [31, 8],
    [44, 9],
    [55, 3],
  ], 2.4));
  assignToPhase(3, createBoardwalk([
    [-69, 23],
    [-55, 17],
    [-48, 11],
  ], 2.25));
  assignToPhase(2, createBoardwalk([
    [-34, 18],
    [-28, 7],
    [-27, -10],
    [-29, -27],
    [-38, -39],
  ], 2.3));
  assignToPhase(3, createBoardwalk([
    [-48, 11],
    [-30, 2],
    [-9, -3],
    [14, -2],
    [31, 8],
  ], 2.8));
  assignToPhase(3, createBoardwalk([
    [31, 8],
    [44, 9],
    [55, 3],
  ], 2.5));
  assignToPhase(3, createBoardwalk([
    [-31, -20],
    [-18, -22],
    [-4, -21],
    [12, -17],
    [30, -9],
    [44, -18],
  ], 2.35));
  assignToPhase(3, createBoardwalk([
    [-48, -2],
    [-35, -8],
    [-22, -12],
    [-6, -12],
    [12, -9],
  ], 2.2));
  assignToPhase(3, createBoardwalk([
    [2, 18],
    [8, 7],
    [14, -2],
    [26, -14],
    [39, -28],
  ], 2.25));
  assignToPhase(3, createBoardwalk([
    [28, 21],
    [39, 31],
    [53, 32],
    [66, 22],
  ], 2.2));
  assignToPhase(3, createBoardwalk([
    [-16, -33],
    [-4, -42],
    [14, -43],
    [31, -35],
    [39, -28],
  ], 2.15));

  assignToPhase(3, createCircularPier(55, 3, 10.5));

  const houses = [
    [-34, -7, 0, 0], [-27, -10, 0.08, 1], [-20, -12, -0.04, 2],
    [-12, -13, 0.04, 3], [-4, -12, -0.07, 4], [5, -11, 0.05, 5],
    [-31, -20, -0.03, 4], [-22, -22, 0.08, 5], [-13, -23, -0.05, 0],
    [-4, -21, 0.04, 1], [7, -18, -0.08, 2], [15, -14, 0.02, 3],
  ];
  houses.forEach(([x, z, rot, colorIndex], index) => {
    assignToPhase(3, createHouse(x, z, houseColors[colorIndex], rot, index % 3 === 0));
  });

  assignToPhase(2, createPalmRoofHut(22, 15, -0.45, 8.2, 10.5));
  assignToPhase(2, createPalmRoofHut(37, 19, -0.2, 9.5, 12));
  assignToPhase(3, createPalmRoofHut(30, -9, 0.35, 7.2, 8.6));

  createMangroveCluster(-48, -9, 14, 34, 10);
  createMangroveCluster(-42, 24, 17, 42, 40);
  createMangroveCluster(2, 18, 11, 28, 80);
  createMangroveCluster(44, -18, 16, 40, 120);
  createMangroveCluster(60, 20, 12, 30, 160);
  createMangroveCluster(-66, 4, 12, 26, 200);
  createMangroveCluster(6, 34, 10, 24, 240);
  createMangroveWall();

  assignToPhase(3, createBoat(-29, 10, -1.2, 0x6d4d35));
  assignToPhase(3, createBoat(-20, 8, -1.1, 0x9d673e));
  assignToPhase(3, createBoat(43, 2, 1.2, 0x2e8a92));
  assignToPhase(3, createBoat(49, -2, 1.35, 0xd4a54b));
  assignToPhase(3, createBoat(51, 8, 1.1, 0x347c55));
  assignToPhase(3, createBoat(34, -22, 0.35, 0x8f5137));

  createMountains();
  createPort();
  createFishingFleet();
  createPhaseOneRecoveryLayer();
  createPhaseTwoCommunityLayer();
  createPhaseThreeCultureLayer();

  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', (event) => keyboard.delete(event.code));
  document.querySelector('#theme-toggle').addEventListener('click', toggleNightMode);
  document.querySelector('#walk-toggle').addEventListener('click', toggleWalkMode);
  document.querySelectorAll('.phase-button').forEach((button) => {
    button.addEventListener('click', () => setPhase(Number(button.dataset.phase)));
  });
  setPhase(1);
  animate();

  return { scene, camera, renderer, controls };
}

function createWater() {
  const geometry = new THREE.PlaneGeometry(waterSize, waterSize, 32, 32);
  waterBasePositions = geometry.attributes.position.array.slice();
  const material = new THREE.MeshStandardMaterial({
    color: 0x2d8891,
    roughness: 0.18,
    metalness: 0.12,
    transparent: true,
    opacity: 0.82,
  });

  waterMesh = new THREE.Mesh(geometry, material);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = 0;
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);

  const deepGeometry = new THREE.PlaneGeometry(waterSize, waterSize);
  const deepMaterial = new THREE.MeshBasicMaterial({ color: 0x1d5961 });
  const deepWater = new THREE.Mesh(deepGeometry, deepMaterial);
  deepWater.rotation.x = -Math.PI / 2;
  deepWater.position.y = -0.34;
  scene.add(deepWater);

  return waterMesh;
}

function createPhaseGroups() {
  [1, 2, 3].forEach((phase) => {
    phaseGroups[phase] = new THREE.Group();
    phaseGroups[phase].name = `phase-${phase}`;
    scene.add(phaseGroups[phase]);
  });
}

function assignToPhase(phase, object) {
  if (!object || !phaseGroups[phase]) return object;
  phaseGroups[phase].attach(object);
  return object;
}

function setPhase(phase) {
  currentPhase = phase;
  [1, 2, 3].forEach((phaseNumber) => {
    phaseGroups[phaseNumber].visible = phaseNumber === currentPhase;
  });

  const copy = phaseCopy[currentPhase];
  document.querySelector('#phase-title').textContent = copy.title;
  document.querySelector('#phase-description').textContent = copy.text;
  document.querySelectorAll('.phase-button').forEach((button) => {
    const isActive = Number(button.dataset.phase) === currentPhase;
    button.classList.toggle('is-active', isActive);
  });
  document.querySelectorAll('.phase-track span').forEach((dot, index) => {
    dot.classList.toggle('is-active', index + 1 === currentPhase);
  });
}

function createPhaseOneRecoveryLayer() {
  const group = phaseGroups[1];
  createPhaseOneShoreCity(group);
  createWaterTrash(group);
}

function createPhaseOneShoreCity(parent) {
  const group = new THREE.Group();
  group.position.set(-72, 0, -6);

  addBox(group, 0x557a42, [22, 0.26, 82], [0, 0.05, 0], [0, 0, 0], {
    roughness: 0.95,
    castShadow: false,
  });
  addBox(group, 0x8b9188, [3.8, 0.1, 76], [3.8, 0.3, -2], [0, 0.12, 0], {
    roughness: 0.86,
    castShadow: false,
  });

  const roofColors = [0xb75b46, 0xd8d3c4, 0x91bad0, 0xc99a56, 0x7f5c46];
  for (let i = 0; i < 18; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = 3 + side * (3.8 + random(i + 31) * 4.4);
    const z = -34 + i * 4.0 + random(i + 42) * 1.8;
    const w = 2.2 + random(i + 4) * 1.5;
    const d = 2.0 + random(i + 8) * 1.3;
    addBox(group, 0xcbb99c, [w, 1.25, d], [x, 1.0, z], [0, random(i) * 0.35 - 0.18, 0], {
      roughness: 0.78,
      castShadow: false,
    });
    addBox(group, roofColors[i % roofColors.length], [w + 0.35, 0.22, d + 0.35], [x, 1.75, z], [0, random(i) * 0.35 - 0.18, 0], {
      roughness: 0.58,
      metalness: 0.08,
      castShadow: false,
    });
  }

  parent.add(group);
}

function createWaterTrash(parent) {
  const colors = [0xe8e3d0, 0x3d6d8f, 0xc84d3f, 0xf1cf5b, 0x4d4d4d];
  for (let i = 0; i < 34; i += 1) {
    const x = -58 + random(i + 301) * 105;
    const z = -34 + random(i + 401) * 68;
    const rot = random(i + 501) * Math.PI;
    if (random(i + 601) < 0.35) {
      addCylinder(parent, colors[i % colors.length], 0.13 + random(i) * 0.08, 0.42, [x, 0.18, z], {
        segments: 7,
        rotation: [Math.PI / 2, 0, rot],
        roughness: 0.64,
        castShadow: false,
      });
    } else {
      addBox(parent, colors[i % colors.length], [0.58 + random(i) * 0.5, 0.08, 0.22 + random(i + 3) * 0.3], [x, 0.16, z], [0, rot, 0], {
        roughness: 0.7,
        castShadow: false,
      });
    }
  }

  for (let i = 0; i < 8; i += 1) {
    addBox(parent, 0x2f2f2f, [1.4, 0.12, 0.28], [-55 + i * 11, 0.14, 24 + random(i + 88) * 8], [0, random(i + 77) * Math.PI, 0], {
      roughness: 0.9,
      castShadow: false,
    });
  }
}

function createPhaseTwoCommunityLayer() {
  const group = phaseGroups[2];
  createPlanningTrace(group, [
    [-50, 12], [-32, 3], [-10, -3], [14, -2], [34, 8], [55, 3],
  ], 0x4fd2ff);
  createPlanningTrace(group, [
    [-14, -32], [-4, -42], [15, -43], [31, -35], [43, -20],
  ], 0x8fffd4);
  createPlanningTrace(group, [
    [0, 20], [9, 8], [19, -5], [31, -18], [40, -28],
  ], 0xf5d36b);
  createLearningDeck(group, 24, 13, -0.45, 0x4aa3a2);
  createLearningDeck(group, 38, 18, -0.2, 0x6ba96e);
  createEnvironmentalStation(group, -36, 18, 0.2);
  createEnvironmentalStation(group, -31, -27, -0.25);
  createEnvironmentalStation(group, 29, 23, 0.45);
}

function createPhaseThreeCultureLayer() {
  const group = phaseGroups[3];
  addBox(group, 0x9b6844, [5.8, 0.24, 2.6], [48, deckY + 0.5, 7], [0, -0.15, 0], {
    material: materials.wood,
    castShadow: false,
  });
  addBox(group, 0xeac06d, [5.2, 0.12, 0.12], [48, deckY + 1.95, 8.1], [0, -0.15, 0], {
    roughness: 0.7,
    castShadow: false,
  });
  for (let i = 0; i < 7; i += 1) {
    addCylinder(group, 0x2d3832, 0.025, 1.6, [42 + i * 2, deckY + 1.3, 9.2], {
      segments: 6,
      castShadow: false,
    });
    addBox(group, i % 2 === 0 ? 0xf06d4f : 0x39a7c7, [0.65, 0.42, 0.04], [42 + i * 2, deckY + 2.05, 9.22], [0, 0, 0], {
      roughness: 0.62,
      castShadow: false,
    });
  }
}

function createPhaseSign(parent, x, z, rotation, seed) {
  addCylinder(parent, 0x6e4b32, 0.035, 1.15, [x, deckY + 0.75, z], {
    material: materials.darkWood,
    segments: 6,
    castShadow: false,
  });
  addBox(parent, 0xf4e8bf, [1.15, 0.5, 0.08], [x, deckY + 1.35, z], [0, rotation, 0], {
    roughness: 0.74,
    castShadow: false,
  });
  addBox(parent, seed % 2 === 0 ? 0x3c9f80 : 0x4a9ac7, [0.84, 0.06, 0.09], [x, deckY + 1.38, z + 0.05], [0, rotation, 0], {
    roughness: 0.7,
    castShadow: false,
  });
}

function createLearningDeck(parent, x, z, rotation, color) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  addBox(group, color, [5.1, 1.75, 3.4], [0, deckY + 1.1, 0], [0, 0, 0], {
    roughness: 0.66,
    castShadow: false,
  });
  addBox(group, 0xf1d79a, [5.8, 0.2, 4.0], [0, deckY + 2.15, 0], [0, 0, 0], {
    material: materials.straw,
    castShadow: false,
  });
  addBox(group, 0x244f73, [2.0, 0.06, 1.0], [1.0, deckY + 2.32, -0.4], [0.25, 0, 0], {
    roughness: 0.25,
    metalness: 0.2,
    castShadow: false,
  });
  parent.add(group);
}

function createPlanningTrace(parent, points, color) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, length), material);
    mesh.position.set((x1 + x2) / 2, deckY + 0.62, (z1 + z2) / 2);
    mesh.rotation.y = angle;
    parent.add(mesh);
  }
  points.forEach(([x, z], index) => {
    addCylinder(parent, color, 0.08, 1.1, [x, deckY + 1.05, z], {
      segments: 8,
      material,
      castShadow: false,
    });
    addBox(parent, color, [0.55, 0.16, 0.55], [x, deckY + 1.62, z], [0, random(index) * Math.PI, 0], {
      material,
      castShadow: false,
    });
  });
}

function createEnvironmentalStation(parent, x, z, rotation) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  addBox(group, 0xd8c6a2, [2.4, 0.18, 1.6], [0, deckY + 0.35, 0], [0, 0, 0], {
    roughness: 0.7,
    castShadow: false,
  });
  addCylinder(group, 0x365a4b, 0.035, 1.6, [-0.9, deckY + 1.15, -0.55], {
    segments: 6,
    castShadow: false,
  });
  addCylinder(group, 0x365a4b, 0.035, 1.6, [0.9, deckY + 1.15, -0.55], {
    segments: 6,
    castShadow: false,
  });
  addBox(group, 0xeaf6e9, [2.2, 0.92, 0.08], [0, deckY + 1.62, -0.6], [0, 0, 0], {
    roughness: 0.68,
    castShadow: false,
  });
  addBox(group, 0x3a916b, [1.55, 0.08, 0.09], [0, deckY + 1.78, -0.55], [0, 0, 0], {
    castShadow: false,
  });
  parent.add(group);
}

function createBoardwalk(points, width = 2.5) {
  const group = new THREE.Group();

  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;

    addBox(group, 0xa98763, [width, 0.34, length], [midX, deckY, midZ], [0, angle, 0], {
      material: materials.paleWood,
    });

    const plankCount = Math.max(3, Math.floor(length / 1.45));
    for (let j = 0; j <= plankCount; j += 1) {
      const localZ = -length / 2 + (j / plankCount) * length;
      const position = localPoint(midX, midZ, angle, 0, localZ);
      addBox(group, 0x7f5938, [width + 0.08, 0.06, 0.11], [position.x, deckY + 0.2, position.z], [0, angle, 0], {
        material: materials.wood,
      });
    }

    const supportCount = Math.max(2, Math.floor(length / 5.5));
    for (let j = 0; j <= supportCount; j += 1) {
      const localZ = -length / 2 + (j / supportCount) * length;
      [-width / 2 + 0.25, width / 2 - 0.25].forEach((localX) => {
        const position = localPoint(midX, midZ, angle, localX, localZ);
        addCylinder(group, 0x6e4b32, 0.08, deckY + 0.3, [position.x, (deckY + 0.3) / 2 - 0.12, position.z], {
          material: materials.darkWood,
          segments: 10,
        });
      });
    }

    [-width / 2 - 0.08, width / 2 + 0.08].forEach((localX) => {
      const position = localPoint(midX, midZ, angle, localX, 0);
      addBox(group, 0xd1c0a4, [0.08, 0.12, length], [position.x, deckY + 1.05, position.z], [0, angle, 0], {
        material: materials.rail,
      });
    });

    for (let j = 0; j <= supportCount; j += 1) {
      const localZ = -length / 2 + (j / supportCount) * length;
      [-width / 2 - 0.08, width / 2 + 0.08].forEach((localX) => {
        const position = localPoint(midX, midZ, angle, localX, localZ);
        addCylinder(group, 0xc9b393, 0.045, 1.2, [position.x, deckY + 0.6, position.z], {
          material: materials.rail,
          segments: 8,
        });
      });
    }

    const planterCount = Math.max(1, Math.floor(length / 9));
    for (let j = 0; j <= planterCount; j += 1) {
      const localZ = -length / 2 + ((j + 0.4) / (planterCount + 0.8)) * length;
      const side = j % 2 === 0 ? -1 : 1;
      const localX = side * (width / 2 - 0.36);
      const position = localPoint(midX, midZ, angle, localX, localZ);
      createBridgePlanter(group, position.x, position.z, angle, i * 31 + j * 7, side);
    }
  }

  scene.add(group);
  return group;
}

function createBridgePlanter(parent, x, z, angle, seed = 1, side = 1) {
  addBox(parent, 0x6f5132, [0.5, 0.28, 0.82], [x, deckY + 0.38, z], [0, angle, 0], {
    material: materials.darkWood,
    castShadow: false,
  });

  const plantMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.28 + random(seed) * 0.08, 0.62, 0.32 + random(seed + 1) * 0.12),
    roughness: 0.86,
  });

  for (let k = 0; k < 3; k += 1) {
    const offset = (k - 1) * 0.18;
    const point = localPoint(x, z, angle, offset, 0);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16 + random(seed + k) * 0.08, 0.72, 7), plantMaterial);
    leaf.position.set(point.x, deckY + 0.82 + random(seed + k * 2) * 0.18, point.z);
    leaf.rotation.set(0.45 + random(seed + k * 3) * 0.35, angle + side * 0.24 + k * 0.18, 0.15 * side);
    leaf.castShadow = false;
    leaf.receiveShadow = true;
    parent.add(leaf);
  }

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 10, 8),
    new THREE.MeshBasicMaterial({
      color: 0x8fffe1,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.position.set(x, deckY + 0.92, z);
  glow.scale.set(1, 0.65, 1);
  glow.visible = false;
  glow.userData.phase = random(seed + 24) * Math.PI * 2;
  glow.userData.baseScale = glow.scale.clone();
  parent.add(glow);
  mangroveGlowMeshes.push(glow);
}

function createHouse(x, z, color, rotation = 0, hasSolar = false) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;

  const width = 5 + random(x + z) * 1.4;
  const depth = 4.5 + random(x - z) * 1.3;
  const bodyHeight = 3.2;
  const floorY = 2.45;
  const bodyY = floorY + bodyHeight / 2;

  [-width / 2 + 0.45, width / 2 - 0.45].forEach((px) => {
    [-depth / 2 + 0.45, depth / 2 - 0.45].forEach((pz) => {
      addCylinder(group, 0x5a3b25, 0.07, floorY + 0.2, [px, (floorY + 0.2) / 2, pz], {
        material: materials.darkWood,
        segments: 8,
      });
    });
  });

  addBox(group, 0x9d7652, [width + 0.45, 0.22, depth + 0.45], [0, floorY, 0], [0, 0, 0], {
    material: materials.wood,
  });
  addBox(group, color, [width, bodyHeight, depth], [0, bodyY, 0], [0, 0, 0], {
    roughness: 0.62,
  });

  addBox(group, 0x543320, [1.0, 1.85, 0.08], [-width * 0.22, floorY + 0.94, depth / 2 + 0.045], [0, 0, 0], {
    material: materials.darkWood,
  });
  addBox(group, 0x224e5b, [0.92, 0.8, 0.08], [width * 0.25, floorY + 1.75, depth / 2 + 0.05], [0, 0, 0], {
    material: materials.glass,
  });
  addBox(group, 0x224e5b, [0.78, 0.72, 0.08], [-width / 2 - 0.045, floorY + 1.65, -depth * 0.18], [0, Math.PI / 2, 0], {
    material: materials.glass,
  });

  const roof = createGableRoof(width + 0.8, depth + 0.9, 1.2, 0xb7c0c4, 0.34);
  roof.position.y = floorY + bodyHeight + 0.05;
  roof.rotation.y = Math.PI / 2;
  group.add(roof);

  if (hasSolar) {
    addBox(group, 0x244f73, [2.2, 0.05, 1.25], [0.55, floorY + bodyHeight + 0.88, -0.45], [0.42, 0, 0], {
      roughness: 0.22,
      metalness: 0.2,
    });
  }

  scene.add(group);
  return group;
}

function createPalmRoofHut(x, z, rotation = 0, width = 8, depth = 10) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;

  const floorY = 2.55;
  const bodyHeight = 3.1;
  [-width / 2 + 0.6, 0, width / 2 - 0.6].forEach((px) => {
    [-depth / 2 + 0.6, depth / 2 - 0.6].forEach((pz) => {
      addCylinder(group, 0x5b3b24, 0.09, floorY + 0.3, [px, (floorY + 0.3) / 2, pz], {
        material: materials.darkWood,
        segments: 9,
      });
    });
  });

  addBox(group, 0x9a7047, [width, 0.28, depth], [0, floorY, 0], [0, 0, 0], {
    material: materials.wood,
  });
  addBox(group, 0xb78b59, [width - 0.5, bodyHeight, depth - 0.5], [0, floorY + bodyHeight / 2, 0], [0, 0, 0], {
    material: materials.paleWood,
  });
  addBox(group, 0x4c2f1e, [1.3, 1.9, 0.08], [-width * 0.24, floorY + 0.95, depth / 2 - 0.2], [0, 0, 0], {
    material: materials.darkWood,
  });
  addBox(group, 0x21495a, [1.1, 0.75, 0.08], [width * 0.22, floorY + 1.8, depth / 2 - 0.18], [0, 0, 0], {
    material: materials.glass,
  });

  const roof = createGableRoof(width + 1.8, depth + 2.2, 2.0, 0xcaa66a, 0.95);
  roof.position.y = floorY + bodyHeight - 0.05;
  roof.rotation.y = Math.PI / 2;
  group.add(roof);

  const strawLines = Math.floor(depth / 1.2);
  for (let i = 0; i <= strawLines; i += 1) {
    const pz = -depth / 2 - 0.7 + (i / strawLines) * (depth + 1.4);
    addBox(group, 0xe0c37d, [width + 2.0, 0.05, 0.06], [0, floorY + bodyHeight + 0.65, pz], [0.26, 0, 0], {
      roughness: 0.95,
    });
  }

  scene.add(group);
  return group;
}

function createMangroveCluster(x, z, radius = 10, count = 45, seed = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.05, radius * 1.2, 0.24, 32),
    materials.sand,
  );
  island.position.y = -0.05;
  island.scale.z = 0.72 + random(seed) * 0.4;
  island.receiveShadow = true;
  group.add(island);

  for (let i = 0; i < count; i += 1) {
    const r = Math.sqrt(random(seed + i * 3.1)) * radius;
    const theta = random(seed + i * 5.7) * Math.PI * 2;
    const px = Math.cos(theta) * r;
    const pz = Math.sin(theta) * r * island.scale.z;
    const trunkHeight = 2.9 + random(seed + i * 8.2) * 3.0;
    const crownRadius = 0.95 + random(seed + i * 2.6) * 1.25;
    const green = new THREE.Color().setHSL(0.27 + random(seed + i) * 0.08, 0.58, 0.28 + random(seed + i * 4) * 0.17);
    const lean = new THREE.Vector3(
      (random(seed + i * 9.1) - 0.5) * 0.85,
      trunkHeight,
      (random(seed + i * 10.7) - 0.5) * 0.85,
    );
    const top = new THREE.Vector3(px + lean.x, trunkHeight, pz + lean.z);

    createBranchBetween(group, new THREE.Vector3(px, 0.25, pz), top, 0.05 + crownRadius * 0.015, materials.trunk);

    const rootCount = i % 2 === 0 ? 4 : 3;
    for (let root = 0; root < rootCount; root += 1) {
      const rootAngle = theta + root * ((Math.PI * 2) / rootCount) + random(seed + i + root) * 0.45;
      const rootReach = 0.85 + random(seed + i * 2 + root) * 1.3;
      const start = new THREE.Vector3(
        px + Math.cos(rootAngle) * 0.18,
        0.28 + random(seed + root) * 0.45,
        pz + Math.sin(rootAngle) * 0.18,
      );
      const end = new THREE.Vector3(
        px + Math.cos(rootAngle) * rootReach,
        -0.1,
        pz + Math.sin(rootAngle) * rootReach,
      );
      createBranchBetween(group, start, end, 0.025 + random(seed + root) * 0.015, materials.trunk);
    }

    if (i % 3 === 0) {
      const branchAngle = theta + Math.PI * 0.35;
      createBranchBetween(
        group,
        new THREE.Vector3(px + lean.x * 0.62, trunkHeight * 0.62, pz + lean.z * 0.62),
        new THREE.Vector3(px + lean.x + Math.cos(branchAngle) * 1.15, trunkHeight + 0.55, pz + lean.z + Math.sin(branchAngle) * 1.15),
        0.027,
        materials.trunk,
      );
    }

    const leafMaterial = new THREE.MeshStandardMaterial({ color: green, roughness: 0.86 });
    for (let leaf = 0; leaf < 2; leaf += 1) {
      const crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry(crownRadius * (0.85 + random(seed + leaf + i) * 0.35), 1),
        leafMaterial,
      );
      crown.position.set(
        top.x + (random(seed + i + leaf * 11) - 0.5) * 1.1,
        trunkHeight + 0.45 + random(seed + i + leaf * 17) * 0.55,
        top.z + (random(seed + i + leaf * 13) - 0.5) * 1.1,
      );
      crown.scale.set(0.95, 1.35, 0.75);
      crown.castShadow = false;
      crown.receiveShadow = true;
      group.add(crown);
    }

    if (i % 9 === 0) {
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(crownRadius * 0.62, 12, 8),
        new THREE.MeshBasicMaterial({
          color: 0x70ffd4,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      glow.position.set(top.x, trunkHeight + 0.65, top.z);
      glow.scale.set(1.0, 1.15, 0.82);
      glow.visible = false;
      glow.userData.phase = random(seed + i * 11) * Math.PI * 2;
      glow.userData.baseScale = glow.scale.clone();
      group.add(glow);
      mangroveGlowMeshes.push(glow);

    }
  }

  scene.add(group);
  return group;
}

function createMangroveWall() {
  const wallPoints = [
    [-76, -42], [-76, -22], [-74, 2], [-72, 28], [-58, 45],
    [-34, 49], [-8, 47], [18, 45], [45, 43], [72, 30],
    [76, 8], [73, -18], [60, -40], [32, -52], [4, -55],
    [-28, -52], [-58, -48],
  ];

  wallPoints.forEach(([x, z], index) => {
    const cluster = createMangroveCluster(x, z, 7 + random(index + 900) * 4, 10 + Math.floor(random(index + 920) * 7), 900 + index * 17);
    cluster.scale.setScalar(1.18 + random(index + 940) * 0.22);
  });
}

function createBranchBetween(parent, start, end, radius, material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length < 0.001) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.18, length, 6), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createBoat(x, z, rotation = 0, color = 0x8e5d3d) {
  const group = new THREE.Group();
  group.position.set(x, 0.22, z);
  group.rotation.y = rotation;

  const hullGeometry = new THREE.BufferGeometry();
  const w = 1.15;
  const l = 5.8;
  const vertices = new Float32Array([
    -w, 0, l / 2,
    w, 0, l / 2,
    w, 0, -l / 2,
    -w, 0, -l / 2,
    -w * 0.44, -0.55, l / 2 - 0.58,
    w * 0.44, -0.55, l / 2 - 0.58,
    w * 0.44, -0.55, -l / 2 + 0.58,
    -w * 0.44, -0.55, -l / 2 + 0.58,
  ]);
  const indices = [
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
    4, 7, 6, 4, 6, 5,
  ];
  hullGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  hullGeometry.setIndex(indices);
  hullGeometry.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeometry, new THREE.MeshStandardMaterial({ color, roughness: 0.68 }));
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  [-1.25, 0, 1.25].forEach((benchZ) => {
    addBox(group, 0xd8bd8b, [1.55, 0.12, 0.24], [0, 0.08, benchZ], [0, 0, 0], {
      material: materials.paleWood,
    });
  });

  addBox(group, 0x453123, [0.08, 0.08, 3.6], [1.2, 0.18, -0.25], [0, 0.35, 0.2], {
    material: materials.darkWood,
  });

  scene.add(group);
  return group;
}

function createFishingFleet() {
  const boats = [
    [-53, 28, -0.85, 0x276f8f], [-58, 20, -0.65, 0xc16d35], [-63, 12, -0.35, 0x2f8a63],
    [-46, 36, -1.05, 0xd5b14d], [-36, 32, -0.9, 0x884e34], [58, -15, 1.45, 0x2b7891],
    [65, -9, 1.32, 0xc7833e], [70, -1, 1.1, 0x367c58], [66, 12, 0.92, 0xd2a743],
    [16, 35, 0.15, 0x7a5034], [25, 38, 0.35, 0x3d88a1], [-5, 45, -0.15, 0xbe6d42],
  ];

  boats.forEach(([x, z, rotation, color], index) => {
    const boat = createBoat(x, z, rotation, color);
    assignToPhase(3, boat);
    boat.scale.setScalar(index % 4 === 0 ? 1.18 : 0.92 + random(index + 90) * 0.22);
    animatedBoats.push({
      group: boat,
      origin: new THREE.Vector3(x, 0.22, z),
      rotation,
      speed: 0.22 + random(index + 31) * 0.22,
      drift: 0.8 + random(index + 44) * 1.7,
      phase: random(index + 53) * Math.PI * 2,
    });
  });
}

function createMountains() {
  const group = new THREE.Group();
  group.position.z = -92;

  for (let i = 0; i < 17; i += 1) {
    const x = -82 + i * 10.5;
    const height = 13 + random(i + 11) * 15;
    const radius = 9 + random(i + 31) * 8;
    const color = new THREE.Color().setHSL(0.34, 0.45, 0.25 + random(i + 19) * 0.12);
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height, 6 + Math.floor(random(i + 3) * 4)),
      new THREE.MeshStandardMaterial({ color, roughness: 0.96 }),
    );
    mountain.position.set(x, height / 2 - 1.2, random(i + 20) * 12 - 6);
    mountain.scale.x = 1.6 + random(i + 9) * 1.3;
    mountain.scale.z = 0.75 + random(i + 6) * 0.5;
    mountain.rotation.y = random(i + 71) * Math.PI;
    mountain.receiveShadow = true;
    group.add(mountain);
  }

  scene.add(group);
  return group;
}

function createPort() {
  const group = new THREE.Group();
  group.position.set(36, 0.25, -70);
  group.scale.set(0.82, 0.82, 0.82);

  addBox(group, 0x6c7478, [52, 0.8, 7], [0, 0.3, 0], [0, 0, 0], {
    roughness: 0.9,
  });

  const containerColors = [0xd94f36, 0x2f75b5, 0xe2b53f, 0x4fa35c, 0xb23a48];
  for (let i = 0; i < 36; i += 1) {
    const row = i % 12;
    const stack = Math.floor(i / 12);
    const color = containerColors[i % containerColors.length];
    addBox(group, color, [3.3, 1.1, 1.35], [-22 + row * 4, 1.05 + stack * 1.12, -0.8 + stack * 1.5], [0, 0, 0], {
      roughness: 0.55,
    });
  }

  createShip(group, -25, -8, 0x9d4a35);
  createShip(group, 22, -9, 0x415f72);

  [-18, 4, 25].forEach((x, index) => {
    createCrane(group, x, 4.2, 0x24607e + index * 0x001111);
  });

  scene.add(group);
  return group;
}

function createCircularPier(x, z, radius = 6) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const ellipseX = radius > 8 ? 1.38 : 1;
  const ellipseZ = radius > 8 ? 0.86 : 1;

  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.38, 72),
    materials.paleWood,
  );
  deck.position.y = deckY;
  deck.scale.set(ellipseX, 1, ellipseZ);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  const plazaPaver = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.84, radius * 0.84, 0.06, 72),
    new THREE.MeshStandardMaterial({ color: 0xd3c4ad, roughness: 0.84 }),
  );
  plazaPaver.position.y = deckY + 0.24;
  plazaPaver.scale.set(ellipseX * 0.98, 1, ellipseZ * 0.98);
  plazaPaver.receiveShadow = true;
  group.add(plazaPaver);

  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2;
    const px = Math.cos(angle) * (radius - 0.35) * ellipseX;
    const pz = Math.sin(angle) * (radius - 0.35) * ellipseZ;
    addCylinder(group, 0x6e4b32, 0.07, deckY + 0.2, [px, (deckY + 0.2) / 2 - 0.1, pz], {
      material: materials.darkWood,
      segments: 8,
    });
    addCylinder(group, 0xd0bea0, 0.045, 1.15, [px, deckY + 0.58, pz], {
      material: materials.rail,
      segments: 8,
    });
  }

  const rail = new THREE.Mesh(
    new THREE.TorusGeometry(radius - 0.35, 0.045, 8, 72),
    materials.rail,
  );
  rail.position.y = deckY + 1.1;
  rail.rotation.x = Math.PI / 2;
  rail.scale.set(ellipseX, ellipseZ, 1);
  rail.castShadow = true;
  group.add(rail);

  const grass = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, 0.08, 40),
    new THREE.MeshStandardMaterial({ color: 0x7fbc55, roughness: 0.9 }),
  );
  grass.position.y = deckY + 0.22;
  grass.scale.set(ellipseX * 0.92, 1, ellipseZ * 0.72);
  grass.receiveShadow = true;
  group.add(grass);

  const innerPath = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.66, 0.08, 8, 72),
    new THREE.MeshStandardMaterial({ color: 0xf4ead6, roughness: 0.8 }),
  );
  innerPath.position.y = deckY + 0.31;
  innerPath.rotation.x = Math.PI / 2;
  innerPath.scale.set(ellipseX * 0.94, ellipseZ * 0.72, 1);
  group.add(innerPath);

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2 + 0.2;
    createTinyPalm(group, Math.cos(angle) * radius * 0.53 * ellipseX, Math.sin(angle) * radius * 0.42 * ellipseZ);
  }

  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2 + 0.1;
    createPlazaBench(group, Math.cos(angle) * radius * 0.78 * ellipseX, Math.sin(angle) * radius * 0.72 * ellipseZ, angle + Math.PI / 2);
  }

  createPlazaKiosk(group, -radius * 0.18, -radius * 0.68 * ellipseZ, 0.06, 0xf39c4c, 'cafe');
  createPlazaKiosk(group, radius * 0.44 * ellipseX, -radius * 0.48 * ellipseZ, -0.45, 0x43b08b, 'artesania');
  createPlazaKiosk(group, radius * 0.62 * ellipseX, radius * 0.26 * ellipseZ, -1.15, 0x4b9fdd, 'comida');

  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    createNightLantern(group, Math.cos(angle) * radius * 0.95 * ellipseX, Math.sin(angle) * radius * 0.84 * ellipseZ, i);
  }

  createStaticCrowd(group, radius, ellipseX, ellipseZ);

  for (let i = 0; i < 6; i += 1) {
    const angle = -0.2 + i * 0.12;
    createBridgePlanter(group, Math.cos(angle) * radius * 0.62 * ellipseX, Math.sin(angle) * radius * 0.5 * ellipseZ, angle, 600 + i, i % 2 === 0 ? 1 : -1);
  }

  scene.add(group);
  return group;
}

function createPlazaBench(parent, x, z, rotation) {
  addBox(parent, 0x7c5738, [2.1, 0.18, 0.42], [x, deckY + 0.62, z], [0, rotation, 0], {
    material: materials.wood,
    castShadow: false,
  });
  addBox(parent, 0x6a4a31, [2.1, 0.16, 0.22], [x, deckY + 0.95, z - Math.cos(rotation) * 0.22], [0.18, rotation, 0], {
    material: materials.darkWood,
    castShadow: false,
  });
}

function createPlazaKiosk(parent, x, z, rotation, color) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;

  addBox(group, color, [3.0, 1.45, 2.1], [0, deckY + 1.0, 0], [0, 0, 0], {
    roughness: 0.62,
    castShadow: true,
  });
  addBox(group, 0xffe2a0, [2.45, 0.18, 0.08], [0, deckY + 1.35, 1.1], [0, 0, 0], {
    roughness: 0.35,
    castShadow: false,
  });
  const signMaterial = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.4 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, 0.06), signMaterial);
  sign.position.set(0, deckY + 1.74, 1.12);
  group.add(sign);

  const roof = createGableRoof(3.65, 2.9, 0.8, 0xb98451, 0.82);
  roof.position.y = deckY + 1.78;
  roof.rotation.y = Math.PI / 2;
  group.add(roof);

  const light = new THREE.PointLight(0xffb85c, 0, 7, 2);
  light.position.set(0, deckY + 1.55, 1.0);
  light.userData.nightIntensity = 1.15;
  group.add(light);
  nightPointLights.push(light);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.25, 12, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffb85c,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.position.set(0, deckY + 1.5, 0.5);
  glow.scale.set(1.2, 0.6, 1);
  glow.visible = false;
  glow.userData.phase = random(x + z + 77) * Math.PI * 2;
  glow.userData.baseScale = glow.scale.clone();
  group.add(glow);
  mangroveGlowMeshes.push(glow);

  parent.add(group);
}

function createNightLantern(parent, x, z, seed) {
  addCylinder(parent, 0x2d3832, 0.035, 1.8, [x, deckY + 1.05, z], {
    segments: 8,
    castShadow: false,
  });
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffdc91 }),
  );
  bulb.position.set(x, deckY + 1.98, z);
  parent.add(bulb);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 10, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffc873,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.position.copy(bulb.position);
  glow.userData.phase = random(seed + 501) * Math.PI * 2;
  glow.userData.baseScale = glow.scale.clone();
  glow.visible = false;
  parent.add(glow);
  mangroveGlowMeshes.push(glow);
}

function createStaticCrowd(parent, radius, ellipseX, ellipseZ) {
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x23313a });
  const headMaterial = new THREE.MeshBasicMaterial({ color: 0x8d6048 });
  for (let i = 0; i < 12; i += 1) {
    const angle = random(i + 810) * Math.PI * 2;
    const distance = radius * (0.32 + random(i + 820) * 0.5);
    const x = Math.cos(angle) * distance * ellipseX;
    const z = Math.sin(angle) * distance * ellipseZ;
    const person = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.55, 6), bodyMaterial);
    body.position.y = deckY + 0.62;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), headMaterial);
    head.position.y = deckY + 0.98;
    person.add(body, head);
    person.position.set(x, 0, z);
    person.rotation.y = angle + Math.PI;
    parent.add(person);
  }
}

function createLighting() {
  hemisphereLight = new THREE.HemisphereLight(0xdaf6ff, 0x4f6b3c, 1.6);
  scene.add(hemisphereLight);

  sunLight = new THREE.DirectionalLight(0xfff2cf, 2.4);
  sunLight.position.set(42, 58, 30);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 5;
  sunLight.shadow.camera.far = 130;
  sunLight.shadow.camera.left = -78;
  sunLight.shadow.camera.right = 78;
  sunLight.shadow.camera.top = 78;
  sunLight.shadow.camera.bottom = -78;
  sunLight.shadow.bias = -0.00008;
  sunLight.shadow.normalBias = 0.025;
  scene.add(sunLight);

  fillLight = new THREE.DirectionalLight(0xaedcff, 0.55);
  fillLight.position.set(-38, 24, -18);
  scene.add(fillLight);
}

function createSky() {
  const geometry = new THREE.SphereGeometry(150, 32, 16);
  skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x8ed2f0) },
      bottomColor: { value: new THREE.Color(0xeaf9ff) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geometry, skyMaterial);
  scene.add(sky);

  for (let i = 0; i < 9; i += 1) {
    const cloud = new THREE.Group();
    const cx = -75 + i * 18;
    const cy = 28 + random(i + 5) * 12;
    const cz = -58 - random(i + 12) * 42;
    for (let p = 0; p < 4; p += 1) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(2.5 + random(i * 10 + p) * 2.6, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
      );
      puff.position.set(cx + p * 2.6, cy + random(p + i) * 1.2, cz + random(p + 22) * 2);
      puff.scale.y = 0.42;
      cloud.add(puff);
    }
    scene.add(cloud);
  }
}

function localPoint(midX, midZ, angle, localX, localZ) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: midX + localX * cos + localZ * sin,
    z: midZ - localX * sin + localZ * cos,
  };
}

function createShip(parent, x, z, color) {
  addBox(parent, color, [13, 1.5, 3], [x, 1.05, z], [0, 0, 0], { roughness: 0.55 });
  addBox(parent, 0xf0eadc, [3.2, 2.2, 2.3], [x - 3.5, 2.7, z], [0, 0, 0], { roughness: 0.48 });
  addBox(parent, 0x333b42, [14.5, 0.5, 3.4], [x, 0.35, z], [0, 0, 0], { roughness: 0.65 });
}

function createCrane(parent, x, z, color) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
  addBox(parent, color, [0.55, 9, 0.55], [x, 5, z], [0, 0, 0], { material });
  addBox(parent, color, [0.55, 9, 0.55], [x + 4, 5, z], [0, 0, 0], { material });
  addBox(parent, color, [8, 0.45, 0.45], [x + 2, 9.5, z], [0, 0, 0], { material });
  addBox(parent, color, [12, 0.32, 0.32], [x + 6.5, 10.9, z], [0, 0, -0.22], { material });
  addBox(parent, color, [0.25, 3.5, 0.25], [x + 10.8, 9.3, z], [0, 0, 0], { material });
}

function createTinyPalm(parent, x, z) {
  addCylinder(parent, 0x6c4a2d, 0.055, 1.2, [x, deckY + 0.82, z], {
    material: materials.trunk,
    segments: 8,
  });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x4f9e4a, roughness: 0.82 });
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.3, 6), leafMaterial);
    leaf.position.set(x, deckY + 1.52, z);
    leaf.rotation.set(Math.PI / 2.7, (i / 6) * Math.PI * 2, 0);
    leaf.castShadow = true;
    parent.add(leaf);
  }
}

function handleKeyDown(event) {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'KeyQ', 'KeyE', 'ShiftLeft'].includes(event.code)) {
    event.preventDefault();
    keyboard.add(event.code);
  }
}

function toggleNightMode() {
  isNight = !isNight;
  document.body.classList.toggle('is-night', isNight);
  document.querySelector('#theme-toggle').textContent = isNight ? 'Modo dia' : 'Modo noche';

  scene.background.set(isNight ? 0x102238 : 0xbfe7f4);
  scene.fog.color.set(isNight ? 0x102238 : 0xbfe7f4);
  scene.fog.near = isNight ? 52 : 75;
  scene.fog.far = isNight ? 148 : 165;
  renderer.toneMappingExposure = isNight ? 1.05 : 1.08;

  hemisphereLight.color.set(isNight ? 0x193555 : 0xdaf6ff);
  hemisphereLight.groundColor.set(isNight ? 0x173923 : 0x4f6b3c);
  hemisphereLight.intensity = isNight ? 0.76 : 1.6;

  sunLight.color.set(isNight ? 0x8399c9 : 0xfff2cf);
  sunLight.intensity = isNight ? 0.44 : 2.4;
  sunLight.position.set(isNight ? -24 : 42, isNight ? 36 : 58, isNight ? -42 : 30);

  fillLight.color.set(isNight ? 0xffbd72 : 0xaedcff);
  fillLight.intensity = isNight ? 0.5 : 0.55;

  if (skyMaterial) {
    skyMaterial.uniforms.topColor.value.set(isNight ? 0x0a1630 : 0x8ed2f0);
    skyMaterial.uniforms.bottomColor.value.set(isNight ? 0x193a56 : 0xeaf9ff);
  }

  if (waterMesh) {
    waterMesh.material.color.set(isNight ? 0x0d3545 : 0x2d8891);
    waterMesh.material.opacity = isNight ? 0.9 : 0.82;
    waterMesh.material.roughness = isNight ? 0.08 : 0.18;
  }

  materials.glass.emissive.set(isNight ? 0xffd47a : 0x071319);
  materials.glass.emissiveIntensity = isNight ? 1.9 : 0.3;

  mangroveGlowMeshes.forEach((glow) => {
    glow.visible = isNight;
    glow.material.opacity = isNight ? 0.34 : 0;
  });
  nightPointLights.forEach((light) => {
    light.intensity = isNight ? (light.userData.nightIntensity ?? 0.7) : 0;
  });
}

function toggleWalkMode() {
  isWalkMode = !isWalkMode;
  const button = document.querySelector('#walk-toggle');
  button.textContent = isWalkMode ? 'Vista dron' : 'Caminar';

  if (isWalkMode) {
    camera.position.set(-34, deckY + 2.05, 8);
    controls.target.set(-28, deckY + 1.9, 3);
    controls.minDistance = 3.8;
    controls.maxDistance = 7;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.enablePan = false;
    controls.enableZoom = false;
  } else {
    camera.position.set(40, 34, 48);
    controls.target.set(0, 2, -4);
    controls.minDistance = 18;
    controls.maxDistance = 115;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.enablePan = true;
    controls.enableZoom = true;
  }
  controls.update();
}

function updateCameraMovement(delta) {
  const movingForward = keyboard.has('KeyW') || keyboard.has('ArrowUp');
  const movingBack = keyboard.has('KeyS') || keyboard.has('ArrowDown');
  const movingLeft = keyboard.has('KeyA') || keyboard.has('ArrowLeft');
  const movingRight = keyboard.has('KeyD') || keyboard.has('ArrowRight');
  const movingDown = !isWalkMode && keyboard.has('KeyQ');
  const movingUp = !isWalkMode && keyboard.has('KeyE');
  if (!movingForward && !movingBack && !movingLeft && !movingRight && !movingDown && !movingUp) {
    return;
  }

  const speed = (keyboard.has('ShiftLeft') ? (isWalkMode ? 9 : 18) : (isWalkMode ? 5.2 : 9)) * delta;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const move = new THREE.Vector3();

  if (movingForward) move.add(forward);
  if (movingBack) move.sub(forward);
  if (movingRight) move.add(right);
  if (movingLeft) move.sub(right);
  if (movingUp) move.y += 1;
  if (movingDown) move.y -= 1;

  if (move.lengthSq() === 0) return;
  move.normalize().multiplyScalar(speed);
  camera.position.add(move);
  controls.target.add(move);
  if (isWalkMode) {
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -76, 72);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -50, 42);
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -78, 74);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -52, 44);
    keepWalkCameraLevel();
  } else {
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 5, 70);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 1.2, 35);
  }
}

function keepWalkCameraLevel() {
  if (!isWalkMode) return;
  const direction = new THREE.Vector3().subVectors(controls.target, camera.position);
  direction.y = 0;
  if (direction.lengthSq() < 0.0001) {
    direction.set(0, 0, -1);
  }
  direction.normalize();
  camera.position.y = deckY + 2.05;
  controls.target.copy(camera.position).add(direction.multiplyScalar(5));
  controls.target.y = deckY + 1.9;
  camera.lookAt(controls.target);
}

function updateAnimatedBoats(elapsed) {
  animatedBoats.forEach((boat) => {
    const bob = Math.sin(elapsed * 1.4 + boat.phase) * 0.08;
    const driftX = Math.sin(elapsed * boat.speed + boat.phase) * boat.drift;
    const driftZ = Math.cos(elapsed * boat.speed * 0.8 + boat.phase) * boat.drift * 0.35;
    boat.group.position.set(boat.origin.x + driftX, 0.22 + bob, boat.origin.z + driftZ);
    boat.group.rotation.y = boat.rotation + Math.sin(elapsed * boat.speed + boat.phase) * 0.08;
  });
}

function updateNightGlow(elapsed) {
  if (!isNight) return;
  mangroveGlowMeshes.forEach((glow) => {
    const pulse = 0.25 + Math.sin(elapsed * 1.8 + glow.userData.phase) * 0.1;
    glow.material.opacity = pulse;
    const baseScale = glow.userData.baseScale || new THREE.Vector3(1, 1, 1);
    glow.scale.copy(baseScale).multiplyScalar(1 + Math.sin(elapsed * 1.5 + glow.userData.phase) * 0.04);
  });
  nightPointLights.forEach((light, index) => {
    const baseIntensity = light.userData.nightIntensity ?? 0.7;
    light.intensity = baseIntensity + Math.sin(elapsed * 1.6 + index) * baseIntensity * 0.18;
  });
}

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;
  if (waterMesh && waterBasePositions) {
    const position = waterMesh.geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const ix = i * 3;
      const x = waterBasePositions[ix];
      const y = waterBasePositions[ix + 1];
      const wave =
        Math.sin(x * 0.22 + elapsed * 0.9) * 0.08 +
        Math.cos(y * 0.18 + elapsed * 0.65) * 0.07 +
        Math.sin((x + y) * 0.09 + elapsed * 1.2) * 0.035;
      position.array[ix + 2] = wave;
    }
    position.needsUpdate = true;
  }

  updateCameraMovement(delta);
  updateAnimatedBoats(elapsed);
  updateNightGlow(elapsed);
  controls.update();
  keepWalkCameraLevel();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

createScene();
