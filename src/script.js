import * as THREE from 'three';
import * as dat from 'dat.gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { Noise } from 'noisejs';

import bgTexture1 from '/images/1.jpg';
import bgTexture2 from '/images/2.jpg';
import bgTexture3 from '/images/3.jpg';
import bgTexture4 from '/images/4.jpg';
import sunTexture from '/images/sun.jpg';
import mercuryTexture from '/images/mercurymap.jpg';
import mercuryBump from '/images/mercurybump.jpg';
import venusTexture from '/images/venusmap.jpg';
import venusBump from '/images/venusmap.jpg';
import venusAtmosphere from '/images/venus_atmosphere.jpg';
import earthTexture from '/images/earth_daymap.jpg';
import earthNightTexture from '/images/earth_nightmap.jpg';
import earthAtmosphere from '/images/earth_atmosphere.jpg';
import earthMoonTexture from '/images/moonmap.jpg';
import earthMoonBump from '/images/moonbump.jpg';
import marsTexture from '/images/marsmap.jpg';
import marsBump from '/images/marsbump.jpg';
import jupiterTexture from '/images/jupiter.jpg';
import ioTexture from '/images/jupiterIo.jpg';
import europaTexture from '/images/jupiterEuropa.jpg';
import ganymedeTexture from '/images/jupiterGanymede.jpg';
import callistoTexture from '/images/jupiterCallisto.jpg';
import saturnTexture from '/images/saturnmap.jpg';
import satRingTexture from '/images/saturn_ring.png';
import uranusTexture from '/images/uranus.jpg';
import uraRingTexture from '/images/uranus_ring.png';
import neptuneTexture from '/images/neptune.jpg';
import plutoTexture from '/images/plutomap.jpg';

async function readJSON(url) {
  const res = await fetch(url);
  const json = await res.json();
  return json;
}

// Convert AU to your scene units
function auToOrbitRadius(au) {
    return au * 150;
}

// === Scene/physics scaling helpers ===
const AU_KM = 149_597_870;                                // km
const KM_PER_SU = AU_KM / auToOrbitRadius(1);             // 1 scene-unit = ~AU/150 km
let   TIME_SCALE = 5e5;                                    // 1s mô phỏng = 500,000s thật (tuỳ chỉnh GUI)
function vrelToOmega(v_kmps, r_su){
  // v [km/s] -> v_scene [su/s] -> omega [rad/s]
  const v_su_per_s = (v_kmps / KM_PER_SU) * TIME_SCALE;
  return v_su_per_s / Math.max(r_su, 1e-6);
}
const M_PER_SU = KM_PER_SU * 1000;     // mét cho mỗi scene-unit (dựa trên AU->SU hiện có)
const NEO_MIN_RADIUS_SU = 2;        // bán kính tối thiểu để không “biến mất” trên màn hình

//For day logging
const DAY_S = 86400;                    // seconds in a day
function mjdToDate(mjd) {
  // MJD epoch is 1858-11-17; Unix epoch offset is 40587 days
  return new Date((mjd - 40587) * DAY_S * 1000);
}
function dateToMJD(date) {
  return date.getTime() / 1000 / DAY_S + 40587;
}
let simMJD = null;

// THREE clock for frame-delta based updates
const clock = new THREE.Clock();

// Solve Kepler's Equation (M -> E) using simple iteration
function solveKepler(M, e, tolerance = 1e-6) {
    let E = M;
    let delta = 1;
    while (Math.abs(delta) > tolerance) {
        delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E -= delta;
    }
    return E;
}

// Convert orbital elements to 3D position
function orbitalElementsToPosition(elements, trueAnomalyRad) {
    const a = elements.a;
    const e = elements.e;
    const i = THREE.MathUtils.degToRad(elements.i);
    const Omega = THREE.MathUtils.degToRad(elements["long. node"]);
    const omega = THREE.MathUtils.degToRad(elements["arg. peric."]);

    const aScaled = auToOrbitRadius(a);

    // Orbital radius
    const r = aScaled * (1 - e*e) / (1 + e * Math.cos(trueAnomalyRad));

    // 3D coordinates
    const x = (Math.cos(Omega) * Math.cos(omega + trueAnomalyRad) - Math.sin(Omega) * Math.sin(omega + trueAnomalyRad) * Math.cos(i)) * r;
    const y = Math.sin(omega + trueAnomalyRad) * Math.sin(i) * r;
    const z = (Math.sin(Omega) * Math.cos(omega + trueAnomalyRad) + Math.cos(Omega) * Math.sin(omega + trueAnomalyRad) * Math.cos(i)) * r;

    return new THREE.Vector3(x, y, z);
}

