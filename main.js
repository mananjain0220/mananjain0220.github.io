import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { makeLaptopMark, makeContactShadow } from './textures.js';
import { createEvidence } from './evidence.js?v=palette-1';
import { panels, workAreas, workOrder, screenLayout, screenActionAt } from './profile.js?v=workspace-1';
import { drawWorkspacePreview, drawWorkspaceSticker } from './workspace-art.js?v=palette-1';
import { springStep, nearestAngle, releaseTravel, portalState } from './motion.js';
import { createSceneTransition } from './transition.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#scene'), world = $('#world'), home = $('#home'), story = $('#case-story');
const chapters = [...document.querySelectorAll('.chapter')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let manualReduced = false;
const motionReduced = () => reduced.matches || manualReduced;
const clamp = THREE.MathUtils.clamp;
const ease = t => { const n = clamp(t, 0, 1); return n * n * (3 - 2 * n); };
const labels = ['SURFACE', 'ANALYSIS REPORT', 'INFERENCE'];
let engine = null, mode = 'home', transition = null, pushedCase = false, queuedCase = location.hash === '#case';
let depth = 0, targetDepth = 0, evidenceYaw = .35, goalEvidenceYaw = .35, evidenceTilt = 0, goalEvidenceTilt = 0;
let orbit = .42, goalOrbit = .42, polar = 1.18, goalPolar = 1.18;
let drag = null, dirty = true, previousTime = 0, frame = 0, presses = [], hoverAction = '';
let lastFocus = null, pendingRoute = null;
let scrollReveal = 1, scrollReturnArmed = false, completedAt = 0;
let artifactFocus = -1;
let requestedStage = null;
let selectedWork = 'research';
let panelClosing = false, panelAnimation = null, previewTransition = null;
let pointerX = 0, pointerY = 0;
const motion = Object.fromEntries(Object.entries({yaw:.42, pitch:1.18, parallaxX:0, parallaxY:0, panel:0, arrival:1}).map(([key,value]) => [key,{value,velocity:0}]));
const homeCanvasLabel = canvas.getAttribute('aria-label');
const targetHome = new THREE.Vector3(0, 1.6, 0);
const homePosition = new THREE.Vector3(), portalPosition = new THREE.Vector3(), portalFocus = new THREE.Vector3();
const tooltip = $('#tooltip');
const annotation = $('#annotation-link');
const artifactButtons = [...document.querySelectorAll('[data-artifact]')];

// Annotation endpoints are projected from the real 3D objects, so the
// relationship survives orbiting, scrolling and responsive camera changes.
function updateAnnotation() {
  const hidden = !engine || mode === 'transition' || $('#details').open || (mode === 'case' && scrollReveal < .985) || (mode === 'home' && Math.abs(Math.cos(orbit)) < .25);
  annotation.toggleAttribute('hidden', hidden);
  if (hidden) return;
  const active = Math.round(depth);
  const source = mode === 'home' ? $(`.work-entry[data-panel="${selectedWork}"] .work-arrow`) : artifactButtons[active].querySelector('.anchor-dot');
  const sourceRect = source.getBoundingClientRect();
  const camera = mode === 'home' ? engine.camera : engine.evidence.camera;
  const back = Math.cos(orbit) < 0;
  const point = mode === 'home' ? back
    ? engine.stickers.find(sticker => sticker.userData.action === selectedWork).localToWorld(new THREE.Vector3())
    : engine.display.localToWorld(new THREE.Vector3((screenLayout.anchor.x / screenLayout.width - .5) * .297, (.5 - screenLayout.anchor.y / screenLayout.height) * .1925, .0001))
    : engine.evidence.anchor(active);
  if (!point || sourceRect.bottom < 85 || sourceRect.top > innerHeight - 65) { annotation.setAttribute('hidden', ''); return; }
  point.project(camera);
  const rect = canvas.getBoundingClientRect();
  const endX = rect.left + (point.x + 1) * rect.width / 2;
  const endY = rect.top + (1 - point.y) * rect.height / 2;
  if (point.z < -1 || point.z > 1 || endX < 0 || endX > innerWidth || endY < rect.top + 15 || endY > rect.bottom - 45) { annotation.setAttribute('hidden', ''); return; }
  const startX = sourceRect.right + (mode === 'home' ? 12 : 4);
  const startY = sourceRect.top + sourceRect.height / 2;
  const copyRect = source.closest('.home-copy, .chapter-copy').getBoundingClientRect();
  const gutter = Math.min(endX - 35, Math.max(startX + 24, copyRect.right + 24));
  const reach = Math.max(28, Math.min(85, (endX - gutter) * .4));
  annotation.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
  $('#annotation-path').setAttribute('d', `M ${startX} ${startY} L ${gutter} ${startY} C ${gutter + reach} ${startY}, ${endX - reach} ${endY}, ${endX} ${endY}`);
  for (const id of ['#annotation-ring', '#annotation-dot']) {
    $(id).setAttribute('cx', endX); $(id).setAttribute('cy', endY);
  }
  annotation.classList.toggle('is-focused', artifactFocus === active && mode === 'case');
}
function focusArtifact(index) {
  artifactFocus = index;
  engine?.evidence.highlight(index);
  dirty = true;
}
artifactButtons.forEach((button, index) => {
  button.addEventListener('pointerenter', () => focusArtifact(index));
  button.addEventListener('pointerleave', () => focusArtifact(document.activeElement === button ? index : -1));
  button.addEventListener('focus', () => focusArtifact(index));
  button.addEventListener('blur', () => focusArtifact(-1));
  button.addEventListener('click', () => {
    if (mode !== 'case') return;
    focusArtifact(index);
    goalEvidenceYaw = .35; goalEvidenceTilt = 0;
    if (Math.abs(targetDepth - index) > .15) {
      requestedStage = index;
      chapters[index].scrollIntoView({behavior:motionReduced() ? 'instant' : 'smooth', block:'start'});
    }
    $('#status').textContent = button.textContent.trim() + ' highlighted in the 3D view.';
  });
});

function updateUI(inCase) {
  home.hidden = inCase;
  story.hidden = !inCase;
  $('#layer-nav').hidden = !inCase;
  $('#view-controls').hidden = inCase;
  $('.profile-links').hidden = inCase;
  $('#header-context').textContent = inCase ? 'CASE 01 / DOCUMENT SIGNALS' : 'RESEARCH ASSOCIATE';
  canvas.setAttribute('aria-label', inCase
    ? 'Three-dimensional document layers. Scroll to explore. Scroll back above the first layer or past the final layer to return to the laptop. Escape also returns. Drag or use arrow keys to rotate.'
    : homeCanvasLabel);
  $('#preview-description').hidden = inCase;
  if (inCase) canvas.removeAttribute('aria-describedby');
  else canvas.setAttribute('aria-describedby', 'preview-description');
  $('#scene-hint').textContent = inCase ? 'Scroll through the layers'
    : Math.cos(orbit) < 0 ? 'Three stickers · three areas of work' : 'Drag to turn · click the preview to explore';
  $('#scene-label').textContent = inCase ? 'CASE 01 / SURFACE' : 'THE WORKSPACE';
  $('#scene-number').textContent = inCase ? '01' : '00';
  $('#layer-nav').style.setProperty('--case-progress', '0%');
}

function finishTransition(inCase) {
  requestedStage = null;
  mode = inCase ? 'case' : 'home';
  document.body.dataset.mode = mode;
  document.body.dataset.rewinding = 'false';
  scrollReveal = 1;
  scrollReturnArmed = inCase;
  updateUI(inCase);
  $('#transition-veil').style.opacity = '0';
  transition = null;
  dirty = true;
  if (inCase) {
    updateScroll();
    $('#surface-title').focus({preventScroll: true});
    $('#status').textContent = 'Case opened. Scroll through the layers. Scrolling above the first layer or past the last returns to the laptop.';
  } else {
    (canvas.hidden ? $('#read-case') : canvas).focus({preventScroll: true});
    $('#status').textContent = 'Returned to the laptop.';
    completedAt = performance.now();
  }
  if (pendingRoute !== null) {
    const route = pendingRoute; pendingRoute = null;
    if (route !== inCase) queueMicrotask(() => changeMode(route, false));
  }
}

function changeMode(inCase, updateHistory = true) {
  if (mode === 'transition' || (inCase && mode === 'case') || (!inCase && mode === 'home')) return;
  if (updateHistory) {
    if (inCase) {
      history.pushState({workspaceCase: true}, '', '#case');
      pushedCase = true;
    } else {
      history.replaceState({}, '', location.pathname + location.search);
      pushedCase = false;
    }
  }
  tooltip.hidden = true;
  annotation.setAttribute('hidden', '');
  focusArtifact(-1);
  drag = null;
  hoverAction = '';
  canvas.classList.remove('is-action');
  $('#view-controls').hidden = true;
  $('#layer-nav').hidden = true;
  scrollReturnArmed = false;
  document.body.dataset.rewinding = 'false';
  if (inCase) {
    goalOrbit = nearestAngle(orbit, .42);
    goalPolar = 1.18;
  }
  const fromDepth = depth;
  mode = 'transition';
  document.body.dataset.mode = mode;
  pointerX = pointerY = 0;
  if (engine && !motionReduced()) {
    transition = {inCase, start: performance.now(), duration: 1450, swapped: false, fromDepth};
  } else {
    depth = targetDepth = 0;
    updateUI(inCase);
    window.scrollTo({top: inCase ? $('#entry-runway').offsetHeight : 0, behavior: 'instant'});
    finishTransition(inCase);
  }
}

function returnToLaptop() {
  if (mode !== 'case') return;
  if (pushedCase && history.state?.workspaceCase) history.back();
  else changeMode(false);
}
addEventListener('popstate', () => {
  pushedCase = false;
  const inCase = location.hash === '#case';
  if (mode === 'transition') pendingRoute = inCase;
  else if (mode === 'home' && !inCase) window.scrollTo({top:0,behavior:'instant'});
  else changeMode(inCase, false);
});
$('#read-case').addEventListener('click', () => changeMode(true));

function updateScroll(allowReturn = false) {
  if (mode !== 'case') return;
  const top = innerWidth <= 760 ? world.getBoundingClientRect().bottom : 76;
  const distance = Math.max(1, $('#entry-runway').offsetHeight);
  const exitOffset = $('#exit-runway').getBoundingClientRect().top - top;
  // Both ends of the investigation have a native scroll runway. The camera
  // follows that scroll position; wheel/touch events are never intercepted.
  scrollReveal = Math.min(clamp(scrollY / distance, 0, 1), clamp(1 + exitOffset / distance, 0, 1));
  const rewinding = scrollReveal < .999;
  document.body.dataset.rewinding = String(rewinding);
  $('#layer-nav').hidden = rewinding;
  if (allowReturn && scrollReturnArmed && scrollReveal <= .003) {
    // The view has already unwound. Pop only an entry created by this page;
    // direct case links use replaceState so return cannot leave the site.
    scrollReturnArmed = false;
    const ownsEntry = pushedCase && history.state?.workspaceCase;
    pushedCase = false;
    depth = targetDepth = 0;
    finishTransition(false);
    window.scrollTo({top: 0, behavior: 'instant'});
    if (ownsEntry) history.back();
    else history.replaceState({}, '', location.pathname + location.search);
    return;
  }
  const offsets = chapters.map(chapter => chapter.getBoundingClientRect().top - top);
  targetDepth = offsets[0] >= 0 ? 0 : offsets[2] <= 0 ? 2
    : offsets[1] > 0 ? -offsets[0] / (offsets[1] - offsets[0])
      : 1 - offsets[1] / (offsets[2] - offsets[1]);
  if (requestedStage !== null && Math.abs(targetDepth - requestedStage) < .02) requestedStage = null;
  const active = Math.round(targetDepth);
  $('#layer-nav').style.setProperty('--case-progress', `${targetDepth / 2 * 100}%`);
  $('#scene-hint').textContent = rewinding ? 'Returning to the laptop'
    : active === 2 ? 'Scroll on to return to the laptop' : 'Scroll through the layers';
  $('#scene-label').textContent = 'CASE 01 / ' + labels[active];
  $('#scene-number').textContent = '0' + (active + 1);
  $('#layer-nav').querySelectorAll('button').forEach((button, index) => {
    if (index === active) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  dirty = true;
}
addEventListener('scroll', () => { updateScroll(true); dirty = true; }, {passive: true});
// Expanded report groups change chapter heights. Recalculate scene progress
// without treating a layout change as a user request to leave the case.
document.querySelectorAll('.finding-group').forEach(group => group.addEventListener('toggle', () => {
  updateScroll(); dirty = true;
}));
document.querySelectorAll('[data-step-to]').forEach(button => button.addEventListener('click', () => {
  requestedStage = Number(button.dataset.stepTo);
  chapters[requestedStage].scrollIntoView({behavior: motionReduced() ? 'instant' : 'smooth', block: 'start'});
}));

function selectWork(id) {
  if (!workAreas[id]) return;
  const changed = selectedWork !== id;
  selectedWork = id;
  document.querySelectorAll('.work-entry').forEach(button => button.classList.toggle('is-selected', button.dataset.panel === id));
  canvas.dataset.preview = id;
  $('#preview-description').textContent = workAreas[id].preview.description;
  if (engine && (changed || !engine.previewReady)) {
    const animate = engine.previewReady && !motionReduced();
    if (animate) {
      // Snapshot the visible blend, so quick selections never flash an older
      // preview. All artwork is local and only redrawn when selection changes.
      paintScreen();
      engine.previousContext.drawImage(engine.screenCanvas, 0, 0);
    }
    drawWorkspacePreview(engine.previewContext, id);
    engine.previewReady = true;
    previewTransition = animate ? {start:performance.now()} : null;
    paintScreen();
  }
  dirty = true;
}
function openPanel(id) {
  const data = panels[id];
  if (!data || mode !== 'home' || panelClosing) return;
  const wasOpen = $('#details').open;
  selectWork(id);
  if (!wasOpen) lastFocus = document.activeElement;
  if (workAreas[id] && !wasOpen) setView('front');
  $('#detail-kicker').textContent = data.kicker;
  $('#detail-title').textContent = data.title;
  const body = $('#detail-body');
  body.replaceChildren();
  if (data.text) {
    const p = document.createElement('p'); p.textContent = data.text;
    body.append(p);
  }
  for (const entry of data.entries || []) {
    const section = document.createElement('section'); section.className = 'detail-entry';
    const title = document.createElement('h3'); title.textContent = entry.title;
    const p = document.createElement('p'); p.textContent = entry.text;
    section.append(title, p); body.append(section);
  }
  if (data.items) {
    const ul = document.createElement('ul');
    data.items.forEach(text => { const li = document.createElement('li'); li.textContent = text; ul.append(li); });
    body.append(ul);
  }
  if (data.note) {
    const p = document.createElement('p'); p.className = 'detail-note'; p.textContent = data.note; body.append(p);
  }
  if (data.caseAction) {
    const button = document.createElement('button'); button.className = 'primary case-action';
    button.textContent = data.caseAction + ' ↗';
    button.addEventListener('click', () => closePanel(() => changeMode(true)));
    body.append(button);
  }
  if (data.links) {
    const links = document.createElement('div'); links.className = 'detail-links';
    for (const link of data.links) {
      const a = document.createElement('a');
      a.href = link.href; a.textContent = link.label; a.target = '_blank'; a.rel = 'noopener noreferrer';
      links.append(a);
    }
    body.append(links);
  }
  const nav = $('#detail-nav'); nav.replaceChildren(); nav.hidden = !workAreas[id];
  if (workAreas[id]) {
    const index = workOrder.indexOf(id);
    for (const [offset, arrow] of [[-1, '←'], [1, '→']]) {
      const next = workOrder[(index + offset + workOrder.length) % workOrder.length];
      const button = document.createElement('button');
      button.textContent = offset < 0 ? `${arrow} Previous` : `Next ${arrow}`;
      button.setAttribute('aria-label', `${offset < 0 ? 'Previous' : 'Next'}: ${workAreas[next].title}`);
      button.addEventListener('click', () => openPanel(next)); nav.append(button);
    }
  }
  tooltip.hidden = true;
  document.body.dataset.panelOpen = 'true';
  pointerX = pointerY = 0;
  panelAnimation?.cancel();
  if (!wasOpen) {
    $('#details').showModal();
    if (!motionReduced()) panelAnimation = $('#details').animate([
      {opacity:0,transform:innerWidth <= 760 ? 'translateY(32px)' : 'translateX(-24px)'},
      {opacity:1,transform:'translate(0,0)'},
    ], {duration:420,easing:'cubic-bezier(.2,.8,.2,1)'});
  } else {
    $('#details').scrollTop = 0;
    if (!motionReduced()) panelAnimation = $('#detail-content').animate([
      {opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'},
    ], {duration:300,easing:'cubic-bezier(.2,.8,.2,1)'});
    $('#detail-title').focus({preventScroll:true});
  }
  dirty = true;
}
function closePanel(afterClose) {
  if (!$('#details').open || panelClosing) return;
  panelClosing = true;
  panelAnimation?.cancel();
  document.body.dataset.panelOpen = 'closing';
  const complete = () => {
    $('#details').close(); panelClosing = false;
    document.body.dataset.panelOpen = 'false';
    dirty = true;
    afterClose?.();
  };
  if (motionReduced()) { complete(); return; }
  panelAnimation = $('#details').animate([
    {opacity:1,transform:'translate(0,0)'},
    {opacity:0,transform:innerWidth <= 760 ? 'translateY(24px)' : 'translateX(-18px)'},
  ], {duration:220,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
  panelAnimation.finished.then(() => { panelAnimation.cancel(); complete(); }).catch(complete);
}
document.querySelectorAll('[data-panel]').forEach(button => {
  button.addEventListener('click', () => openPanel(button.dataset.panel));
  button.addEventListener('pointerenter', () => { if (mode === 'home' && !$('#details').open) selectWork(button.dataset.panel); });
  button.addEventListener('focus', () => { if (mode === 'home' && !$('#details').open) selectWork(button.dataset.panel); });
});
$('#close-details').addEventListener('click', () => closePanel());
$('#details').addEventListener('cancel', event => { event.preventDefault(); closePanel(); });
$('#details').addEventListener('close', () => {
  if (mode !== 'home') return;
  const target = lastFocus?.matches('.work-entry') ? $(`.work-entry[data-panel="${selectedWork}"]`) : lastFocus;
  target?.focus({preventScroll:true});
});
$('#details').addEventListener('click', event => {
  if (event.target !== $('#details')) return;
  const rect = $('#details').getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePanel();
});

function paintScreen(time = performance.now()) {
  const c = engine.screenContext;
  const p = previewTransition && !motionReduced() ? ease((time-previewTransition.start)/360) : 1;
  c.globalAlpha = 1;
  if (p < 1) {
    c.drawImage(engine.previousPreview,0,0);
    c.globalAlpha = p;
  } else {
    previewTransition = null;
  }
  c.drawImage(engine.previewCanvas,0,0);
  c.globalAlpha = 1;
  engine.screenTexture.needsUpdate = true;
  dirty = true;
}

async function setup() {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha:true, powerPreference: 'high-performance'});
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const loader = new THREE.TextureLoader();
  const [gltf, page, objectMap] = await Promise.all([
    new GLTFLoader().loadAsync('./assets/macbook.glb'),
    loader.loadAsync('./assets/specimen-page.png'),
    loader.loadAsync('./assets/structure-overlay.png'),
  ]);
  [page, objectMap].forEach(map => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  });
  const scene = new THREE.Scene(); scene.background = null;
  const camera = new THREE.PerspectiveCamera(36, 1, .03, 150);
  scene.add(new THREE.HemisphereLight(0xfffcf6, 0x414b59, 1.6));
  const key = new THREE.DirectionalLight(0xfff9f0, 2.1);
  key.position.set(-6, 12, 9); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {left: -9, right: 9, top: 9, bottom: -9});
  key.shadow.normalBias = .018; key.shadow.bias = -.0003; key.shadow.radius = 4; scene.add(key);
  const rim = new THREE.DirectionalLight(0xe7eff5, 1.2); rim.position.set(7, 7, -5); scene.add(rim);
  const env = document.createElement('canvas'); env.width = 512; env.height = 256;
  const ec = env.getContext('2d');
  ec.fillStyle = '#979ca4'; ec.fillRect(0, 0, 512, 256);
  ec.filter = 'blur(22px)'; ec.fillStyle = '#faf9f6'; ec.fillRect(40, 20, 190, 85); ec.fillRect(340, 30, 120, 90);
  const environment = new THREE.CanvasTexture(env); environment.colorSpace = THREE.SRGBColorSpace;
  environment.mapping = THREE.EquirectangularReflectionMapping; scene.environment = environment; scene.environmentIntensity = .95;
  const model = gltf.scene; model.scale.setScalar(20); scene.add(model);
  let hinge = null;
  model.traverse(object => {
    if (/HINGE.*PIVOT/.test(object.name)) hinge = object;
    if (!object.isMesh) return;
    object.castShadow = true; object.receiveShadow = true;
    if (/Satin/.test(object.material?.name)) object.material.roughness = .43;
    if (/DISPLAY.*(cursor|line|prompt|top_menu|live-texture)/.test(object.name)) object.visible = false;
    if (/^KEY/.test(object.name)) object.userData = {...object.userData, action: /return/.test(object.name) ? 'selected-work' : 'key', restY: object.position.y};
  });
  model.traverse(object => {
    if (!/^LEGEND/.test(object.name)) return;
    const keycap = model.getObjectByName(object.name.replace(/^LEGEND/, 'KEY'));
    if (!keycap) return;
    object.userData = {...object.userData, action: keycap.userData.action, keyTarget: keycap, restY: object.position.y};
    keycap.userData.legend = object;
  });
  if (!hinge) throw new Error('The local model has no display hinge.');
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 1536; screenCanvas.height = 996;
  const previewCanvas = screenCanvas.cloneNode(), previousPreview = screenCanvas.cloneNode();
  const screenTexture = new THREE.CanvasTexture(screenCanvas); screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(.297, .1925), new THREE.MeshBasicMaterial({map: screenTexture, toneMapped: false}));
  display.position.set(0, .1045, .00287); display.userData = {action: 'screen'}; hinge.add(display);
  const stickers = [];
  for (const [action, x, y, size, angle] of [
    ['ml', -.095, .156, .057, -.10],
    ['engineering', .092, .067, .070, .12],
    ['research', .027, .169, .074, -.07],
  ]) {
    const art = document.createElement('canvas'); art.width = art.height = 768;
    drawWorkspaceSticker(art.getContext('2d'), action);
    const map = new THREE.CanvasTexture(art); map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({map, transparent:true, alphaTest:.1, depthWrite:false, roughness:.95, metalness:0, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1}));
    sticker.position.set(x, y, -.00243); sticker.rotation.set(0, Math.PI, angle);
    sticker.userData = {action, label: workAreas[action].title + ' ↗', sticker: true, restAngle:angle, emphasis:{value:0,velocity:0}}; hinge.add(sticker); stickers.push(sticker);
  }
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(.055, .055), new THREE.MeshBasicMaterial({map: makeLaptopMark(), transparent: true, depthWrite: false}));
  mark.position.set(-.012, .095, -.00244); mark.rotation.y = Math.PI; hinge.add(mark);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.ShadowMaterial({color:0x202a35, opacity:.10}));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.052; floor.receiveShadow = true; scene.add(floor);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(8, 5.8), new THREE.MeshBasicMaterial({map: makeContactShadow(), transparent: true, depthWrite: false, opacity: .48}));
  contact.rotation.x = -Math.PI / 2; contact.position.y = -.05; scene.add(contact);
  engine = {renderer, scene, camera, model, hinge, display, page, stickers, screenTexture, screenCanvas, screenContext:screenCanvas.getContext('2d'), previewCanvas, previewContext:previewCanvas.getContext('2d'), previousPreview, previousContext:previousPreview.getContext('2d'), previewReady:false, evidence:createEvidence(renderer,page,objectMap), compositor:createSceneTransition(renderer)};
  document.body.dataset.ready = 'true';
  selectWork(selectedWork);
  new ResizeObserver(resize).observe(world);
  resize();
  updateUI(mode === 'case');
  if (queuedCase) { queuedCase = false; changeMode(true, false); }
  frame = requestAnimationFrame(tick);
}

