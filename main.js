import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 1000);
camera.position.z = 50;

const idleZ = 70;
const idleFOV = 30;

let targetFOV = idleFOV;
let targetZ = idleZ;
const transitionSpeed = 0.03;

const renderer = new THREE.WebGLRenderer({ antialias: true });
const loader = new GLTFLoader();

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.insertBefore(renderer.domElement, document.body.firstChild);

const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 4, 3);
scene.add(directionalLight);

const cubes = [];

const gridRows = 7;
const gridCols = 13;
const numCubes = gridRows * gridCols;
const spacing = 7;
const cube_scale = 4;

let geometry;

const createCube = (i) => {
  const color = new THREE.Color().setHSL((i % gridCols) / gridCols, 1, 0.5);
  const material = new THREE.MeshPhongMaterial({
    color: color,
    shininess: 100,
  });

  const cube = new THREE.Mesh(geometry, material);
  const row = Math.floor(i / gridCols);
  const col = i % gridCols;

  cube.position.x = (col - (gridCols - 1) / 2) * spacing;
  cube.position.y = (row - (gridRows - 1) / 2) * spacing;

  return cube;
};

loader.load("assets/box.glb", (gltf) => {
  const mesh = gltf.scene.getObjectByProperty("type", "Mesh");
  if (mesh) {
    geometry = mesh.geometry.clone();
    geometry.scale(cube_scale, cube_scale, cube_scale);

    for (let i = 0; i < numCubes; i++) {
      const cube = createCube(i);
      scene.add(cube);
      cubes.push({
        mesh: cube,
        currentRotation: new THREE.Vector3(0, 0, -1),
        targetRotation: new THREE.Vector3(0, 0, -1),
        speed: 0.05 + (i / numCubes) * 0.1,
      });
    }
  }
});

let isLinkHovered = false;
let isClicked = false;
let clickReleaseTime = null;
let releasePosition = new THREE.Vector3(0, 0, 1);
const TRANSITION_DURATION = 3000;

let mousePosition = new THREE.Vector3(0, 0, 1);
let globalDirection = new THREE.Vector3(0, 0, 1);
let isWindowFocused = true;
let isMouseInWindow = true;
let lastMouseEvent = null;

const resetCubes = () => {
  targetFOV = idleFOV;
  targetZ = idleZ;
  mousePosition.set(0, 0, 1);
  globalDirection.set(0, 0, 1);
  isLinkHovered = false;
  isClicked = false;
  clickReleaseTime = null;
};

const handleWindowFocus = (isFocused) => {
  isWindowFocused = isFocused;
  if (!isFocused) resetCubes();
};

const handleMouseInWindow = (isInWindow) => {
  isMouseInWindow = isInWindow;
  if (!isInWindow) resetCubes();
};

window.addEventListener("blur", () => handleWindowFocus(false));
window.addEventListener("focus", () => handleWindowFocus(true));
document.addEventListener("mouseleave", () => handleMouseInWindow(false));
document.addEventListener("mouseenter", () => handleMouseInWindow(true));

function updateMousePosition(event) {
  lastMouseEvent = event;

  const socialLinks = document.querySelector(".social-links");
  const linksRect = socialLinks ? socialLinks.getBoundingClientRect() : null;
  const linksY = linksRect
    ? (linksRect.top + linksRect.bottom) / 2
    : window.innerHeight / 2;

  const x = (event.clientX / window.innerWidth) * 2 - 1;
  const y = -(event.clientY / window.innerHeight) * 2 + 1;

  const vec = new THREE.Vector3(x, y, 0.5);
  vec.unproject(camera);

  const dir = vec.sub(camera.position).normalize();
  const distance = -camera.position.z / dir.z;
  const pos = camera.position.clone().add(dir.multiplyScalar(distance));

  mousePosition.copy(pos);

  const adjustedY = event.clientY - linksY;
  const normalizedY = -(adjustedY / window.innerHeight) * 2;

  globalDirection.set(x * 3, normalizedY * 3, 1).normalize();
}

function recalculateMousePosition() {
  if (lastMouseEvent && (isClicked || isLinkHovered)) {
    updateMousePosition(lastMouseEvent);
  }
}

const handleLinkHover = (isEntering) => {
  isLinkHovered = isEntering;
  targetFOV = isEntering ? 75 : idleFOV;
  targetZ = isEntering ? 14 : idleZ;
};

document.querySelectorAll(".social-links a").forEach((link) => {
  link.addEventListener("mouseenter", () => handleLinkHover(true));
  link.addEventListener("mouseleave", () => handleLinkHover(false));
});

document.addEventListener("mousedown", (event) => {
  isClicked = true;
  clickReleaseTime = null;
  updateMousePosition(event);
});

document.addEventListener("mouseup", () => {
  if (isClicked) {
    isClicked = false;
    clickReleaseTime = Date.now();
    releasePosition.copy(mousePosition);
  }
});

document.addEventListener("mousemove", (event) => {
  if (!isWindowFocused) return;

  updateMousePosition(event);

  if (clickReleaseTime !== null) {
    return;
  }

  if (isClicked || isLinkHovered) {
    cubes.forEach((cube) => {
      const direction = new THREE.Vector3();
      direction.subVectors(mousePosition, cube.mesh.position).normalize();
      cube.targetRotation.copy(direction);
    });
  } else {
    cubes.forEach((cube) => {
      cube.targetRotation.copy(globalDirection);
    });
  }
});

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;

  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
});

function updateCubes() {
  const scale =
    (Math.tan((camera.fov * Math.PI) / 360) * camera.position.z) / 15;
  const forwardVector = new THREE.Vector3(0, 0, 1);

  cubes.forEach((cube) => {
    let targetRotation;

    if (clickReleaseTime !== null) {
      const elapsed = Date.now() - clickReleaseTime;
      if (elapsed < TRANSITION_DURATION) {
        const t = elapsed / TRANSITION_DURATION;
        const easeT = t * t * (3 - 2 * t);
        const clickDirection = new THREE.Vector3()
          .subVectors(releasePosition, cube.mesh.position)
          .normalize();
        targetRotation = new THREE.Vector3().lerpVectors(
          clickDirection,
          globalDirection,
          easeT,
        );
        cube.targetRotation.copy(targetRotation);
      } else {
        clickReleaseTime = null;
        cube.targetRotation.copy(globalDirection);
      }
    }

    const shouldReset = !isMouseInWindow || !isWindowFocused;
    if (shouldReset) {
      cube.targetRotation = new THREE.Vector3(0, 0, 1);
    }

    cube.currentRotation.lerp(cube.targetRotation, cube.speed);
    cube.mesh.lookAt(cube.mesh.position.clone().add(cube.currentRotation));

    const angle = cube.currentRotation.angleTo(forwardVector);
    const zScale = 1 + Math.min(1, angle / (Math.PI * 0.5));

    cube.mesh.scale.set(scale, scale, scale * zScale);
  });
}

function animate() {
  requestAnimationFrame(animate);

  camera.position.z += (targetZ - camera.position.z) * transitionSpeed;
  camera.fov += (targetFOV - camera.fov) * transitionSpeed;
  camera.updateProjectionMatrix();

  recalculateMousePosition();
  updateCubes();

  renderer.setClearColor(0xffffff, 0);
  renderer.render(scene, camera);
}

animate();
