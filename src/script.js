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

function createAsteroidOrbitLine(elements, segments = 200) {
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
  const size = THREE.MathUtils.randFloat(1, 2);
  const geometry = createNoisyRock(size);
  const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const mesh = new THREE.Mesh(geometry, material);

  // ---- Kepler at epoch (giữ nguyên như cũ) ----
  const M = THREE.MathUtils.degToRad(elements["mean anomaly"]);
  const E = solveKepler(M, elements.e);
  const nu = 2 * Math.atan2(Math.sqrt(1+elements.e)*Math.sin(E/2), Math.sqrt(1-elements.e)*Math.cos(E/2));
  const position = orbitalElementsToPosition(elements, nu);
  mesh.position.copy(position);

  // ---- Gán định danh để match riskData ----
  const id = (elements.Name ?? elements["Num/des."] ?? "").toString();
  mesh.name = id || "Unnamed";

  // ---- Mặc định orbitSpeed cũ (random nhẹ) ----
  let orbitSpeed = 0.00005 + Math.random() * 0.0001;

  // ---- Nếu có risk → tính orbitSpeed từ Vel km/s ----
  const risk = riskById[id];
  if (risk) {
    const vRel = Number(risk["Vel km/s"]) || 0;
    const r_su = mesh.position.length();                 // bán kính quỹ đạo đang hiển thị (scene units)
    const omega = vrelToOmega(vRel, r_su);               // rad/s
    orbitSpeed = omega;                                  // dùng làm tốc độ góc

    // Tô màu theo PS cum
    const psCum = Number(risk["PS cum"]);
    if (psCum > 0) {
      mesh.material.color.setHex(0xff0000);
      mesh.material.emissive = new THREE.Color(0xaa0000);
      mesh.material.emissiveIntensity = 0.35;
    } else if (psCum > -1) {
      mesh.material.color.setHex(0xff7f00);
    } else if (psCum > -2) {
      mesh.material.color.setHex(0xffbf00);
    } else {
      mesh.material.color.setHex(0x00a2ff);
    }

    // Lưu metadata để hover/tooltip/legend
    mesh.userData.risk = {
      id, vRelKmps: vRel,
      psMax: risk["PS max"], psCum: risk["PS cum"],
      ipMax: risk["IP max"], ipCum: risk["IP cum"],
      date: risk["Date/Time"], years: risk["Years"]
    };
  }

  // ---- Lưu lại để animate ----
  mesh.userData = {
    ...mesh.userData,
    elements,
    meanAnomaly: M,
    eccentricAnomaly: E,
    orbitSpeed                    // <-- giờ đã là omega (rad/s) nếu có risk
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
  timeScale: TIME_SCALE
};

gui.add(settings, 'accelerationOrbit', 0, 10).onChange(value => {
});
gui.add(settings, 'acceleration', 0, 10).onChange(value => {
});
gui.add(settings, 'sunIntensity', 1, 10).onChange(value => {
  sunMat.emissiveIntensity = value;
});
gui.add(settings, 'timeScale', 1e4, 2e6).onChange(v => { TIME_SCALE = v; });


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
  info.style.display = 'none';
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
const asteroidElements = [
    {
      "Name": "433",
      "Epoch(MJD)": 61000.0,
      "a": 1.458120999506171,
      "e": 0.22283594601507883,
      "i": 10.828468305381943,
      "long. node": 304.27008647666185,
      "arg. peric.": 178.92977480134164,
      "mean anomaly": 310.5543217456213,
      "absolute magnitude": 10.83,
      "slope param": 0.46,
      "non-grav param": 0.0
    },
    {
      "Name": "719",
      "Epoch(MJD)": 61000.0,
      "a": 2.6365903926527463,
      "e": 0.5465957998814123,
      "i": 11.573112309302102,
      "long. node": 183.86097652162428,
      "arg. peric.": 156.18939590382544,
      "mean anomaly": 240.61027373981472,
      "absolute magnitude": 15.59,
      "slope param": 0.15,
      "non-grav param": 0.0
    },
    {
      "Name": "887",
      "Epoch(MJD)": 61000.0,
      "a": 2.473628779117842,
      "e": 0.5711699796054409,
      "i": 9.400059649057418,
      "long. node": 110.40587020339058,
      "arg. peric.": 350.5345082242698,
      "mean anomaly": 81.54059287446157,
      "absolute magnitude": 13.41,
      "slope param": -0.12,
      "non-grav param": 0.0
    },
    {
      "Name": "1036",
      "Epoch(MJD)": 61000.0,
      "a": 2.664968843719615,
      "e": 0.5332132821051266,
      "i": 26.68073815746113,
      "long. node": 215.4411761752794,
      "arg. peric.": 132.5031283117107,
      "mean anomaly": 97.59385210593904,
      "absolute magnitude": 9.42,
      "slope param": 0.3,
      "non-grav param": 0.0
    },
    {
      "Name": "1221",
      "Epoch(MJD)": 61000.0,
      "a": 1.9198312596733018,
      "e": 0.4346323443728749,
      "i": 11.868824208523039,
      "long. node": 171.2371784750223,
      "arg. peric.": 26.758232224476295,
      "mean anomaly": 59.8704883740864,
      "absolute magnitude": 17.48,
      "slope param": 0.15,
      "non-grav param": 1.0
    },
    {
      "Name": "1566",
      "Epoch(MJD)": 61000.0,
      "a": 1.0780378365881251,
      "e": 0.8270056950392995,
      "i": 22.803209459601593,
      "long. node": 87.9524222424455,
      "arg. peric.": 31.438211624784284,
      "mean anomaly": 153.0789340502513,
      "absolute magnitude": 16.53,
      "slope param": 0.15,
      "non-grav param": 1.0
    },
    {
      "Name": "1580",
      "Epoch(MJD)": 61000.0,
      "a": 2.194974311417404,
      "e": 0.48760449969698316,
      "i": 52.18784240299455,
      "long. node": 62.22484446727139,
      "arg. peric.": 159.71705898987912,
      "mean anomaly": 80.2671788024341,
      "absolute magnitude": 14.41,
      "slope param": 0.0,
      "non-grav param": 0.0
    },
    {
      "Name": "1620",
      "Epoch(MJD)": 61000.0,
      "a": 1.2457769317898977,
      "e": 0.33551220254788233,
      "i": 13.335799031675021,
      "long. node": 337.14079624981224,
      "arg. peric.": 277.0183847246366,
      "mean anomaly": 212.92043907640672,
      "absolute magnitude": 15.19,
      "slope param": 0.15,
      "non-grav param": 0.0
    },
    {
      "Name": "1627",
      "Epoch(MJD)": 61000.0,
      "a": 1.863058083818032,
      "e": 0.3973228594998501,
      "i": 8.456294008481485,
      "long. node": 133.07464261001286,
      "arg. peric.": 167.83957695383086,
      "mean anomaly": 311.46100501539354,
      "absolute magnitude": 13.23,
      "slope param": 0.6,
      "non-grav param": 0.0
    },
    {
      "Name": "1685",
      "Epoch(MJD)": 61000.0,
      "a": 1.367838675348063,
      "e": 0.43604874426849216,
      "i": 9.381838169400266,
      "long. node": 274.20773766495824,
      "arg. peric.": 127.27531252931306,
      "mean anomaly": 82.6816306489443,
      "absolute magnitude": 14.31,
      "slope param": 0.15,
      "non-grav param": 1.0
    },
    {
      "Name": "1862",
      "Epoch(MJD)": 61000.0,
      "a": 1.4709238009878445,
      "e": 0.5599179890673649,
      "i": 6.351395187437802,
      "long. node": 35.541633413239644,
      "arg. peric.": 286.050885529785,
      "mean anomaly": 113.88453720578651,
      "absolute magnitude": 16.1,
      "slope param": 0.09,
      "non-grav param": 1.0
    },
    {
      "Name": "1863",
      "Epoch(MJD)": 61000.0,
      "a": 2.26011581655056,
      "e": 0.6062664732871065,
      "i": 18.37865547581152,
      "long. node": 345.5512135580062,
      "arg. peric.": 269.07454245761545,
      "mean anomaly": 289.5644847842388,
      "absolute magnitude": 15.41,
      "slope param": 0.15,
      "non-grav param": 0.0
    },
    {
      "Name": "1864",
      "Epoch(MJD)": 61000.0,
      "a": 1.460839442960927,
      "e": 0.6144458371232455,
      "i": 22.216868870659873,
      "long. node": 6.596996628808989,
      "arg. peric.": 325.6617982434088,
      "mean anomaly": 257.570843952816,
      "absolute magnitude": 14.81,
      "slope param": 0.15,
      "non-grav param": 0.0
    },
    {
      "Name": "1865",
      "Epoch(MJD)": 61000.0,
      "a": 1.0799733837324959,
      "e": 0.46686046594392006,
      "i": 16.10114595643584,
      "long. node": 212.88454623240477,
      "arg. peric.": 325.2894412381485,
      "mean anomaly": 319.67477451747055,
      "absolute magnitude": 16.73,
      "slope param": 0.15,
      "non-grav param": 1.0
    },
    {
      "Name": "1866",
      "Epoch(MJD)": 61000.0,
      "a": 1.8933719415280073,
      "e": 0.5381207017123874,
      "i": 41.20631818869814,
      "long. node": 63.44668344780533,
      "arg. peric.": 293.09863395874635,
      "mean anomaly": 140.66424150424692,
      "absolute magnitude": 12.47,
      "slope param": 0.15,
      "non-grav param": 0.0
    },
    {
      "Name": "1915",
      "Epoch(MJD)": 61000.0,
      "a": 2.5448411770322803,
      "e": 0.5702246156919025,
      "i": 20.39923198348801,
      "long. node": 162.92164295069637,
      "arg. peric.": 347.7552335475133,
      "mean anomaly": 21.616518383131375,
      "absolute magnitude": 18.8,
      "slope param": 0.1,
      "non-grav param": 0.0
    },
    {
      "Name": "1916",
      "Epoch(MJD)": 61000.0,
      "a": 2.2726664566757226,
      "e": 0.44917615221265306,
      "i": 12.877115972155643,
      "long. node": 340.59538089555343,
      "arg. peric.": 335.8547818300756,
      "mean anomaly": 35.111286257875456,
      "absolute magnitude": 14.97,
      "slope param": 0.15,
      "non-grav param": 0.0
    },
    {
      "Name": "1917",
      "Epoch(MJD)": 61000.0,
      "a": 2.149051310342094,
      "e": 0.5055378485745342,
      "i": 23.958776685519528,
      "long. node": 188.2748781439588,
      "arg. peric.": 194.5525806090499,
      "mean anomaly": 160.0895145922736,
      "absolute magnitude": 14.39,
      "slope param": 0.15,
      "non-grav param": 0.0
    },
    {
      "Name": "1943",
      "Epoch(MJD)": 61000.0,
      "a": 1.4305268293371174,
      "e": 0.2559124835463438,
      "i": 8.707709228878453,
      "long. node": 246.2935053939628,
      "arg. peric.": 338.4365858205865,
      "mean anomaly": 260.37411624106034,
      "absolute magnitude": 15.7,
      "slope param": 0.15,
      "non-grav param": 0.0
    },
    {
      "Name": "1980",
      "Epoch(MJD)": 61000.0,
      "a": 1.7093942043849362,
      "e": 0.36470582264664675,
      "i": 26.86994216255578,
      "long. node": 246.54264055707145,
      "arg. peric.": 115.47249206867848,
      "mean anomaly": 211.4954153418843,
      "absolute magnitude": 13.8,
      "slope param": 0.15,
      "non-grav param": 0.0
    },
    {
      "Name": "1981",
      "Epoch(MJD)": 61000.0,
      "a": 1.7762715059614254,
      "e": 0.6504955759732763,
      "i": 39.82338336270372,
      "long. node": 356.7939191458197,
      "arg. peric.": 267.8442343699835,
      "mean anomaly": 65.34754312393206,
      "absolute magnitude": 15.29,
      "slope param": 0.15,
      "non-grav param": 0.0
    },
    {
      "Name": "2059",
      "Epoch(MJD)": 61000.0,
      "a": 2.641826221246664,
      "e": 0.5315840522686455,
      "i": 11.020858628854743,
      "long. node": 200.69134971959113,
      "arg. peric.": 192.45596381275297,
      "mean anomaly": 143.16190080130897,
      "absolute magnitude": 15.99,
      "slope param": 0.15,
      "non-grav param": 0.0
    },
    {
      "Name": "2061",
      "Epoch(MJD)": 61000.0,
      "a": 2.265256669168391,
      "e": 0.5355996733010038,
      "i": 3.8004736908229777,
      "long. node": 207.35034087929995,
      "arg. peric.": 157.10640569802723,
      "mean anomaly": 38.88742429900803,
      "absolute magnitude": 16.62,
      "slope param": 0.15,
      "non-grav param": 0.0
    },
    {
      "Name": "2062",
      "Epoch(MJD)": 61000.0,
      "a": 0.9669585133422667,
      "e": 0.1828994411207176,
      "i": 18.935546626991957,
      "long. node": 108.52821134725323,
      "arg. peric.": 148.07631653420833,
      "mean anomaly": 32.63777993081371,
      "absolute magnitude": 17.09,
      "slope param": 0.15,
      "non-grav param": 1.0
    },
    {
      "Name": "2063",
      "Epoch(MJD)": 61000.0,
      "a": 1.0779986359895872,
      "e": 0.34942910507607483,
      "i": 9.434703941141665,
      "long. node": 33.036312684105894,
      "arg. peric.": 55.3507188556601,
      "mean anomaly": 234.78701502710763,
      "absolute magnitude": 17.27,
      "slope param": 0.15,
      "non-grav param": 1.0
    }
];


const orbitalData = [
  {
    "Name": "433",
    "a": 1.4581,
    "e": 0.2228,
    "i": 10.8284,
    "long. node": 304.2700,
    "arg. peric.": 178.9297,
    "mean anomaly": 310.5543
  },
  {
    "Name": "2023VD3",
    "a": 1.1,
    "e": 0.15,
    "i": 5.0,
    "long. node": 220.5,
    "arg. peric.": 110.0,
    "mean anomaly": 250.0
  },
  {
    "Name": "2001AB",
    "a": 1.9,
    "e": 0.1,
    "i": 15,
    "long. node": 180,
    "arg. peric.": 45,
    "mean anomaly": 10
  }
];

// const riskData = [
//   {
//     "Num/des.": "2023VD3",
//     "Name": null,
//     "m": 14.0,
//     "*=Y": "*",
//     "Date/Time": "2034-11-08T17:08:00Z",
//     "IP max": 0.00235,
//     "PS max": -2.67,
//     "TS": 0,
//     "Vel km/s": 21.01,
//     "Years": "2034-2039",
//     "IP cum": 0.00235,
//     "PS cum": -2.67
//   },
//   {
//     "Num/des.": "2008JL3",
//     "Name": null,
//     "m": 30.0,
//     "*=Y": "*",
//     "Date/Time": "2027-05-01T09:05:00Z",
//     "IP max": 0.000149,
//     "PS max": -2.73,
//     "TS": 0,
//     "Vel km/s": 14.01,
//     "Years": "2027-2122",
//     "IP cum": 0.000161,
//     "PS cum": -2.73
//   }
// ];

let riskData = [];

async function loadRiskData() {
  try {
    const response = await fetch("esa_risk_list_0.json");
    if (!response.ok) throw new Error("Failed to fetch JSON file");

    const json = await response.json();

    // ✅ Không map, không đổi key — lấy nguyên gốc:
    if (json && Array.isArray(json.data)) {
      riskData = json.data;
    } else {
      console.warn("⚠️ JSON file does not contain a valid 'data' array.");
      riskData = [];
    }

    console.log("✅ Loaded riskData:", riskData);
  } catch (err) {
    console.error("❌ Failed to load risk data:", err);
  }
}

const riskById = Object.fromEntries(
  riskData.map(r => [r["Num/des."].toString(), r])
);

// Add asteroids and orbits
    const visualAsteroids = asteroidElements.map(el => {
    const orbitLine = createAsteroidOrbitLine(el);
    scene.add(orbitLine);

    return createAsteroidMesh(el);
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
  return ipMax >= 1e-4 || psMax > -2;
}

const dangerousAsteroids = riskData
  .filter(isAsteroidDangerous)
  .map(a => a["Num/des."].toString());

console.log("Dangerous asteroids:", dangerousAsteroids);

// -----------------------------
// 3️⃣ Orbit + mesh creation
// -----------------------------
function createAsteroidWithOrbit(el) {
  const id = el.Name?.toString();
  const isDanger = dangerousAsteroids.includes(id);

  //  Create orbit line (red = danger, yellow = safe)
  let color = isDanger ? 0xff0000 : 0xffff00;
  const orbitLine = createAsteroidOrbitLine(el);
  orbitLine.material.color.setHex(color);
  scene.add(orbitLine);

  //  Create asteroid mesh
  const mesh = createAsteroidMesh(el);
  if (isDanger) {
    mesh.material.color.setHex(0xff4444);
    mesh.material.emissive = new THREE.Color(0xff0000);
    mesh.material.emissiveIntensity = 0.3;
  }

  return { mesh, orbitLine };
}

// -----------------------------
// 4️⃣ Add asteroids to scene
// -----------------------------
const asteroidObjects = orbitalData.map(el => createAsteroidWithOrbit(el));

function updateAsteroidOrbit(mesh, deltaTime = 1, accelerationOrbit = 1) {
  const data = mesh.userData;
  if (!data || !data.elements) return;

  const { elements, orbitSpeed } = data;
  const e = elements.e;

  // advance mean anomaly (apply global speed factor)
  data.meanAnomaly += orbitSpeed * deltaTime * accelerationOrbit;

  // solve Kepler’s Equation again to get new eccentric anomaly
  const E = solveKepler(data.meanAnomaly, e);
  data.eccentricAnomaly = E;

  // get new true anomaly
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );

  // convert to XYZ and update position
  const pos = orbitalElementsToPosition(elements, nu);
  mesh.position.copy(pos);
}


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
  composer.render();

    visualAsteroids.forEach(ast => {
    const e = ast.userData.elements.e;
    const a = ast.userData.elements.a;

    // Increment mean anomaly
    ast.userData.meanAnomaly += ast.userData.orbitSpeed * settings.accelerationOrbit;

    // Solve Kepler's equation to get eccentric anomaly
    const E = solveKepler(ast.userData.meanAnomaly, e);

    // Compute true anomaly
    const nu = 2 * Math.atan2(Math.sqrt(1+e)*Math.sin(E/2), Math.sqrt(1-e)*Math.cos(E/2));

    // Update position
    const pos = orbitalElementsToPosition(ast.userData.elements, nu);
    ast.position.copy(pos);

    // Optional: spin asteroid
    ast.rotation.y += 0.001;

    asteroidObjects.forEach(({ mesh }) => {
    mesh.rotation.y += 0.01;
  });
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