function resize() {
  if (!engine) return;
  const width = Math.max(1, world.clientWidth), height = Math.max(1, world.clientHeight);
  const preserveDepth = requestedStage ?? targetDepth;
  const changed = engine.layout && (Math.abs(engine.layout.width - width) > 1 || Math.abs(engine.layout.height - height) > 1);
  engine.renderer.setSize(width, height, false);
  engine.compositor.resize(width, height);
  engine.camera.aspect = width / height;
  engine.layout = {width, height, fitAspect:width * (innerWidth <= 760 ? 1 : .59) / height, shift:innerWidth <= 760 ? 0 : .36};
  engine.camera.updateProjectionMatrix();
  engine.camera.projectionMatrix.elements[8] -= engine.layout.shift;
  engine.camera.projectionMatrixInverse.copy(engine.camera.projectionMatrix).invert();
  if (changed && mode === 'case' && scrollReveal >= .999) {
    const inset = innerWidth <= 760 ? world.getBoundingClientRect().bottom : 76;
    const offsets = chapters.map(chapter => chapter.getBoundingClientRect().top + scrollY - inset);
    const lower = Math.floor(preserveDepth), upper = Math.min(2, lower + 1);
    const top = THREE.MathUtils.lerp(offsets[lower], offsets[upper], preserveDepth - lower);
    window.scrollTo({top, behavior:'instant'});
  }
  updateScroll(); dirty = true;
}

