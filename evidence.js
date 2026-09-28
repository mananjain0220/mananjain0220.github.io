import * as THREE from 'three';
import { palette } from './palette.js?v=palette-1';

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ease = n => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };

export function createEvidence(renderer, pageMap, objectMap) {
  const scene = new THREE.Scene();
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(40, 1, .02, 100);
  scene.add(new THREE.HemisphereLight(0xfffcf6, 0x354354, 1.7));
  const light = new THREE.DirectionalLight(0xfff8ed, 2.3);
  light.position.set(-3.8, 7, 5.4);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  Object.assign(light.shadow.camera, {left: -7, right: 7, top: 7, bottom: -7});
  light.shadow.bias = -.00035;
  scene.add(light);
  const fill = new THREE.DirectionalLight(0xe6edfa, 1.15);
  fill.position.set(4, 4, -3);
  scene.add(fill);
  const matte = (color, more = {}) => new THREE.MeshStandardMaterial({color, roughness: .92, metalness: 0, ...more});
  function box(w, h, d, material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({color:palette.ink, opacity:.18}));
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -.08;
  desk.receiveShadow = true;
  scene.add(desk);

  function sheet(map, curl = .035) {
    const group = new THREE.Group();
    const gauge = box(2.4, .006, 3.105, matte(0xdedfdc), 0, -.022, 0);
    gauge.castShadow = gauge.receiveShadow = false;
    group.add(gauge);
    const geometry = new THREE.PlaneGeometry(2.4, 3.105, 30, 40);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), u = x / 2.4 + .5, v = y / 3.105 + .5;
      const edge = Math.exp(-(((u - .03) / .09) ** 2)) + .65 * Math.exp(-(((u - .98) / .08) ** 2));
      const corner = 1.4 * Math.exp(-(((u - .95) / .17) ** 2) - (((v - .98) / .17) ** 2));
      positions.setZ(i, curl * (edge + corner + .11 * Math.sin(x * 6 + y * 2) + .08 * Math.sin(y * 10)));
    }
    geometry.computeVertexNormals();
    geometry.rotateX(-Math.PI / 2);
    const face = new THREE.Mesh(geometry, matte(map ? 0xffffff : palette.paper, {map: map || null, side: THREE.DoubleSide}));
    face.castShadow = true;
    group.add(face);
    scene.add(group);
    return group;
  }
  function opacity(group, value) {
    group.visible = value > .004;
    group.traverse(part => {
      if (!part.isMesh) return;
      part.material.transparent = value < .995;
      part.material.opacity = value;
      part.material.depthWrite = value > .95;
    });
  }
  function evaluationMap() {
    const surface = document.createElement('canvas');
    surface.width = 1400; surface.height = 1812;
    const c = surface.getContext('2d');
    c.fillStyle = palette.paper; c.fillRect(0, 0, 1400, 1812);
    const text = (value, y, font, color = palette.ink) => {
      c.fillStyle = color; c.font = font; c.fillText(value, 95, y);
    };
    const rule = y => { c.fillStyle = palette.line; c.fillRect(95, y, 1210, 2); };
    text('EVALUATION NOTE  /  03', 108, 'bold 32px Arial');
    rule(145);
    text('What can we', 305, '96px Georgia');
    text('infer?', 418, 'italic 96px Georgia');
    c.fillStyle = palette.accent; c.fillRect(95, 470, 110, 7);
    text('01 / DETECTION', 615, 'bold 32px Arial', palette.accent);
    text('Is a signal present?', 702, '57px Georgia');
    text('Compare observations with a measured baseline.', 769, '35px Georgia');
    rule(840);
    text('02 / ATTRIBUTION', 948, 'bold 32px Arial', palette.accent);
    text('What could explain it?', 1035, '57px Georgia');
    text('Test competing sources and likely failure cases.', 1102, '35px Georgia');
    rule(1173);
    text('One page is a specimen,', 1328, 'italic 45px Georgia');
    text('not evidence of a working detector.', 1390, 'italic 45px Georgia');
    text('SYNTHETIC FILE  /  NO MODEL RUN', 1555, '28px Courier New', palette.muted);
    rule(1690);
    text('DETECTION  →  ATTRIBUTION  →  EVALUATION', 1750, 'bold 27px Arial');
    const map = new THREE.CanvasTexture(surface);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    return map;
  }
  const paper = sheet(pageMap, .039);
  const under = [sheet(null, .009), sheet(null, .011)];
  const backing = box(2.57, .07, 3.26, matte(palette.screen, {transparent: true}), .42, 0, -.1);
  scene.add(backing);
  const film = new THREE.Group();
  film.add(box(2.43, .012, 3.13, matte(0xe8ecf2, {transparent: true, opacity: .87, side: THREE.DoubleSide})));
  const ink = new THREE.Mesh(new THREE.PlaneGeometry(2.41, 3.11), new THREE.MeshBasicMaterial({
    map: objectMap, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  ink.rotation.x = -Math.PI / 2;
  ink.position.y = .008;
  film.add(ink);
  scene.add(film);
  const posts = [];
  for (const dx of [-1.06, 1.06]) for (const dz of [-1.33, 1.33]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.017, .017, .42, 16),
      matte(0xa4acb8, {roughness: .44, metalness: .52, transparent: true}));
    post.position.set(.42 + dx, .26, -.1 + dz);
    post.castShadow = true;
    scene.add(post); posts.push(post);
  }
  const evaluation = sheet(evaluationMap(), .012);
  const specimens = [paper, film, evaluation];
  let highlighted = -1;
  const brackets = specimens.map(group => {
    const vertices = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * 1.22, z = sz * 1.57, y = .072;
      vertices.push(x - sx * .19, y, z, x, y, z, x, y, z, x, y, z - sz * .19);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color:palette.accent, transparent:true, opacity:.3, depthTest:false}));
    line.renderOrder = 5;
    group.add(line);
    return line;
  });
  const normalPosition = new THREE.Vector3(), normalFocus = new THREE.Vector3();
  const nearPosition = new THREE.Vector3(.4, 5.4, 3.5), nearFocus = new THREE.Vector3(0, .14, 0);

  function update(depth, yaw, tilt, aspect, reveal = 1, layout = {}) {
    const a = ease(depth), b = ease(depth - 1);
    paper.position.set(lerp(-1.55 * a, -6.1, b), lerp(.11 + 1.17 * a, 1.6, b), lerp(-1.72 * a, -3.2, b));
    paper.rotation.set(0, -.07 - .07 * a - .08 * b, -.035 * a);
    paper.visible = b < .95;
    under.forEach((s, i) => {
      s.position.copy(paper.position);
      s.position.y -= .045 - i * .012;
      s.rotation.copy(paper.rotation);
      s.visible = paper.visible;
    });
    backing.visible = true;
    backing.position.set(.42 * a, -.025 * (1 - a), -.1 * a);
    backing.material.opacity = 1;
    backing.material.depthWrite = true;
    film.position.set(lerp(.42, -5.5, b), lerp(.44, 1.04, b), lerp(-.1, -1.42, b));
    film.rotation.y = -.12 * b;
    film.children[0].material.opacity = .87 * a;
    ink.material.opacity = a;
    film.visible = a > .006 && b < .999;
    posts.forEach(post => { post.visible = a > .02; post.material.opacity = a * (1 - .35 * b); });
    evaluation.position.set(lerp(1.42, .42, b), .11, lerp(.43, -.1, b));
    evaluation.rotation.y = lerp(-.12, -.018, b);
    opacity(evaluation, b);
    const fitAspect = layout.fitAspect || aspect;
    const base = fitAspect < .75 ? 7.5 : fitAspect < 1 ? 6.7 : 6.1;
    const distance = base + 1.9 * a - 2.25 * b;
    const x = lerp(-.30 * a, .28, b), z = lerp(-.1 - .24 * a, -.1, b);
    normalPosition.set(x + Math.sin(yaw) * distance * .54, distance * .90 + tilt, z + Math.cos(yaw) * distance * .76);
    normalFocus.set(x, .14 + .13 * a, z);
    camera.aspect = aspect;
    camera.fov = fitAspect < .9 ? 42 : 40;
    camera.position.lerpVectors(nearPosition, normalPosition, reveal);
    camera.lookAt(new THREE.Vector3().lerpVectors(nearFocus, normalFocus, reveal));
    camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[8] -= layout.shift || 0;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const active = Math.round(depth);
    brackets.forEach((line, index) => {
      line.visible = index === active && reveal > .94;
      line.material.opacity = highlighted === index ? .95 : .24;
    });
  }
  return {
    scene, camera, update,
    highlight(index) { highlighted = index; },
    anchor(index) {
      const specimen = specimens[index];
      if (!specimen?.visible) return null;
      specimen.updateWorldMatrix(true, false);
      return specimen.localToWorld(new THREE.Vector3(-1.08, .09, -.27));
    },
  };
}
