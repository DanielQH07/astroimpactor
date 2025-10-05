// Simple trajectory visualization system for asteroid defense
// Works directly with globe.gl and Three.js

// Global trajectory variables
let asteroidTrajectoryLine = null;
let asteroidTrajectoryGeom = null;
let asteroidTrajectoryMat = null;

// Function to create simple asteroid trajectory
function createAsteroidTrajectory(scene) {
    console.log('Creating asteroid trajectory line...');
    
    asteroidTrajectoryGeom = new THREE.BufferGeometry();
    asteroidTrajectoryMat = new THREE.LineBasicMaterial({
        color: 0xff0044,      // Bright pink for visibility
        transparent: true,
        opacity: 1.0,
        depthTest: false,     // Always render on top
        depthWrite: false,    // Don't write to depth buffer
        linewidth: 1
    });
    
    asteroidTrajectoryLine = new THREE.Line(asteroidTrajectoryGeom, asteroidTrajectoryMat);
    asteroidTrajectoryLine.visible = false;
    asteroidTrajectoryLine.renderOrder = 1000;  // High render priority
    
    scene.add(asteroidTrajectoryLine);
    
    // Make globally accessible
    window.asteroidTrajectoryLine = asteroidTrajectoryLine;
    window.asteroidTrajectoryGeom = asteroidTrajectoryGeom;
    window.asteroidTrajectoryMat = asteroidTrajectoryMat;
    
    console.log('Asteroid trajectory line created and added to scene');
}

// Function to update asteroid trajectory
function updateSimpleTrajectory(objects) {
    if (!asteroidTrajectoryLine || !objects) {
        console.log('Trajectory line or objects not available');
        return;
    }
    
    const asteroid = objects.find(obj => obj.type === 'asteroid');
    if (!asteroid) {
        asteroidTrajectoryLine.visible = false;
        console.log('No asteroid found, hiding trajectory');
        return;
    }
    
    console.log('Updating trajectory for asteroid at:', {
        lng: asteroid.lng.toFixed(3),
        lat: asteroid.lat.toFixed(3), 
        alt: asteroid.altitude.toFixed(3)
    });
    
    // Convert lng/lat to 3D position
    const toRad = Math.PI / 180;
    const φ = asteroid.lat * toRad;
    const λ = asteroid.lng * toRad;
    const radius = asteroid.altitude + 1;
    
    const asteroidPos = new THREE.Vector3(
        Math.cos(φ) * Math.cos(λ) * radius,
        Math.sin(φ) * radius,
        Math.cos(φ) * Math.sin(λ) * radius
    );
    
    // Create trajectory direction (away from Earth center)
    const earthCenter = new THREE.Vector3(0, 0, 0);
    const direction = asteroidPos.clone().sub(earthCenter).normalize();
    
    // Create trajectory line points
    const trajectoryLength = 20;  // Line extends 20 units
    const startDistance = 15;     // Start 15 units behind asteroid
    
    const startPoint = asteroidPos.clone().add(direction.clone().multiplyScalar(-startDistance));
    const endPoint = asteroidPos.clone().add(direction.clone().multiplyScalar(5));
    
    // Create line with 3 points for better visibility
    const points = [
        startPoint.x, startPoint.y, startPoint.z,
        asteroidPos.x, asteroidPos.y, asteroidPos.z,  // Through asteroid
        endPoint.x, endPoint.y, endPoint.z
    ];
    
    // Update geometry
    const positionArray = new THREE.Float32BufferAttribute(points, 3);
    asteroidTrajectoryGeom.setAttribute('position', positionArray);
    asteroidTrajectoryGeom.computeBoundingSphere();
    
    // Show trajectory
    asteroidTrajectoryLine.visible = true;
    
    console.log('Trajectory updated with', points.length / 3, 'points');
    console.log('Trajectory bounding sphere radius:', asteroidTrajectoryGeom.boundingSphere?.radius);
}

// Function to change trajectory color (for deflection indication)
function setTrajectoryColor(hexColor) {
    if (asteroidTrajectoryMat) {
        asteroidTrajectoryMat.color.setHex(hexColor);
        console.log('Trajectory color changed to:', hexColor.toString(16));
    }
}

// Function to hide/show trajectory
function toggleTrajectoryVisibility() {
    if (asteroidTrajectoryLine) {
        asteroidTrajectoryLine.visible = !asteroidTrajectoryLine.visible;
        console.log('Trajectory visibility:', asteroidTrajectoryLine.visible);
        return asteroidTrajectoryLine.visible;
    }
    return false;
}

// Make functions globally available
window.createAsteroidTrajectory = createAsteroidTrajectory;
window.updateSimpleTrajectory = updateSimpleTrajectory;
window.setTrajectoryColor = setTrajectoryColor;
window.toggleTrajectoryVisibility = toggleTrajectoryVisibility;