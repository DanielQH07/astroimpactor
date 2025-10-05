// visual.js - Enhanced trajectory visualization for asteroid defense system
import {
    Vector3,
    BufferGeometry,
    LineBasicMaterial,
    Float32BufferAttribute,
    Line,
    AdditiveBlending
} from 'https://esm.sh/three';

// Store references to trajectory visualization elements
let trajectoryLine = null;
let trajectoryGeom = null;
let trajectoryMat = null;
let trajectoryGlowLine = null;
let trajectoryGlowGeom = null;
let trajectoryGlowMat = null;

/**
 * Creates a trajectory visualization system for asteroids
 * @param {Object} scene - The Three.js scene to add the trajectory to
 */
export function createAsteroidTrajectory(scene) {
    // Create main trajectory line geometry
    trajectoryGeom = new BufferGeometry();
    trajectoryMat = new LineBasicMaterial({
        color: 0xff0044, // Default red color for danger
        transparent: true,
        opacity: 0.8,
        linewidth: 2, // Note: Limited by WebGL, may not appear thicker on all systems
        depthTest: false,
        depthWrite: false
    });
    
    trajectoryLine = new Line(trajectoryGeom, trajectoryMat);
    trajectoryLine.visible = true;
    trajectoryLine.renderOrder = 1000; // Ensure it renders on top
    
    // Add glow effect for better visibility
    trajectoryGlowGeom = new BufferGeometry();
    trajectoryGlowMat = new LineBasicMaterial({
        color: 0xff0044,
        transparent: true,
        opacity: 0.4,
        linewidth: 4, // Thicker for glow effect
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false
    });
    
    trajectoryGlowLine = new Line(trajectoryGlowGeom, trajectoryGlowMat);
    trajectoryGlowLine.visible = true;
    trajectoryGlowLine.renderOrder = 999; // Just behind main line
    
    // Add both lines to scene
    scene.add(trajectoryLine);
    scene.add(trajectoryGlowLine);
    
    console.log('Enhanced asteroid trajectory visualization system created');
}

/**
 * Updates the asteroid trajectory visualization
 * @param {Object} asteroidObj - The asteroid object
 * @param {Vector3} directionVector - Direction vector of asteroid movement
 * @param {Boolean} isDeflected - Whether asteroid has been deflected
 */
export function updateAsteroidTrajectory(asteroidObj, directionVector, isDeflected = false) {
    if (!trajectoryLine || !trajectoryGlowLine) return;
    
    if (!asteroidObj) {
        trajectoryLine.visible = false;
        trajectoryGlowLine.visible = false;
        return;
    }
    
    // Convert asteroid position to 3D vector
    const toRad = Math.PI / 180;
    const φ = asteroidObj.lat * toRad;
    const λ = asteroidObj.lng * toRad;
    const radius = asteroidObj.altitude + 1;
    
    const asteroidPos = new Vector3(
        Math.cos(φ) * Math.cos(λ) * radius,
        Math.sin(φ) * radius,
        Math.cos(φ) * Math.sin(λ) * radius
    );
    
    // Create trajectory points - extend far ahead to show path clearly
    const trajectoryLength = 30; // Length of visible trajectory
    const segments = 60;       // Smoothness of line
    const points = [];
    
    // Create starting point behind asteroid for visual clarity
    const backwardPoint = asteroidPos.clone().sub(directionVector.clone().normalize().multiplyScalar(2));
    points.push(backwardPoint.x, backwardPoint.y, backwardPoint.z);
    
    // Add current position
    points.push(asteroidPos.x, asteroidPos.y, asteroidPos.z);
    
    // Calculate future path points
    for (let i = 1; i <= segments; i++) {
        const t = (i / segments) * trajectoryLength;
        const futurePos = asteroidPos.clone().add(directionVector.clone().normalize().multiplyScalar(t));
        points.push(futurePos.x, futurePos.y, futurePos.z);
    }
    
    // Update line geometries
    const positionArray = new Float32BufferAttribute(points, 3);
    trajectoryGeom.setAttribute('position', positionArray);
    trajectoryGeom.computeBoundingSphere();
    
    // Update glow effect
    trajectoryGlowGeom.setAttribute('position', positionArray.clone());
    trajectoryGlowGeom.computeBoundingSphere();
    
    // Set colors based on deflection status
    setTrajectoryColor(isDeflected ? 0x00ff00 : 0xff0044);
    
    // Ensure trajectory is visible
    trajectoryLine.visible = true;
    trajectoryGlowLine.visible = true;
}

/**
 * Sets the color of the trajectory visualization
 * @param {Number} hexColor - The color in hexadecimal format
 */
export function setTrajectoryColor(hexColor) {
    if (trajectoryMat) {
        trajectoryMat.color.setHex(hexColor);
    }
    if (trajectoryGlowMat) {
        trajectoryGlowMat.color.setHex(hexColor);
    }
    console.log('Trajectory color changed to:', hexColor.toString(16));
}

/**
 * Toggles the visibility of the asteroid trajectory
 */
export function toggleTrajectoryVisibility() {
    if (trajectoryLine) {
        trajectoryLine.visible = !trajectoryLine.visible;
        trajectoryGlowLine.visible = !trajectoryGlowLine.visible;
        return trajectoryLine.visible;
    }
    return false;
}

// Export functions for global access
export default {
    createAsteroidTrajectory,
    updateAsteroidTrajectory,
    setTrajectoryColor,
    toggleTrajectoryVisibility
};