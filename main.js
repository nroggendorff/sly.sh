import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.z = 50;

const idleZ = 70;
const idleFOV = 30;
let targetFOV = idleFOV;
let targetZ = idleZ;

const ZOOM_IN_SPEED = 0.035;
const ZOOM_OUT_SPEED = 0.005;
const MAX_ANGULAR_STEP = 0.2;
const TRANSITION_DURATION = 3000;
const SHOCKWAVE_DURATION = 1000;
const SHOCKWAVE_TRAVEL = 80;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.insertBefore(renderer.domElement, document.body.firstChild);

scene.add(new THREE.AmbientLight(0xffffff, 2));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 4, 3);
scene.add(dirLight);

const loader = new GLTFLoader();
const cubes = [];
const gridRows = 7;
const gridCols = 13;
const spacing = 7;
const cubeScale = 4;
let geometry;

function makeCube(i) {
  const color = new THREE.Color().setHSL((i % gridCols) / gridCols, 1, 0.5);
  const mat = new THREE.MeshPhongMaterial({ color, shininess: 100 });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.x = ((i % gridCols) - (gridCols - 1) / 2) * spacing;
  mesh.position.y = (Math.floor(i / gridCols) - (gridRows - 1) / 2) * spacing;
  return mesh;
}

loader.load("assets/box.glb", (gltf) => {
  const src = gltf.scene.getObjectByProperty("type", "Mesh");
  if (!src) return;
  geometry = src.geometry.clone();
  geometry.scale(cubeScale, cubeScale, cubeScale);
  for (let i = 0; i < gridRows * gridCols; i++) {
    const mesh = makeCube(i);
    scene.add(mesh);
    cubes.push({
      mesh,
      cur: new THREE.Vector3(0, 0, 1),
      tgt: new THREE.Vector3(0, 0, 1),
      speed: 0.05 + (i / (gridRows * gridCols)) * 0.1,
    });
  }
});

let isLinkHovered = false;
let isClicked = false;
let clickReleaseTime = null;
let releasePos = new THREE.Vector3(0, 0, 1);

let mousePos = new THREE.Vector3(0, 0, 1);
let globalDir = new THREE.Vector3(0, 0, 1);
let windowFocused = true;
let mouseInWindow = true;
let lastEvent = null;

let shockActive = false;
let shockStartTime = null;
let shockOrigin = new THREE.Vector3();
let shadowLevel = 1.0;

const containerEl = document.querySelector(".container");
const socialLinksEl = document.querySelector(".social-links");

function worldFromEvent(evt) {
  const nx = (evt.clientX / window.innerWidth) * 2 - 1;
  const ny = -(evt.clientY / window.innerHeight) * 2 + 1;
  const v = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
  const d = v.sub(camera.position).normalize();
  const t = -camera.position.z / d.z;
  const pos = camera.position.clone().add(d.multiplyScalar(t));
  const linksEl = document.querySelector(".social-links");
  const rect = linksEl ? linksEl.getBoundingClientRect() : null;
  const cy = rect ? (rect.top + rect.bottom) / 2 : window.innerHeight / 2;
  const gy = (-(evt.clientY - cy) / window.innerHeight) * 2;
  const gDir = new THREE.Vector3(nx * 3, gy * 3, 1).normalize();
  return { pos, gDir };
}

function setMouse(evt) {
  lastEvent = evt;
  const { pos, gDir } = worldFromEvent(evt);
  mousePos.copy(pos);
  globalDir.copy(gDir);
}

function refreshMouse() {
  if (!lastEvent) return;
  const { pos, gDir } = worldFromEvent(lastEvent);
  mousePos.copy(pos);
  globalDir.copy(gDir);
}

function resetAll() {
  targetFOV = idleFOV;
  targetZ = idleZ;
  mousePos.set(0, 0, 1);
  globalDir.set(0, 0, 1);
  isLinkHovered = false;
  isClicked = false;
  clickReleaseTime = null;
}

window.addEventListener("blur", () => {
  windowFocused = false;
  resetAll();
});
window.addEventListener("focus", () => {
  windowFocused = true;
});
document.addEventListener("mouseleave", () => {
  mouseInWindow = false;
  resetAll();
});
document.addEventListener("mouseenter", () => {
  mouseInWindow = true;
});

document.querySelectorAll(".social-links a").forEach((a) => {
  a.addEventListener("mouseenter", () => {
    isLinkHovered = true;
    targetFOV = 75;
    targetZ = 14;
  });
  a.addEventListener("mouseleave", () => {
    isLinkHovered = false;
    targetFOV = idleFOV;
    targetZ = idleZ;
  });
});

document.addEventListener("mousedown", (evt) => {
  if (containerEl && containerEl.contains(evt.target)) {
    if (!socialLinksEl || !socialLinksEl.contains(evt.target)) {
      const { pos } = worldFromEvent(evt);
      shockOrigin.copy(pos);
      shockActive = true;
      shockStartTime = Date.now();
      shadowLevel = 0.0;
      return;
    }
  }
  isClicked = true;
  clickReleaseTime = null;
  setMouse(evt);
});

