import {
  ground,
  land,
  walkable,
  waterDepth,
  shoreDistance,
  COAST_RADII,
  dayCycle,
  NIGHT_START,
  biomeColor,
} from './island.js';
import { waterVertex, waterFragment } from './water.js';
export { ground, land } from './island.js';
import * as THREE from 'three';
import {
  NPCS,
  NOTES,
  CHIMES,
  RESOURCES,
  FISH_SPOT,
  TRADES,
} from './content.js';

const UP = new THREE.Vector3(0, 1, 0),
  dummy = new THREE.Object3D();
let seed = 74129;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const matCache = new Map();
function material(color, roughness = 0.85) {
  const key = color + ':' + roughness;
  if (!matCache.has(key))
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return matCache.get(key);
}
const sphere = new THREE.SphereGeometry(1, 16, 12),
  box = new THREE.BoxGeometry(1, 1, 1),
  cone = new THREE.ConeGeometry(1, 1, 9),
  cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
function mesh(group, geo, color, x, y, z, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(
    geo,
    typeof color === 'object' ? color : material(color),
  );
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}
function ell(g, c, x, y, z, sx, sy, sz) {
  return mesh(g, sphere, c, x, y, z, sx, sy, sz);
}
function cube(g, c, x, y, z, sx, sy, sz) {
  return mesh(g, box, c, x, y, z, sx, sy, sz);
}
export function penguin(color = 0xd1614e, kind = 'penguin') {
  const g = new THREE.Group(),
    body = new THREE.Group();
  g.add(body);
  const fur = kind === 'otter' ? 0x685344 : 0x273842;
  ell(body, fur, 0, 1.0, 0, 0.65, 0.89, 0.56);
  ell(body, 0xf5eee0, 0, 0.99, 0.37, 0.49, 0.67, 0.24);
  ell(body, fur, 0, 1.93, 0, 0.59, 0.58, 0.52);
  ell(body, 0xf8f2e6, -0.22, 2.0, 0.4, 0.25, 0.29, 0.13);
  ell(body, 0xf8f2e6, 0.22, 2.0, 0.4, 0.25, 0.29, 0.13);
  ell(body, 0x192a30, -0.21, 2.04, 0.515, 0.062, 0.082, 0.042);
  ell(body, 0x192a30, 0.21, 2.04, 0.515, 0.062, 0.082, 0.042);
  ell(body, 0xffffff, -0.225, 2.07, 0.55, 0.022, 0.027, 0.015);
  ell(body, 0xffffff, 0.195, 2.07, 0.55, 0.022, 0.027, 0.015);
  const beak = mesh(
    body,
    cone,
    0xe7a14d,
    0,
    1.87,
    0.63,
    kind === 'puffin' ? 0.24 : 0.16,
    0.35,
    0.16,
  );
  beak.rotation.x = Math.PI / 2;
  if (kind === 'otter') {
    ell(body, 0xd0b08a, 0, 1.84, 0.5, 0.33, 0.2, 0.15);
    ell(body, 0x302b2a, 0, 1.9, 0.64, 0.09, 0.055, 0.055);
    ell(body, fur, -0.47, 2.28, 0, 0.15, 0.18, 0.13);
    ell(body, fur, 0.47, 2.28, 0, 0.15, 0.18, 0.13);
  }
  const left = ell(body, fur, -0.63, 1.13, 0, 0.15, 0.58, 0.29),
    right = ell(body, fur, 0.63, 1.13, 0, 0.15, 0.58, 0.29);
  left.rotation.z = -0.25;
  right.rotation.z = 0.25;
  const feet = [
    ell(g, 0xd99744, -0.28, 0.15, 0.17, 0.26, 0.12, 0.4),
    ell(g, 0xd99744, 0.28, 0.15, 0.17, 0.26, 0.12, 0.4),
  ];
  mesh(
    body,
    new THREE.TorusGeometry(0.48, 0.11, 7, 24),
    color,
    0,
    1.53,
    0.03,
  ).rotation.x = Math.PI / 2;
  const scarf = cube(body, color, 0.35, 1.16, 0.48, 0.2, 0.7, 0.095);
  scarf.rotation.z = 0.13;
  g.userData = { body, left, right, feet, scarf };
  return g;
}
export class World {
  constructor(canvas, state, onError) {
    this.state = state;
    this.colliders = [];
    this.houses = [];
    this.cycle = dayCycle(state.playtime);
    this.lastRipple = -1;
    this.rippleIndex = 0;
    this.entities = [];
    this.npcMeshes = new Map();
    this.pickups = new Map();
    this.time = 0;
    this.moveTime = 0;
    this.destination = null;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      onError?.();
    });
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x82b9bd);
    this.scene.fog = new THREE.FogExp2(0xa3c6c3, 0.0029);
    this.camera = new THREE.OrthographicCamera(-30, 30, 25, -25, 0.1, 420);
    this.focus = new THREE.Vector3(state.x, ground(state.x, state.z), state.z);
    this.zoom = 24;
    this.ambient = new THREE.HemisphereLight(0xd7effa, 0x878052, 2.3);
    this.moon = new THREE.DirectionalLight(0x94b9ee, 0);
    this.scene.add(this.ambient, this.moon, this.moon.target);
    this.sun = new THREE.DirectionalLight(0xffe6b7, 3.4);
    this.sun.position.set(-45, 80, 35);
    this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, {
      left: -48,
      right: 48,
      top: 48,
      bottom: -48,
      near: 1,
      far: 180,
    });
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun, this.sun.target);
    this.buildTerrain();
    this.buildVillage();
    this.buildNature();
    this.buildPeople();
    this.buildObjects();
    this.buildNightLife();
    this.player = penguin();
    this.player.scale.setScalar(1.13);
    this.player.position.set(state.x, ground(state.x, state.z), state.z);
    this.scene.add(this.player);
    const satchel = cube(
      this.player.userData.body,
      0xa87b48,
      -0.52,
      0.88,
      -0.34,
      0.5,
      0.55,
      0.32,
    );
    satchel.rotation.z = -0.1;
    const strap = cube(
      this.player.userData.body,
      0x93714d,
      -0.32,
      1.23,
      -0.4,
      0.1,
      0.85,
      0.08,
    );
    strap.rotation.z = -0.55;
    this.fruit = new THREE.Group();
    this.fruit.position.set(0.44, 0.94, 0.64);
    this.player.userData.body.add(this.fruit);
    ell(this.fruit, 0xa93638, 0, 0, 0, 0.26, 0.27, 0.24);
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      mesh(
        this.fruit,
        cone,
        0xb65540,
        Math.sin(a) * 0.08,
        0.28,
        Math.cos(a) * 0.08,
        0.05,
        0.16,
        0.05,
      );
    }
    this.marker = mesh(
      this.scene,
      new THREE.TorusGeometry(0.85, 0.05, 6, 40),
      0xf6db9d,
      state.x,
      2,
      state.z,
    );
    this.marker.rotation.x = Math.PI / 2;
    this.marker.visible = false;
    this.pointer = mesh(
      this.scene,
      new THREE.ConeGeometry(0.48, 0.9, 4),
      new THREE.MeshBasicMaterial({
        color: 0xffed79,
        toneMapped: false,
        fog: false,
      }),
      0,
      0,
      0,
    );
    this.pointer.rotation.z = Math.PI;
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(UP, -1.5);
    this.resize();
    this.sync();
  }
  buildTerrain() {
    this.waterMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        daylight: { value: 1 },
        lightDirection: {
          value: new THREE.Vector3(-0.48, 0.8, 0.36).normalize(),
        },
        coast: { value: COAST_RADII },
        rippleOrigin: {
          value: Array.from({ length: 8 }, () => new THREE.Vector2()),
        },
        rippleAge: { value: Array(8).fill(2) },
      },
      vertexShader: waterVertex,
      fragmentShader: waterFragment,
      transparent: true,
      depthWrite: false,
    });
    this.water = mesh(
      this.scene,
      new THREE.PlaneGeometry(1600, 1600),
      this.waterMaterial,
      0,
      0,
      0,
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.receiveShadow = false;
    this.water.castShadow = false;
    const geo = new THREE.PlaneGeometry(300, 280, 240, 224);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const colors = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i);
      p.setY(i, ground(x, z));
      const c = new THREE.Color(biomeColor(x, z));
      c.multiplyScalar(0.96 + rand() * 0.08);
      colors.push(c.r, c.g, c.b);
    }
    const indices = [];
    for (let i = 0; i < geo.index.count; i += 3) {
      const ids = [
        geo.index.getX(i),
        geo.index.getX(i + 1),
        geo.index.getX(i + 2),
      ];
      if (ids.every((j) => shoreDistance(p.getX(j), p.getZ(j)) > -30))
        indices.push(...ids);
    }
    geo.setIndex(indices);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.terrain = mesh(
      this.scene,
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
      0,
      0,
      0,
    );
    this.terrain.castShadow = false;
    const paths = [
      [
        [-38, 86],
        [-32, 54],
        [-20, 33],
        [0, 9],
        [5, -23],
        [15, -57],
        [24, -87],
      ],
      [
        [-87, 8],
        [-66, -12],
        [-38, -3],
        [0, 9],
        [37, 15],
        [73, 26],
        [93, 35],
      ],
      [
        [-71, 53],
        [-47, 48],
        [-20, 33],
        [12, 37],
        [44, 60],
        [68, 65],
      ],
      [
        [-54, -77],
        [-46, -46],
        [-38, -3],
      ],
      [
        [15, -57],
        [43, -65],
        [60, -78],
      ],
      [
        [37, 15],
        [58, -11],
        [61, -51],
      ],
      [
        [-66, -12],
        [-61, -33],
        [-78, -30],
      ],
    ];
    this.paths = paths;
    for (const points of paths) {
      const curve = new THREE.CatmullRomCurve3(
        points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      );
      const pts = curve.getPoints(100),
        verts = [],
        ix = [];
      for (let i = 0; i < pts.length; i++) {
        const t = curve.getTangent(i / 100),
          n = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(1.65);
        for (const s of [-1, 1]) {
          const x = pts[i].x + n.x * s,
            z = pts[i].z + n.z * s;
          verts.push(x, ground(x, z) + 0.035, z);
        }
        if (i < 100) {
          const a = i * 2;
          ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      g.setIndex(ix);
      g.computeVertexNormals();
      mesh(this.scene, g, 0xbfb48c, 0, 0, 0);
    }
  }
  house(x, z, color = 0x527c83, size = 1) {
    const g = new THREE.Group();
    g.position.set(x, ground(x, z), z);
    g.scale.setScalar(size);
    this.scene.add(g);
    const windows = new THREE.MeshStandardMaterial({
      color: 0xb5d4cb,
      emissive: 0xffb85b,
      emissiveIntensity: 0,
      roughness: 0.3,
    });
    const glow = mesh(
      g,
      new THREE.CircleGeometry(3, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffbd70,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
      0,
      0.04,
      4.2,
      1,
      0.7,
      1,
    );
    glow.rotation.x = -Math.PI / 2;
    glow.castShadow = false;
    this.houses.push({
      x,
      z,
      size,
      windows,
      glow,
      door: { x, z: z + 4.6 * size },
    });
    cube(g, 0xdfcfac, 0, 2.0, 0, 5.8, 4, 4.9);
    cube(g, 0x877157, 0, 0.3, 0, 6.1, 0.5, 5.2);
    const roof = new THREE.CylinderGeometry(4.5, 4.5, 6.8, 3, 1);
    roof.rotateZ(Math.PI / 2);
    roof.rotateX(-Math.PI / 2);
    mesh(g, roof, color, 0, 5.2, 0, 1, 0.55, 0.8);
    for (const xx of [-2.8, 2.8])
      cube(g, 0x786047, xx, 2.1, 2.5, 0.16, 4.1, 0.13);
    cube(g, 0x705744, 0, 1.25, 2.52, 1.3, 2.5, 0.13);
    ell(g, 0xe2b668, 0.4, 1.2, 2.62, 0.07, 0.07, 0.06);
    for (const xx of [-1.85, 1.85]) {
      cube(g, 0x66543f, xx, 2.35, 2.55, 1.22, 1.38, 0.15);
      cube(g, windows, xx, 2.35, 2.65, 1, 1.15, 0.05);
      cube(g, 0xf0e0be, xx, 2.35, 2.71, 0.08, 1.2, 0.06);
      cube(g, 0xf0e0be, xx, 2.35, 2.71, 1.1, 0.08, 0.06);
      cube(g, 0x82664e, xx, 1.55, 2.9, 1.5, 0.27, 0.5);
      for (let j = 0; j < 4; j++)
        ell(
          g,
          j % 2 ? 0xbd7b85 : 0xe4bd73,
          xx - 0.5 + j * 0.33,
          1.81,
          2.95,
          0.18,
          0.22,
          0.18,
        );
    }
    cube(g, 0x897d6c, 1.7, 5.7, -0.7, 0.7, 2, 0.8);
    this.colliders.push({ x, z, r: 3.6 * size });
    this.smokes ??= [];
    for (let i = 0; i < 3; i++) {
      const s = ell(
        this.scene,
        new THREE.MeshBasicMaterial({
          color: 0xe4e6dc,
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
        }),
        x + 1.7 * size,
        ground(x, z) + 7 * size + i,
        z - 0.7 * size,
        0.38,
        0.6,
        0.38,
      );
      s.userData = {
        x: s.position.x,
        y: s.position.y,
        z: s.position.z,
        phase: rand() * 6,
      };
      this.smokes.push(s);
    }
    return g;
  }
  buildVillage() {
    [
      [-27, 40, 0xa75e4c, 0.95],
      [5, 10, 0xb4835c, 1.15],
      [-51, 60, 0x698b91, 0.85],
      [-71, 39, 0x758386, 1],
      [-73, -6, 0x826d4b, 1],
      [-51, -40, 0xb2955b, 0.9],
      [61, 0, 0x627e65, 1.05],
      [25, -12, 0xa96864, 1],
      [-10, -18, 0x637c81, 0.95],
      [-36, -9, 0x9a785c, 0.8],
      [75, 20, 0x685d4c, 1.1],
      [34, 19, 0xa77c50, 0.8],
      [-22, 13, 0x66818a, 0.75],
      [61, -85, 0x4b8196, 1.12],
    ].forEach((a) => this.house(...a));
    // Market stalls, produce, and hanging awnings.
    for (const [x, z, col] of [
      [-18, 42, 0xc77760],
      [16, 24, 0xc6a66b],
      [-62, 4, 0x8ea272],
    ]) {
      const y = ground(x, z),
        g = new THREE.Group();
      g.position.set(x, y, z);
      this.scene.add(g);
      cube(g, 0x967351, 0, 1.1, 0, 3.3, 0.3, 1.8);
      for (const a of [-1.45, 1.45])
        for (const b of [-0.7, 0.7])
          cube(g, 0x766044, a, 1.6, b, 0.13, 3.2, 0.13);
      for (let j = 0; j < 6; j++)
        cube(g, j % 2 ? 0xeee1bd : col, -1.5 + j * 0.6, 3.1, 0, 0.6, 0.14, 2.3);
      for (let j = 0; j < 9; j++)
        ell(
          g,
          j % 2 ? 0xbb6250 : 0xd9b267,
          -1 + (j % 3),
          1.45,
          Math.floor(j / 3) * 0.5 - 0.5,
          0.25,
          0.25,
          0.25,
        );
    }
    // Jetty and a little boat.
    for (let i = 0; i < 18; i++)
      cube(this.scene, 0x967e5b, -39, 0.85, 83 + i * 0.8, 6, 0.25, 0.65);
    for (let z = 83; z < 98; z += 4)
      for (const x of [-42, -36])
        cube(this.scene, 0x79674f, x, 0.8, z, 0.3, 2, 0.3);
    this.boat = new THREE.Group();
    this.boat.position.set(-46, 0.2, 94);
    this.scene.add(this.boat);
    ell(this.boat, 0x765840, 0, 0.5, 0, 1.5, 0.7, 3.2);
    ell(this.boat, 0xc6a678, 0, 0.82, 0, 1.24, 0.2, 2.7);
    cube(this.boat, 0x816444, 0, 2.9, 0, 0.13, 4.5, 0.13);
    const sail = mesh(
      this.boat,
      new THREE.PlaneGeometry(2.4, 3),
      new THREE.MeshStandardMaterial({
        color: 0xf2e4c2,
        side: THREE.DoubleSide,
      }),
      1.1,
      3.2,
      0,
    );
    sail.rotation.y = 0.2;
    // Northlight lighthouse, rotating glass lantern, and coastal rock foundation.
    const x = -54,
      z = -76,
      y = ground(x, z);
    this.lighthouse = new THREE.Group();
    this.lighthouse.position.set(x, y, z);
    this.scene.add(this.lighthouse);
    mesh(
      this.lighthouse,
      new THREE.CylinderGeometry(2.2, 3.3, 13, 24),
      0xe5dfca,
      0,
      6.5,
      0,
    );
    mesh(
      this.lighthouse,
      new THREE.CylinderGeometry(2.7, 2.85, 1.8, 24),
      0xaf6255,
      0,
      6,
      0,
    );
    mesh(this.lighthouse, cylinder, 0x646e69, 0, 13.3, 0, 3, 0.3, 3);
    mesh(
      this.lighthouse,
      cylinder,
      new THREE.MeshStandardMaterial({
        color: 0xa6d9d8,
        transparent: true,
        opacity: 0.5,
        metalness: 0.3,
        roughness: 0.15,
      }),
      0,
      14.8,
      0,
      2,
      1.4,
      2,
    );
    mesh(this.lighthouse, cone, 0x5d7174, 0, 16.2, 0, 3, 2, 3);
    this.lamp = ell(
      this.lighthouse,
      new THREE.MeshBasicMaterial({ color: 0xffdf94 }),
      0,
      14.7,
      0,
      0.75,
      0.75,
      0.75,
    );
    this.lamp.visible = false;
    this.beamGroup = new THREE.Group();
    this.beamGroup.position.set(x, y + 14.7, z);
    this.scene.add(this.beamGroup);
    const beam = mesh(
      this.beamGroup,
      new THREE.ConeGeometry(10, 75, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe4a4,
        transparent: true,
        opacity: 0.045,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      0,
      0,
      37.5,
    );
    beam.rotation.x = -Math.PI / 2;
    this.beamGroup.visible = false;
    this.colliders.push({ x, z, r: 3.5 });
    // Your porch: the chair is waiting from the very beginning.
    const chair = new THREE.Group();
    chair.position.set(66, ground(66, -78), -78);
    this.scene.add(chair);
    cube(chair, 0xa68962, 0, 0.7, 0, 1.3, 0.18, 1.5);
    const back = cube(chair, 0xa68962, 0, 1.4, -0.65, 1.3, 1.5, 0.15);
    back.rotation.x = -0.16;
    for (const xx of [-0.5, 0.5])
      for (const zz of [-0.5, 0.5])
        cube(chair, 0x826c51, xx, 0.35, zz, 0.15, 0.7, 0.15);
    // Small stone fountain in the town square.
    const fy = ground(-1, 0);
    mesh(this.scene, cylinder, 0x9a9c87, -1, fy + 0.3, 0, 2.3, 0.6, 2.3);
    mesh(this.scene, cylinder, 0x79b4b1, -1, fy + 0.63, 0, 1.85, 0.05, 1.85);
    mesh(this.scene, cylinder, 0xc4bfa5, -1, fy + 1.4, 0, 0.4, 1.7, 0.4);
    ell(this.scene, 0xc9c1a4, -1, fy + 2.3, 0, 0.65, 0.65, 0.65);
    this.colliders.push({ x: -1, z: 0, r: 2.4 });
  }
  batch(geo, color, transforms) {
    if (!transforms.length) return;
    const m = new THREE.InstancedMesh(geo, material(color), transforms.length);
    transforms.forEach((t, i) => {
      dummy.position.set(t[0], t[1], t[2]);
      dummy.scale.set(t[3], t[4], t[5]);
      dummy.rotation.set(0, t[6] || 0, t[7] || 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
  }
  buildNature() {
    const trunks = [],
      foliage = [[], [], []],
      rocks = [],
      flowers = [[], [], []],
      grass = [];
    const protectedPoints = [
      ...NPCS,
      ...RESOURCES,
      ...NOTES,
      ...CHIMES,
      FISH_SPOT,
    ];
    const clear = (x, z, r) =>
      protectedPoints.every((p) => Math.hypot(p.x - x, p.z - z) > r) &&
      this.colliders.every((p) => Math.hypot(p.x - x, p.z - z) > p.r + r) &&
      this.paths.every((path) =>
        path.every((p, i) => {
          if (!i) return true;
          const a = path[i - 1],
            dx = p[0] - a[0],
            dz = p[1] - a[1],
            t = Math.max(
              0,
              Math.min(
                1,
                ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz),
              ),
            );
          return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) > r + 2;
        }),
      );
    for (let i = 0; i < 450; i++) {
      const x = rand() * 214 - 107,
        z = rand() * 190 - 95;
      if (
        !land(x, z) ||
        !clear(x, z, 4) ||
        z > 62 ||
        (x > -33 && x < 38 && z > -38)
      )
        continue;
      const y = ground(x, z),
        s = 0.65 + rand() * 0.65;
      trunks.push([x, y + 1.5 * s, z, 0.26 * s, 3 * s, 0.26 * s]);
      for (let k = 0; k < 3; k++)
        foliage[k].push([
          x,
          y + (3 + k * 1.4) * s,
          z,
          (2.25 - k * 0.45) * s,
          3.8 * s,
          (2.25 - k * 0.45) * s,
          rand() * 3,
        ]);
      this.colliders.push({ x, z, r: 0.55 });
    }
    this.batch(cylinder, 0x75634c, trunks);
    [0x477563, 0x548170, 0x638e79].forEach((c, i) =>
      this.batch(cone, c, foliage[i]),
    );
    const apples = [];
    for (let i = 0; i < 17; i++) {
      const x = -91 + rand() * 48,
        z = -42 + rand() * 74;
      if (!clear(x, z, 3)) continue;
      const y = ground(x, z);
      mesh(this.scene, cylinder, 0x806144, x, y + 1.5, z, 0.25, 3, 0.25);
      ell(this.scene, 0x769757, x, y + 3.6, z, 2.4, 2.4, 2.1);
      for (let j = 0; j < 7; j++) {
        const a = rand() * Math.PI * 2;
        apples.push([
          x + Math.cos(a) * 2,
          y + 3 + rand() * 1.8,
          z + Math.sin(a) * 1.8,
          0.18,
          0.2,
          0.18,
        ]);
      }
      this.colliders.push({ x, z, r: 0.6 });
    }
    this.batch(sphere, 0xc8784a, apples);
    for (let i = 0; i < 1900; i++) {
      const x = rand() * 225 - 112,
        z = rand() * 202 - 101;
      if (!land(x, z)) continue;
      const y = ground(x, z);
      if (i < 160 && clear(x, z, 2)) {
        const s = 0.3 + rand() * 0.8;
        rocks.push([x, y + 0.2 * s, z, s, 0.65 * s, 0.8 * s, rand() * 6]);
      } else if (i < 900 && clear(x, z, 1)) {
        const j = i % 3;
        flowers[j].push([x, y + 0.16, z, 0.07, 0.2, 0.07]);
      } else if (clear(x, z, 0.5))
        grass.push([x, y + 0.15, z, 0.08, 0.4, 0.08, rand() * 6, 0.2]);
    }
    this.batch(new THREE.DodecahedronGeometry(1, 0), 0x8c9685, rocks);
    [0xe2c282, 0xe1dfba, 0xb599b3].forEach((c, i) =>
      this.batch(sphere, c, flowers[i]),
    );
    this.batch(cone, 0x6f8a58, grass);
    // Distant mountains sit beyond the playable shoreline.
    for (let i = 0; i < 9; i++) {
      const x = -180 + i * 44,
        z = -175 - rand() * 30,
        s = 22 + rand() * 24;
      mesh(this.scene, cone, 0x789a96, x, s * 0.45 - 2, z, s, s * 1.7, s);
      mesh(
        this.scene,
        cone,
        0xd3ddd6,
        x,
        s * 1.05,
        z,
        s * 0.43,
        s * 0.75,
        s * 0.43,
      );
    }
    this.birds = [];
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const l = cube(g, 0xf3eee1, -0.35, 0, 0, 0.7, 0.055, 0.16),
        r = cube(g, 0xf3eee1, 0.35, 0, 0, 0.7, 0.055, 0.16);
      g.userData = { l, r, phase: rand() * 6, radius: 22 + rand() * 35 };
      this.scene.add(g);
      this.birds.push(g);
    }
  }
  buildPeople() {
    for (const n of NPCS) {
      const g = penguin(n.color, n.kind);
      g.position.set(n.x, ground(n.x, n.z), n.z);
      g.rotation.y = 0.2;
      this.scene.add(g);
      this.npcMeshes.set(n.id, g);
      this.entities.push({ ...n, type: 'npc' });
    }
  }
  buildObjects() {
    for (const r of RESOURCES) {
      const g = new THREE.Group();
      g.position.set(r.x, ground(r.x, r.z), r.z);
      this.scene.add(g);
      if (r.type === 'wood') {
        const log = mesh(g, cylinder, 0x8f7557, 0, 0.25, 0, 0.25, 1.7, 0.25);
        log.rotation.z = Math.PI / 2;
        ell(g, 0xb8a183, 0.85, 0.25, 0, 0.015, 0.2, 0.2);
      } else if (r.type === 'herbs') {
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const leaf = ell(
            g,
            0x497c62,
            Math.sin(a) * 0.3,
            0.3,
            Math.cos(a) * 0.3,
            0.15,
            0.45,
            0.15,
          );
          leaf.rotation.z = 0.4 * Math.sin(a);
        }
      } else if (r.type === 'mushroom') {
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * 0.45;
          mesh(g, cylinder, 0xe4d7b8, x, 0.25, 0, 0.09, 0.5, 0.09);
          ell(g, 0xc99651, x, 0.55, 0, 0.3, 0.18, 0.3);
        }
      } else mesh(g, new THREE.OctahedronGeometry(0.3), 0x86e1d2, 0, 0.35, 0);
      this.pickups.set(r.id, g);
      this.entities.push({ ...r, type: 'resource', resource: r.type });
    }
    for (const n of NOTES) {
      const g = new THREE.Group();
      g.position.set(n.x, ground(n.x, n.z), n.z);
      const paper = cube(g, 0xf7e5b6, 0, 0.3, 0, 0.6, 0.06, 0.4);
      paper.rotation.y = 0.5;
      mesh(g, new THREE.OctahedronGeometry(0.1), 0xffd787, 0, 1, 0);
      this.scene.add(g);
      this.pickups.set(n.id, g);
      this.entities.push({ ...n, type: 'note' });
    }
    for (const c of CHIMES) {
      const g = new THREE.Group();
      g.position.set(c.x, ground(c.x, c.z), c.z);
      for (const x of [-0.7, 0.7])
        cube(g, 0x8d7652, x, 1.7, 0, 0.13, 3.4, 0.13);
      cube(g, 0x8d7652, 0, 3.3, 0, 1.8, 0.16, 0.2);
      for (let j = 0; j < 3; j++)
        mesh(
          g,
          cylinder,
          0xc8b778,
          (j - 1) * 0.38,
          2.4 - j * 0.2,
          0,
          0.085,
          1 + j * 0.3,
          0.085,
        );
      this.scene.add(g);
      this.entities.push({ ...c, type: 'chime' });
    }
    this.entities.push({ ...FISH_SPOT, type: 'fishing' });
    const f = mesh(
      this.scene,
      new THREE.TorusGeometry(1.25, 0.07, 5, 30),
      new THREE.MeshBasicMaterial({
        color: 0xcef0e4,
        transparent: true,
        opacity: 0.65,
      }),
      FISH_SPOT.x,
      ground(FISH_SPOT.x, FISH_SPOT.z) + 0.1,
      FISH_SPOT.z,
    );
    f.rotation.x = Math.PI / 2;
    this.fishRing = f;
  }
  buildNightLife() {
    this.porchLights = Array.from({ length: 4 }, () => {
      const light = new THREE.PointLight(0xffba71, 0, 13, 2);
      this.scene.add(light);
      return light;
    });
    for (const n of NPCS) {
      const houses = [...this.houses].sort(
        (a, b) =>
          Math.hypot(a.x - n.x, a.z - n.z) - Math.hypot(b.x - n.x, b.z - n.z),
      );
      let route, home;
      for (const h of houses) {
        for (const dx of [0, -2, 2]) {
          const door = { x: h.x + dx, z: h.z + 6.5 * h.size };
          route = this.findRoute(n, door.x, door.z, true);
          if (route) {
            home = h;
            break;
          }
        }
        if (route) break;
      }
      const points = [{ x: n.x, z: n.z }, ...(route || [])];
      if (home) points.push({ x: home.x, z: home.z + 2.9 * home.size });
      let total = 0;
      const lengths = [0];
      for (let i = 1; i < points.length; i++) {
        total += Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].z - points[i - 1].z,
        );
        lengths.push(total);
      }
      this.npcMeshes.get(n.id).userData.commute = {
        points,
        lengths,
        total,
        home,
      };
    }
    this.pickupMaterials = [];
    for (const group of this.pickups.values())
      group.traverse((obj) => {
        if (obj.isMesh && obj.material.emissive) {
          obj.material = obj.material.clone();
          obj.material.emissive.set(0x6b977f);
          this.pickupMaterials.push(obj.material);
        }
      });
  }
  npcPosition(id) {
    return this.npcMeshes.get(id)?.position;
  }
  updateNeighbours() {
    const c = this.cycle;
    for (const n of NPCS) {
      const g = this.npcMeshes.get(n.id),
        r = g.userData.commute;
      const travel = Math.max(2, Math.min(40, r.total / 2.8));
      const progress = c.night
        ? 1
        : c.goingHome
          ? THREE.MathUtils.clamp(
              (c.time - (NIGHT_START - travel)) / travel,
              0,
              1,
            )
          : c.waking
            ? 1 - THREE.MathUtils.clamp(c.time / Math.min(20, travel), 0, 1)
            : 0;
      const distance = progress * r.total;
      let index = 1;
      while (index < r.lengths.length - 1 && r.lengths[index] < distance)
        index++;
      const a = r.points[Math.max(0, index - 1)],
        b = r.points[Math.min(index, r.points.length - 1)];
      const fraction = r.total
        ? Math.max(
            0,
            Math.min(
              1,
              (distance - (r.lengths[index - 1] || 0)) /
                Math.max(
                  0.001,
                  (r.lengths[index] || 0) - (r.lengths[index - 1] || 0),
                ),
            ),
          )
        : 0;
      const x = a.x + (b.x - a.x) * fraction,
        z = a.z + (b.z - a.z) * fraction;
      g.position.set(x, ground(x, z), z);
      g.visible = !c.night;
      const walking = (c.goingHome || c.waking) && progress > 0 && progress < 1;
      g.userData.body.position.y = walking
        ? Math.abs(Math.sin(this.time * 11 + n.x)) * 0.08
        : Math.sin(this.time * 1.5 + n.x) * 0.035;
      g.userData.body.rotation.z = walking
        ? Math.sin(this.time * 11 + n.x) * 0.065
        : 0;
      g.userData.feet[0].position.z =
        0.17 + (walking ? Math.sin(this.time * 11 + n.x) * 0.18 : 0);
      g.userData.feet[1].position.z =
        0.17 - (walking ? Math.sin(this.time * 11 + n.x) * 0.18 : 0);
      if (walking)
        g.rotation.y = Math.atan2(
          (b.x - a.x) * (c.waking ? -1 : 1),
          (b.z - a.z) * (c.waking ? -1 : 1),
        );
      else if (Math.hypot(this.state.x - x, this.state.z - z) < 7)
        g.rotation.y = Math.atan2(this.state.x - x, this.state.z - z);
      const entity = this.entities.find(
        (e) => e.id === n.id && e.type === 'npc',
      );
      entity.x = x;
      entity.z = z;
    }
  }
  updateLight() {
    const c = this.cycle,
      light = c.light,
      dark = 1 - THREE.MathUtils.smoothstep(light, 0.05, 0.65);
    this.sun.intensity = 3.4 * light;
    const sunAngle = ((c.hour - 6) / 12) * Math.PI;
    this.sun.position
      .copy(this.focus)
      .add(
        new THREE.Vector3(
          -Math.cos(sunAngle) * 65,
          Math.max(12, Math.sin(sunAngle) * 80),
          30,
        ),
      );
    this.sun.color.setRGB(1, 0.69 + light * 0.22, 0.43 + light * 0.31);
    this.ambient.intensity = 0.32 + light * 1.98;
    this.ambient.color.setRGB(0.42 + light * 0.42, 0.57 + light * 0.37, 1);
    this.moon.intensity = 0.8 * (1 - light);
    this.moon.position.copy(this.focus).add(new THREE.Vector3(30, 60, -30));
    this.moon.target.position.copy(this.focus);
    this.scene.background.setRGB(
      0.07 + light * 0.44,
      0.12 + light * 0.61,
      0.23 + light * 0.51,
    );
    this.scene.fog.color.copy(this.scene.background);
    this.renderer.toneMappingExposure = 1.16 + dark * 0.1;
    this.waterMaterial.uniforms.daylight.value = light;
    this.waterMaterial.uniforms.lightDirection.value
      .copy(light > 0.15 ? this.sun.position : this.moon.position)
      .sub(this.focus)
      .normalize();
    for (const h of this.houses) {
      h.windows.emissiveIntensity = dark * 2;
      h.glow.material.opacity = dark * 0.15;
    }
    const nearest = [...this.houses].sort(
      (a, b) =>
        Math.hypot(a.x - this.focus.x, a.z - this.focus.z) -
        Math.hypot(b.x - this.focus.x, b.z - this.focus.z),
    );
    this.porchLights.forEach((l, i) => {
      const h = nearest[i];
      l.position.set(h.x, ground(h.x, h.z) + 2.5, h.z + 3.3 * h.size);
      l.intensity = dark * 12;
    });
    for (const material of this.pickupMaterials)
      material.emissiveIntensity = dark * 0.36;
  }
  sync() {
    for (const [id, g] of this.pickups)
      g.visible =
        !this.state.gathered.includes(id) && !this.state.notes.includes(id);
    this.lamp.visible = this.state.step >= 19;
    this.beamGroup.visible = this.lamp.visible;
    if (this.fruit) this.fruit.visible = this.state.step === 0;
    this.player?.userData.scarf.material?.color?.set(
      this.state.sidequests.includes('glass') ? 0x76babc : 0xd1614e,
    );
  }
  resize() {
    const w = innerWidth,
      h = innerHeight;
    this.renderer.setSize(w, h);
    this.aspect = w / h;
    this.setFrustum(this.zoom);
  }
  setFrustum(size) {
    this.camera.left = -size * this.aspect;
    this.camera.right = size * this.aspect;
    this.camera.top = size;
    this.camera.bottom = -size;
    this.camera.updateProjectionMatrix();
  }
  walk(dx, dz, dt, sprint) {
    const length = Math.hypot(dx, dz);
    if (!length) return false;
    const speed = (sprint ? 8.3 : 5.5) * dt;
    dx = (dx / length) * speed;
    dz = (dz / length) * speed;
    const s = this.state;
    const oldX = s.x,
      oldZ = s.z;
    const valid = (x, z) =>
      walkable(x, z) &&
      this.colliders.every((c) => Math.hypot(c.x - x, c.z - z) > c.r + 0.48);
    if (valid(s.x + dx, s.z)) s.x += dx;
    if (valid(s.x, s.z + dz)) s.z += dz;
    this.player.rotation.y = Math.atan2(dx, dz);
    return Math.hypot(s.x - oldX, s.z - oldZ) > 0.00001;
  }
  nearest() {
    let best = null,
      d = 4.2;
    for (const e of this.entities) {
      if (e.type === 'npc' && !this.cycle.available) continue;
      if (this.state.notes.includes(e.id) || this.state.gathered.includes(e.id))
        continue;
      const n = Math.hypot(e.x - this.state.x, e.z - this.state.z);
      if (n < d) {
        d = n;
        best = e;
      }
    }
    return best;
  }
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: ((v.x + 1) * innerWidth) / 2,
      y: ((1 - v.y) * innerHeight) / 2,
      visible: v.z < 1,
    };
  }
  clickPoint(clientX, clientY) {
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        (clientX / innerWidth) * 2 - 1,
        (-clientY / innerHeight) * 2 + 1,
      ),
      this.camera,
    );
    const hit = this.raycaster.intersectObject(this.terrain)[0];
    if (hit) this.routeTo(hit.point.x, hit.point.z);
  }
  findRoute(from, x, z, dry = false) {
    const valid = (x, z) =>
        (dry ? land(x, z) : walkable(x, z)) &&
        this.colliders.every((c) => Math.hypot(c.x - x, c.z - z) > c.r + 0.95),
      key = (x, z) => `${x},${z}`;
    const sx = Math.round(from.x / 2) * 2,
      sz = Math.round(from.z / 2) * 2,
      gx = Math.round(x / 2) * 2,
      gz = Math.round(z / 2) * 2;
    if (!valid(gx, gz)) return;
    const start = { x: sx, z: sz, g: 0, f: 0, parent: null },
      open = [start],
      cost = new Map([[key(sx, sz), 0]]);
    let goal = null;
    for (let i = 0; open.length && i < 5000; i++) {
      open.sort((a, b) => b.f - a.f);
      const n = open.pop();
      if (n.x === gx && n.z === gz) {
        goal = n;
        break;
      }
      for (const [dx, dz] of [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
        [2, 2],
        [2, -2],
        [-2, 2],
        [-2, -2],
      ]) {
        const nx = n.x + dx,
          nz = n.z + dz,
          g = n.g + Math.hypot(dx, dz),
          k = key(nx, nz);
        if (
          g >= (cost.get(k) ?? Infinity) ||
          !valid(nx, nz) ||
          !valid(n.x + dx / 2, n.z + dz / 2)
        )
          continue;
        cost.set(k, g);
        open.push({
          x: nx,
          z: nz,
          g,
          f: g + Math.hypot(gx - nx, gz - nz),
          parent: n,
        });
      }
    }
    if (!goal) return;
    const path = [];
    for (let p = goal; p.parent; p = p.parent) path.unshift({ x: p.x, z: p.z });
    return path;
  }
  routeTo(x, z) {
    const path = this.findRoute(this.state, x, z);
    if (!path) return;
    this.route = path;
    this.destination = { x: Math.round(x / 2) * 2, z: Math.round(z / 2) * 2 };
  }
  update(dt, keys, paused, cinematic) {
    this.time += dt;
    const t = this.time,
      s = this.state;
    let moving = false;
    if (!paused) {
      let dx = 0,
        dz = 0;
      const right =
          (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
          (keys.has('a') || keys.has('arrowleft') ? 1 : 0),
        down =
          (keys.has('s') || keys.has('arrowdown') ? 1 : 0) -
          (keys.has('w') || keys.has('arrowup') ? 1 : 0);
      dx = (right + down) * 0.707;
      dz = (down - right) * 0.707;
      if (dx || dz) {
        this.destination = null;
        this.route = [];
      } else if (this.destination) {
        const next = this.route?.[0] || this.destination;
        dx = next.x - s.x;
        dz = next.z - s.z;
        if (Math.hypot(dx, dz) < 0.28) {
          this.route?.shift();
          if (!this.route?.length) this.destination = null;
          dx = dz = 0;
        }
      }
      moving = this.walk(dx, dz, dt, keys.has('shift'));
      if (moving) this.moveTime += dt;
    }
    this.player.position.set(s.x, ground(s.x, s.z), s.z);
    const b = this.player.userData;
    const stride = this.moveTime * (keys.has('shift') ? 13 : 10);
    b.body.position.y = moving
      ? Math.abs(Math.sin(stride)) * 0.095
      : Math.sin(t * 2) * 0.028;
    b.body.rotation.z = moving ? Math.sin(stride) * 0.075 : 0;
    b.left.rotation.x = moving
      ? Math.sin(stride) * 0.32
      : Math.sin(t * 1.2) * 0.025;
    b.right.rotation.x = -b.left.rotation.x;
    b.feet[0].position.z = 0.17 + (moving ? Math.sin(stride) * 0.19 : 0);
    b.feet[1].position.z = 0.17 - (moving ? Math.sin(stride) * 0.19 : 0);
    this.cycle = dayCycle(s.playtime);
    this.updateNeighbours();
    let target = new THREE.Vector3(s.x, ground(s.x, s.z) + 1, s.z),
      zoom = this.zoom,
      offset = new THREE.Vector3(28, 37, 28);
    if (cinematic) {
      target.set(
        cinematic.x,
        ground(cinematic.x, cinematic.z) + cinematic.y,
        cinematic.z,
      );
      zoom = cinematic.zoom;
      const a = cinematic.angle;
      offset.set(Math.sin(a) * 42, 33, Math.cos(a) * 42);
    }
    this.focus.lerp(target, 1 - Math.exp(-dt * (cinematic ? 1.1 : 5)));
    this.setFrustum(
      THREE.MathUtils.lerp(this.camera.top, zoom, 1 - Math.exp(-dt * 2)),
    );
    this.camera.position.copy(this.focus).add(offset);
    this.camera.lookAt(this.focus);
    this.sun.position.copy(this.focus).add(new THREE.Vector3(-45, 80, 35));
    this.sun.target.position.copy(this.focus);
    const current = TRADES[s.step],
      n = current && NPCS.find((n) => n.id === current.npc);
    this.pointer.visible = !!n && !cinematic && this.cycle.available;
    if (n) {
      this.pointer.position.set(
        n.x,
        ground(n.x, n.z) + 3.85 + Math.sin(t * 3) * 0.15,
        n.z,
      );
      this.pointer.rotation.y = t;
    }
    this.marker.visible = !!this.destination && !paused;
    if (this.destination)
      this.marker.position.set(
        this.destination.x,
        ground(this.destination.x, this.destination.z) + 0.08,
        this.destination.z,
      );
    this.waterMaterial.uniforms.time.value = t;
    this.updateLight();
    const depths = waterDepth(s.x, s.z);
    this.wading = depths > 0.015;
    const uniforms = this.waterMaterial.uniforms;
    for (let i = 0; i < 8; i++) uniforms.rippleAge.value[i] += dt;
    if (moving && this.wading && t - this.lastRipple > 0.27) {
      const i = this.rippleIndex++ % 8;
      uniforms.rippleOrigin.value[i].set(s.x, s.z);
      uniforms.rippleAge.value[i] = 0;
      this.lastRipple = t;
    }
    this.boat.rotation.z = Math.sin(t * 0.8) * 0.035;
    this.boat.position.y = 0.1 + Math.sin(t) * 0.09;
    this.beamGroup.rotation.y = t * 0.18;
    this.smokes.forEach((f) => {
      const a = f.userData,
        v = (t * 0.4 + a.phase) % 3;
      f.position.set(a.x + v * 0.35, a.y + v * 1.4, a.z);
      f.scale.setScalar(0.4 + v * 0.35);
      f.material.opacity = 0.13 * (1 - v / 3);
    });
    this.birds.forEach((g, i) => {
      g.visible = !this.cycle.night;
      const a = g.userData,
        phase = t * 0.045 + a.phase;
      g.position.set(
        Math.cos(phase) * a.radius - 30,
        15 + i * 0.7,
        Math.sin(phase) * a.radius + 40,
      );
      g.rotation.y = -phase;
      a.l.rotation.z = Math.sin(t * 4 + i) * 0.2;
      a.r.rotation.z = -a.l.rotation.z;
    });
    this.fishRing.scale.setScalar(1 + Math.sin(t * 2) * 0.12);
    this.renderer.render(this.scene, this.camera);
    return moving;
  }
}
