import * as THREE from "three";

const scene = new THREE.Scene();
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 1000);
camera.position.z = 50;

const idleZ = 50;
const idleFOV = 30;

let targetFOV = idleFOV;
let targetZ = idleZ;
const transitionSpeed = 0.01;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.insertBefore(renderer.domElement, document.body.firstChild);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const cubes = [];

const gridRows = 6;
const gridCols = 12;
const numCubes = gridRows * gridCols;
const spacing = 7;
const cube_scale = 3.5;

for (let i = 0; i < numCubes; i++) {
  const geometry = new THREE.BoxGeometry(cube_scale, cube_scale, cube_scale);
  const hue = i / numCubes;
  const color = new THREE.Color().setHSL(hue, 1, 0.5);
  const material = new THREE.MeshPhongMaterial({
    color: color,
    shininess: 100,
  });

  const cube = new THREE.Mesh(geometry, material);

  const row = Math.floor(i / gridCols);
  const col = i % gridCols;
  cube.position.x = (col - (gridCols - 1) / 2) * spacing;
  cube.position.y = (row - (gridRows - 1) / 2) * spacing;

  scene.add(cube);

  cubes.push({
    mesh: cube,
    currentRotation: new THREE.Vector3(0, 0, -1),
    targetRotation: new THREE.Vector3(0, 0, -1),
    speed: 0.05 + (i / numCubes) * 0.1,
  });
}

let isLinkHovered = false;
let mousePosition = new THREE.Vector3(0, 0, 1);
let globalDirection = new THREE.Vector3(0, 0, 1);
let isWindowFocused = true;

window.addEventListener("blur", () => {
  isWindowFocused = false;
});

window.addEventListener("focus", () => {
  isWindowFocused = true;
});

document.addEventListener("mouseleave", () => {
  isWindowFocused = false;
});

document.addEventListener("mouseenter", () => {
  isWindowFocused = true;
});

function updateMousePosition(event) {
  const x = (event.clientX / window.innerWidth) * 2 - 1;
  const y = -(event.clientY / window.innerHeight) * 2 + 1;

  mousePosition.set(x * 20, y * 20, 1);

  globalDirection.set(x * 3, y * 3, 1).normalize();
}

document.querySelectorAll(".social-links a").forEach((link) => {
  link.addEventListener("mouseenter", () => {
    isLinkHovered = true;
    targetFOV = 75;
    targetZ = 14;
  });
  link.addEventListener("mouseleave", () => {
    isLinkHovered = false;
    targetFOV = idleFOV;
    targetZ = idleZ;
  });
});

document.addEventListener("mousemove", (event) => {
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

function animate() {
  requestAnimationFrame(animate);

  camera.position.z += (targetZ - camera.position.z) * transitionSpeed;
  camera.fov += (targetFOV - camera.fov) * transitionSpeed;
  camera.updateProjectionMatrix();

  const scale =
    (Math.tan((camera.fov * Math.PI) / 360) * camera.position.z) / 15;

  cubes.forEach((cube) => {
    if (!isWindowFocused) {
      cube.targetRotation.lerp(new THREE.Vector3(0, 0, 1), 0.05);
    }
    cube.currentRotation.lerp(cube.targetRotation, cube.speed);
    cube.mesh.lookAt(cube.mesh.position.clone().add(cube.currentRotation));

    cube.mesh.scale.setScalar(scale);
  });

  renderer.render(scene, camera);
}

animate();