function createAsteroidOrbitLine(elements, segments = 600) {
    const points = [];
    for (let j = 0; j <= segments; j++) {
        const nu = 2 * Math.PI * j / segments; // true anomaly
        points.push(orbitalElementsToPosition(elements, nu));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xffff00, opacity: 0.3, transparent: true });
    const orbitLine = new THREE.LineLoop(geometry, material);
    return orbitLine;
}

const noise = new Noise(Math.random());
function createNoisyRock(radius = 1, detail = 3) {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geometry.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const nx = noise.perlin3(x, y, z);
    const scale = 1 + nx * 0.3; // distortion strength

    pos.setXYZ(i, x * scale, y * scale, z * scale);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createAsteroidMesh(elements) {
  let material = new THREE.MeshStandardMaterial({ color: 0x888888 });

  // ---- ID để match risk ----
  const id = (elements.Name ?? elements["Num/des."] ?? "").toString();

  // ---- Lấy size từ risk.m (diameter in meters) ----
  const risk = riskById[id];
  const d_m  = risk && Number.isFinite(risk.m) ? Number(risk.m) : null;
  const baseRadiusSU = d_m ? (d_m / M_PER_SU) : THREE.MathUtils.randFloat(1, 2);
  const radius_su    = Math.max(NEO_MIN_RADIUS_SU, baseRadiusSU*0.2);

  const geometry = createNoisyRock(radius_su);
  const mesh = new THREE.Mesh(geometry, material);

  // ---- Kepler at epoch (giữ nguyên) ----
  const M = THREE.MathUtils.degToRad(elements["mean anomaly"]);
  const E = solveKepler(M, elements.e);
  const nu = 2 * Math.atan2(Math.sqrt(1+elements.e)*Math.sin(E/2), Math.sqrt(1-elements.e)*Math.cos(E/2));
  const position = orbitalElementsToPosition(elements, nu);
  mesh.position.copy(position);

  mesh.name = id || "Unnamed";

  // ---- Mặc định orbitSpeed cũ ----
  let orbitSpeed = 0.00005 + Math.random() * 0.0001;

  // ---- Nếu có risk → tính orbitSpeed từ Vel km/s + tô màu theo PS cum ----
  if (risk) {
    const vRel = Number(risk["Vel km/s"]) || 0;
    const r_su_orbit = mesh.position.length();
    const omega = vrelToOmega(vRel, r_su_orbit);
    orbitSpeed = omega;

    const psCum = Number(risk["PS cum"]);
    mesh.material = mesh.material.clone();
    if (psCum > 0) {
      mesh.material.color.setHex(0xff0000);
      // tránh emissive mặc định để không “lệch ánh sáng” (nếu cần, bật khi hover)
      mesh.material.emissive = new THREE.Color(0xaa0000);
      mesh.material.emissiveIntensity = 0.15;
    } else if (psCum > -1) {
      mesh.material.color.setHex(0xff7f00);
    } else if (psCum > -2) {
      mesh.material.color.setHex(0xffbf00);
    } else {
      mesh.material.color.setHex(0x00a2ff);
    }

    mesh.userData.risk = {
      id,
      diameter_m: d_m,
      vRelKmps: vRel,
      psMax: risk["PS max"], psCum: risk["PS cum"],
      ipMax: risk["IP max"], ipCum: risk["IP cum"],
      date: risk["Date/Time"], years: risk["Years"]
    };
  }

  //mesh.userData.diameter_m = d_m;
  mesh.userData = {
    ...mesh.userData,
    elements,
    meanAnomaly: M,
    eccentricAnomaly: E,
    orbitSpeed: 0.001 * settings.accelerationOrbit,
    radius_su: radius_su
  };

  scene.add(mesh);
  return mesh;
}




// ******  SETUP  ******
console.log("Create the scene");
const scene = new THREE.Scene();

console.log("Create a perspective projection camera");
var camera = new THREE.PerspectiveCamera( 45, window.innerWidth/window.innerHeight, 0.1, 1000 );
camera.position.set(-175, 115, 5);

console.log("Create the renderer");
const renderer = new THREE.WebGL1Renderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.toneMapping = THREE.ACESFilmicToneMapping;

console.log("Create an orbit control");
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.75;
controls.screenSpacePanning = false;

console.log("Set up texture loader");
const cubeTextureLoader = new THREE.CubeTextureLoader();
const loadTexture = new THREE.TextureLoader();

// ******  POSTPROCESSING setup ******
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// ******  OUTLINE PASS  ******
const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
outlinePass.edgeStrength = 3;
outlinePass.edgeGlow = 1;
outlinePass.visibleEdgeColor.set(0xffffff);
outlinePass.hiddenEdgeColor.set(0x190a05);
composer.addPass(outlinePass);

// ******  BLOOM PASS  ******
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1, 0.4, 0.85);
bloomPass.threshold = 1;
bloomPass.radius = 0.9;
composer.addPass(bloomPass);