function homeCamera() {
  const camera = engine.camera;
  camera.projectionMatrix.elements[8] = -engine.layout.shift - (innerWidth > 760 ? motion.panel.value * .03 : 0);
  camera.projectionMatrix.elements[9] = innerWidth <= 760 ? -.12 : -.08;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  const fit = 8.7 / (2 * Math.tan(THREE.MathUtils.degToRad(18)) * engine.layout.fitAspect);
  const radius = Math.max(innerWidth <= 760 ? 14.3 : 13.1, fit) * (1 + motion.arrival.value * .07 - motion.panel.value * .025);
  const viewYaw = orbit + motion.parallaxX.value + motion.arrival.value * .12;
  const viewPolar = polar + motion.parallaxY.value;
  homePosition.set(radius * Math.sin(viewPolar) * Math.sin(viewYaw),
    targetHome.y + radius * Math.cos(viewPolar), radius * Math.sin(viewPolar) * Math.cos(viewYaw));
  engine.hinge.updateWorldMatrix(true, false);
  portalFocus.copy(engine.hinge.localToWorld(new THREE.Vector3(0, .113, .0029)));
  const normal = new THREE.Vector3(0, 0, 1).transformDirection(engine.hinge.matrixWorld);
  portalPosition.copy(portalFocus).addScaledVector(normal, 7.5);
  camera.position.copy(homePosition); camera.lookAt(targetHome);
}

