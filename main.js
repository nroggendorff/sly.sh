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
const cube_scale = 2.2;

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

loader.load("img/box.glb", (gltf) => {
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
let mousePosition = new THREE.Vector3(0, 0, 1);
let globalDirection = new THREE.Vector3(0, 0, 1);
let isWindowFocused = true;
let isMouseInWindow = true;

const resetCubes = () => {
  targetFOV = idleFOV;
  targetZ = idleZ;
  mousePosition.set(0, 0, 1);
  globalDirection.set(0, 0, 1);
  isLinkHovered = false;
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
  const x = (event.clientX / window.innerWidth) * 2 - 1;
  const y = -(event.clientY / window.innerHeight) * 2 + 1;

  mousePosition.set(x * 20, y * 20, 1);

  globalDirection.set(x * 3, y * 3, 1).normalize();
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

document.addEventListener("mousemove", (event) => {
  if (!isWindowFocused) return;

  updateMousePosition(event);

  if (isLinkHovered) {
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

  cubes.forEach((cube) => {
    const shouldReset = !isMouseInWindow || !isWindowFocused;
    cube.targetRotation = shouldReset
      ? new THREE.Vector3(0, 0, 1)
      : isLinkHovered
      ? new THREE.Vector3()
          .subVectors(mousePosition, cube.mesh.position)
          .normalize()
      : globalDirection;

    cube.currentRotation.lerp(cube.targetRotation, cube.speed);
    cube.mesh.lookAt(cube.mesh.position.clone().add(cube.currentRotation));
    cube.mesh.scale.setScalar(scale);
  });
}

function animate() {
  requestAnimationFrame(animate);

  camera.position.z += (targetZ - camera.position.z) * transitionSpeed;
  camera.fov += (targetFOV - camera.fov) * transitionSpeed;
  camera.updateProjectionMatrix();

  updateCubes();

  renderer.setClearColor(0xffffff, 0);
  renderer.render(scene, camera);
}

animate();