// ****** AMBIENT LIGHT ******
console.log("Add the ambient light");
var lightAmbient = new THREE.AmbientLight(0x222222, 6); 
scene.add(lightAmbient);

// ******  Star background  ******
scene.background = cubeTextureLoader.load([

  bgTexture3,
  bgTexture1,
  bgTexture2,
  bgTexture2,
  bgTexture4,
  bgTexture2
]);

// ******  CONTROLS  ******
const gui = new dat.GUI({ autoPlace: false });
const customContainer = document.getElementById('gui-container');
customContainer.appendChild(gui.domElement);

// ****** SETTINGS FOR INTERACTIVE CONTROLS  ******
const settings = {
  accelerationOrbit: 1,
  acceleration: 1,
  sunIntensity: 1.9,
  timeScale: TIME_SCALE ?? 5e5,  // Nếu TIME_SCALE không tồn tại, mặc định là 5e5
  filterDangerousOnly: false,
  // Giá trị này sẽ được cập nhật mỗi khung hình cho GUI, sẽ không thay đổi trong quá trình tính toán
  simDateISO: '',
  orbitLineFraction: 0.001 // phần quỹ đạo được vẽ (0-1)
};
function updateAsteroidVisibility() {
  visualAsteroids.forEach(mesh => {
    const isDanger = !!mesh.userData.isDanger;
    const visible  = settings.filterDangerousOnly ? isDanger : true;
    mesh.visible = visible;

    // also toggle the orbit line tied to this mesh
    const line = mesh.userData.orbitLine;
    if (line) line.visible = visible;
  });
}
function updateOrbitLineVisibility() {
  const totalAsteroids = visualAsteroids.length;
  const visibleCount = Math.floor(totalAsteroids * settings.orbitLineFraction);

  visualAsteroids.forEach((ast, i) => {
    const isVisible = i < visibleCount;
    
    // Toggle the asteroid mesh itself
    ast.visible = isVisible;

    // Toggle its orbit line
    if (ast.userData.orbitLine) {
      ast.userData.orbitLine.visible = isVisible;
    }
  });
}


gui.add(settings, 'accelerationOrbit', 0, 10).onChange(value => {
});
gui.add(settings, 'acceleration', 0, 10).onChange(value => {
});
gui.add(settings, 'sunIntensity', 1, 10).onChange(value => {
  sunMat.emissiveIntensity = value;
});
gui.add(settings, 'timeScale', 1e4, 2e6).onChange(v => { TIME_SCALE = v; });
gui.add(settings, 'filterDangerousOnly')
  .name('Dangerous only')
  .onChange(updateAsteroidVisibility);
gui.add(settings, 'simDateISO').name('Sim Date').listen();
gui.add(settings, 'orbitLineFraction', 0, 1, 0.01)
   .name('Orbit Lines %')
   .onChange(updateOrbitLineVisibility);


// mouse movement
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseMove(event) {
    event.preventDefault();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
}

// ******  SELECT PLANET  ******
let selectedPlanet = null;
let isMovingTowardsPlanet = false;
let targetCameraPosition = new THREE.Vector3();
let offset;

function onDocumentMouseDown(event) {
  event.preventDefault();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  var intersects = raycaster.intersectObjects(raycastTargets);

  if (intersects.length > 0) {
    const clickedObject = intersects[0].object;
    selectedPlanet = identifyPlanet(clickedObject);
    if (selectedPlanet) {
      closeInfoNoZoomOut();
      
      settings.accelerationOrbit = 0; // Stop orbital movement

      // Update camera to look at the selected planet
      const planetPosition = new THREE.Vector3();
      selectedPlanet.planet.getWorldPosition(planetPosition);
      controls.target.copy(planetPosition);
      camera.lookAt(planetPosition); // Orient the camera towards the planet

      targetCameraPosition.copy(planetPosition).add(camera.position.clone().sub(planetPosition).normalize().multiplyScalar(offset));
      isMovingTowardsPlanet = true;
    }
  }
}

function identifyPlanet(clickedObject) {
  // Logic to identify which planet was clicked based on the clicked object, different offset for camera distance
        if (clickedObject.material === mercury.planet.material) {
          offset = 10;
          return mercury;
        } else if (clickedObject.material === venus.Atmosphere.material) {
          offset = 25;
          return venus;
        } else if (clickedObject.material === earth.Atmosphere.material) {
          offset = 25;
          return earth;
        } else if (clickedObject.material === mars.planet.material) {
          offset = 15;
          return mars;
        } else if (clickedObject.material === jupiter.planet.material) {
          offset = 50;
          return jupiter;
        } else if (clickedObject.material === saturn.planet.material) {
          offset = 50;
          return saturn;
        } else if (clickedObject.material === uranus.planet.material) {
          offset = 25;
          return uranus;
        } else if (clickedObject.material === neptune.planet.material) {
          offset = 20;
          return neptune;
        } else if (clickedObject.material === pluto.planet.material) {
          offset = 10;
          return pluto;
        } 

  return null;
}