function tick(time) {
  frame = requestAnimationFrame(tick);
  if (document.hidden || !engine) { previousTime = time; return; }
  const dt = Math.min((time - previousTime) / 1000 || .016, .05); previousTime = time;
  const immediate = motionReduced(), k = immediate ? 1 : 1 - Math.exp(-10 * dt);
  let changing = Math.abs(depth - targetDepth)
    + Math.abs(evidenceYaw - goalEvidenceYaw) + Math.abs(evidenceTilt - goalEvidenceTilt) > .0002;
  const targets = {yaw:goalOrbit,pitch:goalPolar,parallaxX:pointerX,parallaxY:pointerY,panel:$('#details').open && !panelClosing ? 1 : 0,arrival:0};
  for (const [key,target] of Object.entries(targets)) {
    const before = motion[key].value;
    const active = springStep(motion[key], target, dt, key === 'yaw' || key === 'pitch' ? (drag ? 22 : 10) : 13, immediate);
    changing = changing || active || Math.abs(before - motion[key].value) > .00001;
  }
  if (previewTransition) paintScreen(time);
  orbit = motion.yaw.value; polar = motion.pitch.value;
  for (const sticker of engine.stickers) {
    const target = sticker.userData.action === selectedWork && Math.cos(orbit) < 0 ? 1 : 0;
    const active = springStep(sticker.userData.emphasis, target, dt, 15, immediate);
    changing = changing || active;
    const value = sticker.userData.emphasis.value;
    sticker.position.z = -.00243 - value * .00065;
    sticker.scale.setScalar(1 + value * .055);
    sticker.rotation.z = sticker.userData.restAngle + value * .025;
  }
  depth += (targetDepth - depth) * k; evidenceYaw += (goalEvidenceYaw - evidenceYaw) * k; evidenceTilt += (goalEvidenceTilt - evidenceTilt) * k;
  const hadPresses = presses.length > 0;
  presses = presses.filter(({mesh, start}) => {
    const t = clamp((time - start) / 220, 0, 1);
    mesh.position.y = mesh.userData.restY - Math.sin(t * Math.PI) * .0008;
    return t < 1;
  });
  if (!dirty && !changing && !transition && !hadPresses) return;
  homeCamera();
  let progress = mode === 'case' ? (immediate ? 1 : scrollReveal) : 0;
  if (transition) {
    const t = clamp((time - transition.start) / transition.duration, 0, 1);
    progress = transition.inCase ? t : 1 - t;
    if (!transition.inCase) depth = transition.fromDepth * ease(progress);
    if (t >= .5 && !transition.swapped) {
      transition.swapped = true;
      updateUI(transition.inCase);
      $('#layer-nav').hidden = true; $('#view-controls').hidden = true;
      window.scrollTo({top: transition.inCase ? $('#entry-runway').offsetHeight : 0, behavior: 'instant'});
      if (transition.inCase) depth = targetDepth = 0;
    }
    if (t === 1) finishTransition(transition.inCase);
  }
  const {blend,zoom,reveal} = portalState(progress);
  if (progress > 0 && progress < 1) {
    engine.camera.position.lerpVectors(homePosition, portalPosition, zoom);
    engine.camera.lookAt(new THREE.Vector3().lerpVectors(targetHome, portalFocus, zoom));
  }
  if (blend > 0) {
    const visualDepth = mode === 'case' ? depth * ease(scrollReveal) : depth;
    engine.evidence.update(visualDepth, evidenceYaw, evidenceTilt, engine.camera.aspect, reveal, engine.layout);
  }
  if (blend > 0 && blend < 1) engine.compositor.render(engine.scene, engine.camera, engine.evidence.scene, engine.evidence.camera, blend);
  else if (blend === 1) engine.renderer.render(engine.evidence.scene, engine.evidence.camera);
  else engine.renderer.render(engine.scene, engine.camera);
  updateAnnotation();
  dirty = false;
}

