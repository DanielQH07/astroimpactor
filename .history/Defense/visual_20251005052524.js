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
    // Create main trajectory line geometry with higher detail
    trajectoryGeom = new BufferGeometry();
    trajectoryMat = new LineBasicMaterial({
        color: 0xff0044, // Default red color for danger
        transparent: true,
        opacity: 0.8,
        linewidth: 3, // Increased width (limited by WebGL but we try)
        depthTest: false,
        depthWrite: false
    });
    
    trajectoryLine = new Line(trajectoryGeom, trajectoryMat);
    trajectoryLine.visible = true;
    trajectoryLine.renderOrder = 1000; // Ensure it renders on top of everything
    
    // Add glow effect for better visibility with additive blending
    trajectoryGlowGeom = new BufferGeometry();
    trajectoryGlowMat = new LineBasicMaterial({
        color: 0xff0044,
        transparent: true,
        opacity: 0.4,
        linewidth: 6, // Significantly thicker for better glow effect
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
    
    console.log('Enhanced asteroid trajectory visualization system with realistic physics created');
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
    
    // Create trajectory points showing actual path
    const trajectoryLength = 30; // Length of visible trajectory
    const pastLength = 10;      // Length behind asteroid
    const segments = 80;        // Increased smoothness
    const points = [];
    
    // Calculate Earth center for gravity calculations
    const earthCenter = new Vector3(0, 0, 0);
    const earthRadius = 1;      // Earth radius in units
    
    // Calculate past trajectory points (behind asteroid)
    for (let i = pastLength; i > 0; i--) {
        const t = i * 0.5; // Distance behind
        
        // Reverse direction for past points
        const pastDir = directionVector.clone().negate().normalize();
        
        // Create slightly curved path for past trajectory using gravity influence
        const pastPos = asteroidPos.clone();
        
        // Move backward along direction
        pastPos.add(pastDir.clone().multiplyScalar(t));
        
        // Apply a slight curve toward Earth to simulate gravity
        const toEarth = earthCenter.clone().sub(pastPos).normalize();
        const gravitationalCurve = toEarth.multiplyScalar(0.05 * t); // Subtle gravity curve
        pastPos.add(gravitationalCurve);
        
        points.push(pastPos.x, pastPos.y, pastPos.z);
    }
    
    // Add current position
    points.push(asteroidPos.x, asteroidPos.y, asteroidPos.z);
    
    // Calculate future path points with gravity influence
    for (let i = 1; i <= segments; i++) {
        const t = (i / segments) * trajectoryLength;
        
        // Start with linear projection
        const futurePos = asteroidPos.clone().add(directionVector.clone().normalize().multiplyScalar(t));
        
        if (!isDeflected) {
            // For non-deflected asteroids, curve more toward Earth (will impact)
            const distanceToEarth = futurePos.length();
            const toEarthCenter = earthCenter.clone().sub(futurePos).normalize();
            
            // Gravitational influence increases as asteroid gets closer to Earth
            const gravityFactor = Math.max(0, (1.8 - distanceToEarth) * 0.1);
            const gravity = toEarthCenter.multiplyScalar(t * gravityFactor);
            
            futurePos.add(gravity);
        } else {
            // For deflected asteroids, show path curving away from Earth
            const distanceToEarth = futurePos.length();
            const awayFromEarth = futurePos.clone().sub(earthCenter).normalize();
            
            // Subtle curve away from Earth
            const deflectionFactor = Math.min(0.08, t * 0.003);
            const deflection = awayFromEarth.multiplyScalar(t * deflectionFactor);
            
            futurePos.add(deflection);
        }
        
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
    
    // Calculate if asteroid will hit Earth for visual emphasis
    const willHitEarth = checkIfWillHitEarth(asteroidPos, directionVector, isDeflected);
    
    // Make the trajectory more prominent if it will hit Earth
    if (willHitEarth && !isDeflected) {
        trajectoryMat.opacity = 0.9;  // More visible
        trajectoryGlowMat.opacity = 0.5;
    } else {
        trajectoryMat.opacity = isDeflected ? 0.8 : 0.7;  // Normal visibility
        trajectoryGlowMat.opacity = isDeflected ? 0.4 : 0.3;
    }
    
    // Ensure trajectory is visible
    trajectoryLine.visible = true;
    trajectoryGlowLine.visible = true;
    
    console.log('Asteroid trajectory updated with realistic gravity path');
}

/**
 * Check if asteroid will hit Earth based on its trajectory
 * @param {Vector3} position - Current asteroid position
 * @param {Vector3} direction - Direction vector
 * @param {Boolean} isDeflected - If the asteroid has been deflected
 * @return {Boolean} - True if asteroid will hit Earth
 */
function checkIfWillHitEarth(position, direction, isDeflected) {
    if (isDeflected) return false; // Deflected asteroids won't hit
    
    // Earth radius with atmosphere buffer
    const earthRadiusWithBuffer = 1.05;
    
    // Sample points along future trajectory
    const samples = 30;
    const checkDistance = 25; 
    
    for (let i = 1; i <= samples; i++) {
        const t = (i / samples) * checkDistance;
        
        // Basic linear projection
        const testPos = position.clone().add(direction.clone().normalize().multiplyScalar(t));
        
        // Add gravitational curving (simplified physics)
        const distanceToEarth = testPos.length();
        if (distanceToEarth > 5) continue; // Skip distant points
        
        const toEarth = new Vector3(0, 0, 0).sub(testPos).normalize();
        const gravityFactor = Math.max(0, (2 - distanceToEarth) * 0.1);
        testPos.add(toEarth.multiplyScalar(t * gravityFactor));
        
        // Check final position against Earth
        const finalDistance = testPos.length();
        if (finalDistance < earthRadiusWithBuffer) {
            return true; // Will hit Earth
        }
    }
    
    return false; // No hit detected
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