// ******  SHOW PLANET INFO AFTER SELECTION  ******
function showPlanetInfo(planet) {
  var info = document.getElementById('planetInfo');
  var name = document.getElementById('planetName');
  var details = document.getElementById('planetDetails');

  name.innerText = planet;
  details.innerText = `Radius: ${planetData[planet].radius}\nTilt: ${planetData[planet].tilt}\nRotation: ${planetData[planet].rotation}\nOrbit: ${planetData[planet].orbit}\nDistance: ${planetData[planet].distance}\nMoons: ${planetData[planet].moons}\nInfo: ${planetData[planet].info}`;

  info.style.display = 'block';
}
let isZoomingOut = false;
let zoomOutTargetPosition = new THREE.Vector3(-175, 115, 5);
// close 'x' button function
function closeInfo() {
  var info = document.getElementById('planetInfo');
  info.style.display = 'none';
  settings.accelerationOrbit = 1;
  isZoomingOut = true;
  controls.target.set(0, 0, 0);
}
window.closeInfo = closeInfo;
// close info when clicking another planet
function closeInfoNoZoomOut() {
  var info = document.getElementById('planetInfo');
  infoslice.style.display = 'none';
  settings.accelerationOrbit = 1;
}
// ******  SUN  ******
let sunMat;

const sunSize = 697/40; // 40 times smaller scale than earth
const sunGeom = new THREE.SphereGeometry(sunSize, 32, 20);
sunMat = new THREE.MeshStandardMaterial({
  emissive: 0xFFF88F,
  emissiveMap: loadTexture.load(sunTexture),
  emissiveIntensity: settings.sunIntensity
});
const sun = new THREE.Mesh(sunGeom, sunMat);
scene.add(sun);

//point light in the sun
const pointLight = new THREE.PointLight(0xFDFFD3 , 1200, 400, 1.4);
scene.add(pointLight);


// ******  PLANET CREATION FUNCTION  ******
function createPlanet(planetName, size, position, tilt, texture, bump, ring, atmosphere, moons){

  let material;
  if (texture instanceof THREE.Material){
    material = texture;
  } 
  else if(bump){
    material = new THREE.MeshPhongMaterial({
    map: loadTexture.load(texture),
    bumpMap: loadTexture.load(bump),
    bumpScale: 0.7
    });
  }
  else {
    material = new THREE.MeshPhongMaterial({
    map: loadTexture.load(texture)
    });
  } 

  const name = planetName;
  const geometry = new THREE.SphereGeometry(size, 32, 20);
  const planet = new THREE.Mesh(geometry, material);
  const planet3d = new THREE.Object3D;
  const planetSystem = new THREE.Group();
  planetSystem.add(planet);
  let Atmosphere;
  let Ring;
  planet.position.x = position;
  planet.rotation.z = tilt * Math.PI / 180;

  // add orbit path
  const orbitPath = new THREE.EllipseCurve(
    0, 0,            // ax, aY
    position, position, // xRadius, yRadius
    0, 2 * Math.PI,   // aStartAngle, aEndAngle
    false,            // aClockwise
    0                 // aRotation
);

  const pathPoints = orbitPath.getPoints(100);
  const orbitGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
  const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.03 });
  const orbit = new THREE.LineLoop(orbitGeometry, orbitMaterial);
  orbit.rotation.x = Math.PI / 2;
  planetSystem.add(orbit);

  //add ring
  if(ring)
  {
    const RingGeo = new THREE.RingGeometry(ring.innerRadius, ring.outerRadius,30);
    const RingMat = new THREE.MeshStandardMaterial({
      map: loadTexture.load(ring.texture),
      side: THREE.DoubleSide
    });
    Ring = new THREE.Mesh(RingGeo, RingMat);
    planetSystem.add(Ring);
    Ring.position.x = position;
    Ring.rotation.x = -0.5 *Math.PI;
    Ring.rotation.y = -tilt * Math.PI / 180;
  }
  
  //add atmosphere
  if(atmosphere){
    const atmosphereGeom = new THREE.SphereGeometry(size+0.1, 32, 20);
    const atmosphereMaterial = new THREE.MeshPhongMaterial({
      map:loadTexture.load(atmosphere),
      transparent: true,
      opacity: 0.4,
      depthTest: true,
      depthWrite: false
    })
    Atmosphere = new THREE.Mesh(atmosphereGeom, atmosphereMaterial)
    
    Atmosphere.rotation.z = 0.41;
    planet.add(Atmosphere);
  }

  //add moons
  if(moons){
    moons.forEach(moon => {
      let moonMaterial;
      
      if(moon.bump){
        moonMaterial = new THREE.MeshStandardMaterial({
          map: loadTexture.load(moon.texture),
          bumpMap: loadTexture.load(moon.bump),
          bumpScale: 0.5
        });
      } else{
        moonMaterial = new THREE.MeshStandardMaterial({
          map: loadTexture.load(moon.texture)
        });
      }
      const moonGeometry = new THREE.SphereGeometry(moon.size, 32, 20);
      const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
      const moonOrbitDistance = size * 1.5;
      moonMesh.position.set(moonOrbitDistance, 0, 0);
      planetSystem.add(moonMesh);
      moon.mesh = moonMesh;
    });
  }
  //add planet system to planet3d object and to the scene
  planet3d.add(planetSystem);
  scene.add(planet3d);
  return {name, planet, planet3d, Atmosphere, moons, planetSystem, Ring};
}