const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
function hit(event) {
  if (!engine || mode !== 'home') return null;
  const r = canvas.getBoundingClientRect();
  pointer.set((event.clientX - r.left) / r.width * 2 - 1, 1 - (event.clientY - r.top) / r.height * 2);
  raycaster.setFromCamera(pointer, engine.camera);
  const hits = raycaster.intersectObject(engine.model, true);
  const first = hits.find(item => {
    for (let object = item.object; object; object = object.parent) if (!object.visible) return false;
    return true;
  });
  if (!first) return null;
  const object = first.object;
  if (object.userData.action === 'screen') {
    const target = screenActionAt(first.uv, selectedWork);
    return {object, action:target?.id, kind:target?.kind,
      label:target?.kind === 'select' ? `Preview: ${workAreas[target.id].title}` : undefined};
  }
  const action = object.userData.action === 'selected-work' ? selectedWork : object.userData.action;
  return {object, action, kind:'open', label:object.userData.label};
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || mode === 'transition') return;
  goalOrbit = orbit; goalPolar = polar;
  motion.yaw.velocity = motion.pitch.velocity = 0;
  pointerX = pointerY = 0;
  drag = {id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, time:performance.now(), velocity:0};
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (mode === 'transition') return;
  if (drag?.id === event.pointerId) {
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    const now = performance.now(), elapsed = Math.max(8, now - drag.time);
    drag.moved ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6;
    if (drag.moved) {
      if (mode === 'case') {
        goalEvidenceYaw = clamp(goalEvidenceYaw + dx * .004, -.35, .95);
        goalEvidenceTilt = clamp(goalEvidenceTilt - dy * .005, -.55, .55);
      } else {
        goalOrbit -= dx * .006;
        drag.velocity = drag.velocity * .35 + clamp(-dx * .006 / (elapsed / 1000), -5, 5) * .65;
        goalPolar = clamp(goalPolar + dy * .004, .85, 1.45);
        document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', 'false'));
      }
      dirty = true;
    }
    drag.x = event.clientX; drag.y = event.clientY; drag.time = now;
    return;
  }
  if (event.pointerType === 'mouse' && mode === 'home' && !$('#details').open && !motionReduced()) {
    const rect = canvas.getBoundingClientRect();
    pointerX = clamp((event.clientX / rect.width - .68) * .07, -.025, .025);
    pointerY = clamp(((event.clientY - rect.top) / rect.height - .5) * .025, -.012, .012);
    dirty = true;
  }
  const target = hit(event);
  const action = target?.action || '';
  canvas.classList.toggle('is-action', Boolean(action));
  if (action !== hoverAction) {
    hoverAction = action;
    // Preview tabs are click targets. Merely crossing the pager should not
    // interrupt reading; stickers may preview their own work on hover.
    if (target?.object.userData.sticker) selectWork(action);
  }
  const label = target?.label;
  tooltip.hidden = !label;
  if (label) {
    tooltip.textContent = label;
    tooltip.style.left = Math.max(12, Math.min(event.clientX + 15, innerWidth - tooltip.offsetWidth - 15)) + 'px';
    tooltip.style.top = Math.max(12, Math.min(event.clientY + 15, innerHeight - 50)) + 'px';
  }
});
canvas.addEventListener('pointerup', event => {
  if (!drag || drag.id !== event.pointerId) return;
  const moved = drag.moved;
  if (moved && mode === 'home' && !motionReduced()) goalOrbit += releaseTravel(drag.velocity, performance.now() - drag.time);
  drag = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (moved || mode !== 'home' || performance.now() - completedAt < 350) return;
  const target = hit(event), object = target?.object, action = target?.action;
  const keycap = object?.userData.keyTarget || object;
  if (keycap?.userData.restY !== undefined) {
    presses.push({mesh: keycap, start: performance.now()});
    if (keycap.userData.legend) presses.push({mesh: keycap.userData.legend, start: performance.now()});
  }
  if (target?.kind === 'select') {
    selectWork(action);
    $('#status').textContent = `${workAreas[action].title} preview selected. Enter opens the work details.`;
  } else if (panels[action]) openPanel(action);
  else if (action === 'key') { dirty = true; }
});
canvas.addEventListener('pointercancel', () => { drag = null; pointerX = pointerY = 0; dirty = true; });
canvas.addEventListener('pointerleave', () => { tooltip.hidden = true; pointerX = pointerY = 0; dirty = true; });
canvas.addEventListener('keydown', event => {
  if (mode === 'transition') return;
  if (event.key.toLowerCase() === 'r' && mode === 'home') { event.preventDefault(); setView('front'); }
  if (event.key === 'Enter' && mode === 'home') { event.preventDefault(); openPanel(selectedWork); }
  if (/^[123]$/.test(event.key) && mode === 'home') { event.preventDefault(); openPanel(workOrder[Number(event.key) - 1]); }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); const d = event.key === 'ArrowRight' ? .16 : -.16;
    if (mode === 'home') goalOrbit += d;
    else goalEvidenceYaw = clamp(goalEvidenceYaw + d, -.35, .95);
    dirty = true;
  }
});
addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('#details').open) returnToLaptop();
});
function setView(view) {
  const angle = view === 'back' ? Math.PI + .42 : .42;
  goalOrbit = nearestAngle(orbit, angle);
  goalPolar = 1.18;
  pointerX = pointerY = 0;
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  $('#scene-hint').textContent = view === 'back' ? 'Three stickers · three areas of work' : 'Drag to turn · click the preview to explore';
  dirty = true;
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
$('#reset-view').addEventListener('click', () => setView('front'));
addEventListener('resize', () => { resize(); dirty = true; });
function syncMotionPreference() {
  const off = motionReduced();
  document.body.dataset.reducedMotion = String(off);
  $('#motion-toggle').setAttribute('aria-pressed', String(off));
  $('#motion-toggle').disabled = reduced.matches;
  $('#motion-toggle').title = reduced.matches ? 'Following your system’s reduced-motion preference' : 'Toggle reduced motion';
  $('#motion-toggle span').textContent = off ? 'off' : 'on';
  if (off) { pointerX = pointerY = 0; panelAnimation?.finish(); }
  if (off && previewTransition && engine) { previewTransition = null; paintScreen(); }
  if (transition) {
    depth = targetDepth = 0;
    const inCase = transition.inCase;
    finishTransition(inCase);
    window.scrollTo({top: inCase ? $('#entry-runway').offsetHeight : 0, behavior: 'instant'});
  }
  dirty = true;
}
reduced.addEventListener('change', syncMotionPreference);
$('#motion-toggle').addEventListener('click', () => { manualReduced = !manualReduced; syncMotionPreference(); });
syncMotionPreference();
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  cancelAnimationFrame(frame);
  canvas.hidden = true; $('#fallback').hidden = false;
  engine = null;
  if (transition) finishTransition(transition.inCase);
});
addEventListener('pagehide', event => { if (!event.persisted) { cancelAnimationFrame(frame); engine?.compositor.dispose(); engine?.renderer.dispose(); } });
setup().catch(error => {
  console.warn('Workspace 3D unavailable', error);
  canvas.hidden = true; $('#fallback').hidden = false;
  $('#scene-hint').textContent = '';
  document.body.dataset.ready = 'true';
  if (queuedCase) changeMode(true, false);
});