document.addEventListener("mouseup", () => {
  if (isClicked) {
    isClicked = false;
    clickReleaseTime = Date.now();
    releasePos.copy(mousePos);
  }
});

document.addEventListener("mousemove", (evt) => {
  if (!windowFocused) return;
  setMouse(evt);
  if (clickReleaseTime !== null) return;
  if (!isClicked && !isLinkHovered) {
    cubes.forEach((c) => c.tgt.copy(globalDir));
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function stepToward(cur, tgt, speed, maxStep) {
  const diff = new THREE.Vector3().subVectors(tgt, cur);
  const len = diff.length();
  if (len < 0.0001) return;
  const step = Math.min(len * speed, maxStep);
  diff.normalize();
  cur.addScaledVector(diff, step);
  cur.normalize();
}

function updateCubes() {
  refreshMouse();
  const scale =
    (Math.tan((camera.fov * Math.PI) / 360) * camera.position.z) / 15;
  const fwd = new THREE.Vector3(0, 0, 1);
  const now = Date.now();
  let shockEnded = false;

  cubes.forEach((c) => {
    if (!mouseInWindow || !windowFocused) {
      c.tgt.set(0, 0, 1);
    } else if (shockActive) {
      const elapsed = now - shockStartTime;
      if (elapsed >= SHOCKWAVE_DURATION) {
        shockEnded = true;
        c.tgt.copy(globalDir);
      } else {
        const dist = c.mesh.position.distanceTo(shockOrigin);
        const waveFront = (elapsed / SHOCKWAVE_DURATION) * SHOCKWAVE_TRAVEL;
        const waveWidth = 18;
        const influence = Math.max(
          0,
          1 - Math.abs(dist - waveFront) / waveWidth,
        );
        if (influence > 0.01) {
          const outDir = new THREE.Vector3()
            .subVectors(c.mesh.position, shockOrigin)
            .normalize();
          outDir.z = 0.8;
          outDir.normalize();
          c.tgt.copy(outDir);
        } else {
          c.tgt.lerp(globalDir, 0.04);
          c.tgt.normalize();
        }
      }
    } else if (isClicked || isLinkHovered) {
      c.tgt.subVectors(mousePos, c.mesh.position).normalize();
    } else if (clickReleaseTime !== null) {
      const elapsed = now - clickReleaseTime;
      if (elapsed >= TRANSITION_DURATION) {
        clickReleaseTime = null;
        c.tgt.copy(globalDir);
      } else {
        const distToMouse = c.mesh.position.distanceTo(mousePos);
        const proximityBoost =
          Math.max(0, 1 - distToMouse / 55) * TRANSITION_DURATION * 0.6;
        const adjustedElapsed = Math.min(
          TRANSITION_DURATION,
          elapsed + proximityBoost,
        );
        const t = adjustedElapsed / TRANSITION_DURATION;
        const ease = t * t * (3 - 2 * t);
        const fromDir = new THREE.Vector3()
          .subVectors(releasePos, c.mesh.position)
          .normalize();
        c.tgt.lerpVectors(fromDir, globalDir, ease).normalize();
      }
    } else {
      c.tgt.copy(globalDir);
    }

    stepToward(c.cur, c.tgt, c.speed, MAX_ANGULAR_STEP);
    c.mesh.lookAt(c.mesh.position.clone().add(c.cur));

    const angle = c.cur.angleTo(fwd);
    const zScale = 1 + Math.min(1, angle / (Math.PI * 0.5));
    c.mesh.scale.set(scale, scale, scale * zScale);
  });

  if (shockEnded) {
    shockActive = false;
    shockStartTime = null;
  }

  if (shadowLevel < 1.0) {
    shadowLevel = Math.min(1.0, shadowLevel + 0.012);
    const blur = shadowLevel * 25;
    const opacity = shadowLevel * 0.1;
    containerEl.style.boxShadow = `0 10px ${blur}px rgba(0, 0, 0, ${opacity})`;
  } else if (containerEl.style.boxShadow !== "") {
    containerEl.style.boxShadow = "";
  }
}

function animate() {
  requestAnimationFrame(animate);
  const zoomingIn = targetZ < camera.position.z;
  let speed = zoomingIn ? ZOOM_IN_SPEED : ZOOM_OUT_SPEED;

  if (!zoomingIn) {
    const distRemaining = camera.position.z - targetZ;
    const maxDist = idleZ - 14;
    const progress = Math.max(0, Math.min(1, 1 - distRemaining / maxDist));
    speed = ZOOM_OUT_SPEED * (1 + progress * progress * 8);
  }

  camera.position.z += (targetZ - camera.position.z) * speed;
  camera.fov += (targetFOV - camera.fov) * speed;
  camera.updateProjectionMatrix();

  updateCubes();

  renderer.setClearColor(0xffffff, 0);
  renderer.render(scene, camera);
}

animate();