let data = await readJSON('/data/cur_epoch_kep.json');
const asteroidElements = data["data"]; // limit to first 2000 for performance
const firstWithEpoch = asteroidElements.find(e => e['Epoch(MJD)'] != null);
const epochMJD = firstWithEpoch ? Number(firstWithEpoch['Epoch(MJD)']) : 59600; // fallback
simMJD = epochMJD;
settings.simDateISO = mjdToDate(simMJD).toISOString().slice(0, 19) + 'Z';

data = await readJSON('/data/esa_risk_list_0.json');
const riskData = data["data"]; // array

data = await readJSON('/data/esa_risk_list_1.json');
riskData.push(...data["data"]);
const riskById = Object.fromEntries(
  riskData.map(r => [r["Num/des."].toString(), r])
);

// Add asteroids and orbits
const visualAsteroids = asteroidElements.map(el => {
  const id = (el.Name ?? el["Num/des."] ?? "").toString();
  const risk = riskById[id];
  const isDanger = risk ? isAsteroidDangerous(risk) : false;

  const orbitLine = createAsteroidOrbitLine(el);
  orbitLine.material.color.setHex(isDanger ? 0xff0000 : 0xffff00);
  scene.add(orbitLine);

  const mesh = createAsteroidMesh(el);

  mesh.userData.isDanger  = isDanger;
  mesh.userData.orbitLine = orbitLine;

  if (isDanger) {
    mesh.material = mesh.material.clone();
    mesh.material.color.setHex(0xff4444);
    mesh.material.emissive = new THREE.Color(0xff0000);
    mesh.material.emissiveIntensity = 0.3;
  }
  return mesh;
});
// ******  LOADING OBJECTS METHOD  ******
function loadObject(path, position, scale, callback) {
  const loader = new GLTFLoader();

  loader.load(path, function (gltf) {
      const obj = gltf.scene;
      obj.position.set(position, 0, 0);
      obj.scale.set(scale, scale, scale);
      scene.add(obj);
      if (callback) {
        callback(obj);
      }
  }, undefined, function (error) {
      console.error('An error happened', error);
  });
}

// Earth day/night effect shader material
const earthMaterial = new THREE.ShaderMaterial({
  uniforms: {
    dayTexture: { type: "t", value: loadTexture.load(earthTexture) },
    nightTexture: { type: "t", value: loadTexture.load(earthNightTexture) },
    sunPosition: { type: "v3", value: sun.position }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vSunDirection;

    uniform vec3 sunPosition;

    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vNormal = normalize(modelMatrix * vec4(normal, 0.0)).xyz;
      vSunDirection = normalize(sunPosition - worldPosition.xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;

    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vSunDirection;

    void main() {
      float intensity = max(dot(vNormal, vSunDirection), 0.0);
      vec4 dayColor = texture2D(dayTexture, vUv);
      vec4 nightColor = texture2D(nightTexture, vUv)* 0.2;
      gl_FragColor = mix(nightColor, dayColor, intensity);
    }
  `
});


// ******  MOONS  ******
// Earth
const earthMoon = [{
  size: 1.6,
  texture: earthMoonTexture,
  bump: earthMoonBump,
  orbitSpeed: 0.001 * settings.accelerationOrbit,
  orbitRadius: 10
}]

// Mars' moons with path to 3D models (phobos & deimos)
const marsMoons = [
  {
    modelPath: '/images/mars/phobos.glb',
    scale: 0.1,
    orbitRadius: 5,
    orbitSpeed: 0.002 * settings.accelerationOrbit,
    position: 100,
    mesh: null
  },
  {
    modelPath: '/images/mars/deimos.glb',
    scale: 0.1,
    orbitRadius: 9,
    orbitSpeed: 0.0005 * settings.accelerationOrbit,
    position: 120,
    mesh: null
  }
];

// Jupiter
const jupiterMoons = [
  {
    size: 1.6,
    texture: ioTexture,
    orbitRadius: 20,
    orbitSpeed: 0.0005 * settings.accelerationOrbit
  },
  {
    size: 1.4,
    texture: europaTexture,
    orbitRadius: 24,
    orbitSpeed: 0.00025 * settings.accelerationOrbit
  },
  {
    size: 2,
    texture: ganymedeTexture,
    orbitRadius: 28,
    orbitSpeed: 0.000125 * settings.accelerationOrbit
  },
  {
    size: 1.7,
    texture: callistoTexture,
    orbitRadius: 32,
    orbitSpeed: 0.00006 * settings.accelerationOrbit
  }
];

// ******  PLANET CREATIONS  ******
const mercury = new createPlanet('Mercury', 2.4, 40, 0, mercuryTexture, mercuryBump);
const venus = new createPlanet('Venus', 6.1, 65, 3, venusTexture, venusBump, null, venusAtmosphere);
const earth = new createPlanet('Earth', 6.4, 90, 23, earthMaterial, null, null, earthAtmosphere, earthMoon);
const mars = new createPlanet('Mars', 3.4, 115, 25, marsTexture, marsBump)
// Load Mars moons
marsMoons.forEach(moon => {
  loadObject(moon.modelPath, moon.position, moon.scale, function(loadedModel) {
    moon.mesh = loadedModel;
    mars.planetSystem.add(moon.mesh);
    moon.mesh.traverse(function (child) {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  });
});

const jupiter = new createPlanet('Jupiter', 69/4, 200, 3, jupiterTexture, null, null, null, jupiterMoons);
const saturn = new createPlanet('Saturn', 58/4, 270, 26, saturnTexture, null, {
  innerRadius: 18, 
  outerRadius: 29, 
  texture: satRingTexture
});
const uranus = new createPlanet('Uranus', 25/4, 320, 82, uranusTexture, null, {
  innerRadius: 6, 
  outerRadius: 8, 
  texture: uraRingTexture
});
const neptune = new createPlanet('Neptune', 24/4, 340, 28, neptuneTexture);
const pluto = new createPlanet('Pluto', 1, 350, 57, plutoTexture)

  // ******  PLANETS DATA  ******
  const planetData = {
    'Mercury': {
        radius: '2,439.7 km',
        tilt: '0.034°',
        rotation: '58.6 Earth days',
        orbit: '88 Earth days',
        distance: '57.9 million km',
        moons: '0',
        info: 'The smallest planet in our solar system and nearest to the Sun.'
    },
    'Venus': {
        radius: '6,051.8 km',
        tilt: '177.4°',
        rotation: '243 Earth days',
        orbit: '225 Earth days',
        distance: '108.2 million km',
        moons: '0',
        info: 'Second planet from the Sun, known for its extreme temperatures and thick atmosphere.'
    },
    'Earth': {
        radius: '6,371 km',
        tilt: '23.5°',
        rotation: '24 hours',
        orbit: '365 days',
        distance: '150 million km',
        moons: '1 (Moon)',
        info: 'Third planet from the Sun and the only known planet to harbor life.'
    },
    'Mars': {
        radius: '3,389.5 km',
        tilt: '25.19°',
        rotation: '1.03 Earth days',
        orbit: '687 Earth days',
        distance: '227.9 million km',
        moons: '2 (Phobos and Deimos)',
        info: 'Known as the Red Planet, famous for its reddish appearance and potential for human colonization.'
    },
    'Jupiter': {
        radius: '69,911 km',
        tilt: '3.13°',
        rotation: '9.9 hours',
        orbit: '12 Earth years',
        distance: '778.5 million km',
        moons: '95 known moons (Ganymede, Callisto, Europa, Io are the 4 largest)',
        info: 'The largest planet in our solar system, known for its Great Red Spot.'
    },
    'Saturn': {
        radius: '58,232 km',
        tilt: '26.73°',
        rotation: '10.7 hours',
        orbit: '29.5 Earth years',
        distance: '1.4 billion km',
        moons: '146 known moons',
        info: 'Distinguished by its extensive ring system, the second-largest planet in our solar system.'
    },
    'Uranus': {
        radius: '25,362 km',
        tilt: '97.77°',
        rotation: '17.2 hours',
        orbit: '84 Earth years',
        distance: '2.9 billion km',
        moons: '27 known moons',
        info: 'Known for its unique sideways rotation and pale blue color.'
    },
    'Neptune': {
        radius: '24,622 km',
        tilt: '28.32°',
        rotation: '16.1 hours',
        orbit: '165 Earth years',
        distance: '4.5 billion km',
        moons: '14 known moons',
        info: 'The most distant planet from the Sun in our solar system, known for its deep blue color.'
    },
    'Pluto': {
        radius: '1,188.3 km',
        tilt: '122.53°',
        rotation: '6.4 Earth days',
        orbit: '248 Earth years',
        distance: '5.9 billion km',
        moons: '5 (Charon, Styx, Nix, Kerberos, Hydra)',
        info: 'Originally classified as the ninth planet, Pluto is now considered a dwarf planet.'
    }
};

// Array of planets and atmospheres for raycasting
const raycastTargets = [
  mercury.planet, venus.planet, venus.Atmosphere, earth.planet, earth.Atmosphere, 
  mars.planet, jupiter.planet, saturn.planet, uranus.planet, neptune.planet, pluto.planet
];

// ******  SHADOWS  ******
renderer.shadowMap.enabled = true;
pointLight.castShadow = true;

//properties for the point light
pointLight.shadow.mapSize.width = 1024;
pointLight.shadow.mapSize.height = 1024;
pointLight.shadow.camera.near = 10;
pointLight.shadow.camera.far = 20;

//casting and receiving shadows
earth.planet.castShadow = true;
earth.planet.receiveShadow = true;
earth.Atmosphere.castShadow = true;
earth.Atmosphere.receiveShadow = true;
earth.moons.forEach(moon => {
moon.mesh.castShadow = true;
moon.mesh.receiveShadow = true;
});
mercury.planet.castShadow = true;
mercury.planet.receiveShadow = true;
venus.planet.castShadow = true;
venus.planet.receiveShadow = true;
venus.Atmosphere.receiveShadow = true;
mars.planet.castShadow = true;
mars.planet.receiveShadow = true;
jupiter.planet.castShadow = true;
jupiter.planet.receiveShadow = true;
jupiter.moons.forEach(moon => {
  moon.mesh.castShadow = true;
  moon.mesh.receiveShadow = true;
  });
saturn.planet.castShadow = true;
saturn.planet.receiveShadow = true;
saturn.Ring.receiveShadow = true;
uranus.planet.receiveShadow = true;
neptune.planet.receiveShadow = true;
pluto.planet.receiveShadow = true;



// -----------------------------
// 2️⃣ Danger logic + matching
// -----------------------------
function isAsteroidDangerous(riskItem) {
  const ipMax = riskItem["IP max"];
  const psMax = riskItem["PS max"];
  return ipMax >= 0.01 || psMax > -2;
}

const dangerousAsteroids = riskData
  .filter(isAsteroidDangerous)
  .map(a => a["Num/des."].toString());

console.log("Dangerous asteroids:", dangerousAsteroids);


function animate(){

  //rotating planets around the sun and itself
  sun.rotateY(0.001 * settings.acceleration);
  mercury.planet.rotateY(0.001 * settings.acceleration);
  mercury.planet3d.rotateY(0.004 * settings.accelerationOrbit);
  venus.planet.rotateY(0.0005 * settings.acceleration)
  venus.Atmosphere.rotateY(0.0005 * settings.acceleration);
  venus.planet3d.rotateY(0.0006 * settings.accelerationOrbit);
  earth.planet.rotateY(0.005 * settings.acceleration);
  earth.Atmosphere.rotateY(0.001 * settings.acceleration);
  earth.planet3d.rotateY(0.001 * settings.accelerationOrbit);
  mars.planet.rotateY(0.01 * settings.acceleration);
  mars.planet3d.rotateY(0.0007 * settings.accelerationOrbit);
  jupiter.planet.rotateY(0.005 * settings.acceleration);
  jupiter.planet3d.rotateY(0.0003 * settings.accelerationOrbit);
  saturn.planet.rotateY(0.01 * settings.acceleration);
  saturn.planet3d.rotateY(0.0002 * settings.accelerationOrbit);
  uranus.planet.rotateY(0.005 * settings.acceleration);
  uranus.planet3d.rotateY(0.0001 * settings.accelerationOrbit);
  neptune.planet.rotateY(0.005 * settings.acceleration);
  neptune.planet3d.rotateY(0.00008 * settings.accelerationOrbit);
  pluto.planet.rotateY(0.001 * settings.acceleration)
  pluto.planet3d.rotateY(0.00006 * settings.accelerationOrbit)

// Animate Earth's moon
if (earth.moons) {
  earth.moons.forEach(moon => {
    const time = performance.now();
    const tiltAngle = 5 * Math.PI / 180;

    const moonX = earth.planet.position.x + moon.orbitRadius * Math.cos(time * moon.orbitSpeed);
    const moonY = moon.orbitRadius * Math.sin(time * moon.orbitSpeed) * Math.sin(tiltAngle);
    const moonZ = earth.planet.position.z + moon.orbitRadius * Math.sin(time * moon.orbitSpeed) * Math.cos(tiltAngle);

    moon.mesh.position.set(moonX, moonY, moonZ);
    moon.mesh.rotateY(0.01);
  });
}
// Animate Mars' moons
if (marsMoons){
marsMoons.forEach(moon => {
  if (moon.mesh) {
    const time = performance.now();

    const moonX = mars.planet.position.x + moon.orbitRadius * Math.cos(time * moon.orbitSpeed);
    const moonY = moon.orbitRadius * Math.sin(time * moon.orbitSpeed);
    const moonZ = mars.planet.position.z + moon.orbitRadius * Math.sin(time * moon.orbitSpeed);

    moon.mesh.position.set(moonX, moonY, moonZ);
    moon.mesh.rotateY(0.001);
  }
});
}

// Animate Jupiter's moons
if (jupiter.moons) {
  jupiter.moons.forEach(moon => {
    const time = performance.now();
    const moonX = jupiter.planet.position.x + moon.orbitRadius * Math.cos(time * moon.orbitSpeed);
    const moonY = moon.orbitRadius * Math.sin(time * moon.orbitSpeed);
    const moonZ = jupiter.planet.position.z + moon.orbitRadius * Math.sin(time * moon.orbitSpeed);

    moon.mesh.position.set(moonX, moonY, moonZ);
    moon.mesh.rotateY(0.01);
  });
}

// ****** OUTLINES ON PLANETS ******
raycaster.setFromCamera(mouse, camera);

// Check for intersections
var intersects = raycaster.intersectObjects(raycastTargets);

// Reset all outlines
outlinePass.selectedObjects = [];

if (intersects.length > 0) {
  const intersectedObject = intersects[0].object;

  // If the intersected object is an atmosphere, find the corresponding planet
  if (intersectedObject === earth.Atmosphere) {
    outlinePass.selectedObjects = [earth.planet];
  } else if (intersectedObject === venus.Atmosphere) {
    outlinePass.selectedObjects = [venus.planet];
  } else {
    // For other planets, outline the intersected object itself
    outlinePass.selectedObjects = [intersectedObject];
  }
}
// ******  ZOOM IN/OUT  ******
if (isMovingTowardsPlanet) {
  // Smoothly move the camera towards the target position
  camera.position.lerp(targetCameraPosition, 0.03);

  // Check if the camera is close to the target position
  if (camera.position.distanceTo(targetCameraPosition) < 1) {
      isMovingTowardsPlanet = false;
      settings.accelerationOrbit = 1;
      showPlanetInfo(selectedPlanet.name);

  }
} else if (isZoomingOut) {
  camera.position.lerp(zoomOutTargetPosition, 0.05);

  if (camera.position.distanceTo(zoomOutTargetPosition) < 1) {
      isZoomingOut = false;
  }
}

  controls.update();
  requestAnimationFrame(animate);
  const delta = clock.getDelta();  // seconds since last frame
  const tFactor = settings.timeScale * settings.accelerationOrbit; // how fast sim time moves

  // Advance the simulation date (MJD) by tFactor * delta seconds
  simMJD += (delta * tFactor) / DAY_S;

  // Update the GUI string occasionally (or every frame; cheap enough)
  settings.simDateISO = mjdToDate(simMJD).toISOString().slice(0, 19) + 'Z';

  composer.render();
    visualAsteroids.forEach(ast => {
    // Increment mean anomaly
    ast.userData.meanAnomaly += ast.userData.orbitSpeed * settings.accelerationOrbit * delta;
    const e = ast.userData.elements.e;

    // Solve Kepler's equation to get eccentric anomaly
    const E = solveKepler(ast.userData.meanAnomaly, e);

    // Compute true anomaly
    const nu = 2 * Math.atan2(Math.sqrt(1+e)*Math.sin(E/2), Math.sqrt(1-e)*Math.cos(E/2));

    // Update position
    const pos = orbitalElementsToPosition(ast.userData.elements, nu);
    ast.position.copy(pos);

    // Optional: spin asteroid
    ast.rotation.y += 0.001;
});
}
animate();

window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('mousedown', onDocumentMouseDown, false);
window.addEventListener('resize', function(){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
  composer.setSize(window.innerWidth,window.innerHeight);
});