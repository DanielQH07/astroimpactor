// visual.js - Asteroid Defense Game System
import {
    Vector3,
    MeshBasicMaterial,
    Mesh,
    SphereGeometry,
    CylinderGeometry,
    AdditiveBlending,
    Color,
    SpriteMaterial,
    Sprite,
    CanvasTexture,
    Group
} from 'https://esm.sh/three';

// Game state variables
let gameActive = false;
let hitPoints = 0;
let requiredHits = 3; // Number of successful hits required to deflect
let gameMessage = ""; // Current game message

// Laser impact effect storage
let laserImpactEffects = [];

/**
 * Initializes the asteroid defense game system
 * @param {Object} scene - The Three.js scene to add the effects to
 */
export function initializeDefenseSystem(scene) {
    // No trajectory lines needed since they don't display properly
    
    // Reset game state
    hitPoints = 0;
    gameActive = false;
    
    // Clear any existing effects
    laserImpactEffects.forEach(effect => {
        if (effect && effect.parent) {
            effect.parent.remove(effect);
        }
    });
    laserImpactEffects = [];
    
    console.log('Asteroid defense game system initialized');
    
    // Return initial game state
    return {
        active: gameActive,
        hits: hitPoints,
        required: requiredHits
    };
}

/**
 * Creates a laser impact effect at a specific position
 * @param {Object} scene - The Three.js scene
 * @param {Vector3} position - Impact position
 * @param {Number} power - Laser power (0-100)
 * @returns {Object} - Impact effect group
 */
export function createLaserImpact(scene, position, power = 50) {
    // Scale effect size based on power
    const scaleFactor = 0.3 + (power / 100) * 0.7;
    
    // Create impact effect group
    const impactGroup = new Group();
    impactGroup.position.copy(position);
    
    // Core flash (bright center)
    const coreGeom = new SphereGeometry(0.15 * scaleFactor, 8, 8);
    const coreMat = new MeshBasicMaterial({
        color: 0xffff99,
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending
    });
    const core = new Mesh(coreGeom, coreMat);
    impactGroup.add(core);
    
    // Outer glow
    const glowGeom = new SphereGeometry(0.3 * scaleFactor, 16, 16);
    const glowMat = new MeshBasicMaterial({
        color: 0xff3300,
        transparent: true,
        opacity: 0.7,
        blending: AdditiveBlending
    });
    const glow = new Mesh(glowGeom, glowMat);
    impactGroup.add(glow);
    
    // Sprite for additional glow effect
    const spriteMap = createGlowTexture(64, 'rgba(255,255,200,0.9)', 'rgba(255,50,0,0)');
    const spriteMat = new SpriteMaterial({
        map: spriteMap,
        transparent: true,
        blending: AdditiveBlending
    });
    const sprite = new Sprite(spriteMat);
    sprite.scale.set(1.2 * scaleFactor, 1.2 * scaleFactor, 1);
    impactGroup.add(sprite);
    
    // Add to scene
    scene.add(impactGroup);
    laserImpactEffects.push(impactGroup);
    
    // Animate impact effect and then remove
    const startTime = Date.now();
    const duration = 800 + (power * 10); // Longer duration for higher power
    
    // Animation function
    function animateImpact() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1.0, elapsed / duration);
        
        if (progress < 1.0) {
            // Pulsing effect
            const pulseScale = 1 + 0.3 * Math.sin(progress * Math.PI * 8);
            
            // Scale down over time
            const fadeScale = 1 - (progress * 0.5);
            
            core.scale.set(pulseScale * fadeScale, pulseScale * fadeScale, pulseScale * fadeScale);
            glow.scale.set(1 + (progress * 0.5), 1 + (progress * 0.5), 1 + (progress * 0.5));
            
            // Fade out
            coreMat.opacity = 0.9 * (1 - progress);
            glowMat.opacity = 0.7 * (1 - progress);
            spriteMat.opacity = 1 * (1 - progress);
            
            requestAnimationFrame(animateImpact);
        } else {
            // Remove from scene when animation completes
            scene.remove(impactGroup);
            const index = laserImpactEffects.indexOf(impactGroup);
            if (index > -1) {
                laserImpactEffects.splice(index, 1);
            }
        }
    }
    
    // Start animation
    animateImpact();
    
    return impactGroup;
}

/**
 * Create a radial gradient texture for glow effects
 */
function createGlowTexture(size, innerColor, outerColor) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(
        size/2, size/2, 0,
        size/2, size/2, size/2
    );
    
    gradient.addColorStop(0, innerColor);
    gradient.addColorStop(1, outerColor);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    return new CanvasTexture(canvas);
}

/**
 * Creates a visual laser beam from source to target
 * @param {Object} scene - Three.js scene
 * @param {Vector3} source - Source position (satellite)
 * @param {Vector3} target - Target position (asteroid)
 * @param {Number} power - Laser power (0-100)
 * @param {Number} radius - Laser beam radius
 * @returns {Object} - Laser mesh
 */
export function createLaserBeam(scene, source, target, power = 50, radius = 0.1) {
    // Calculate laser direction and length
    const direction = new Vector3().subVectors(target, source);
    const distance = direction.length();
    
    // Create laser geometry
    const laserGeom = new CylinderGeometry(radius, radius, distance, 8);
    laserGeom.translate(0, distance/2, 0); // Align with direction
    laserGeom.rotateX(Math.PI/2); // Orient along Y-axis
    
    // Create laser material with color based on power
    const laserColor = new Color();
    if (power < 40) {
        laserColor.setRGB(1.0, 0.3, 0.3); // Red for low power
    } else if (power < 70) {
        laserColor.setRGB(1.0, 0.6, 0.2); // Orange-yellow for medium power
    } else {
        laserColor.setRGB(1.0, 0.8, 0.4); // Bright yellow for high power
    }
    
    const laserMat = new MeshBasicMaterial({
        color: laserColor,
        transparent: true,
        opacity: 0.7 + (power / 100) * 0.3,
        blending: AdditiveBlending
    });
    
    // Create laser mesh
    const laser = new Mesh(laserGeom, laserMat);
    
    // Position and orient laser to point from source to target
    laser.position.copy(source);
    laser.lookAt(target);
    
    // Add to scene
    scene.add(laser);
    
    return laser;
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
 * Sets the color of the trajectory visualization with enhanced visual effects
 * @param {Number} hexColor - The color in hexadecimal format
 */
export function setTrajectoryColor(hexColor) {
    if (trajectoryMat) {
        trajectoryMat.color.setHex(hexColor);
        
        // Add pulsing animation effect for deflected asteroid (green)
        if (hexColor === 0x00ff00) { // Green color for deflection
            // Make line more visible for successful deflection
            trajectoryMat.opacity = 0.9;
            
            // Create pulsing effect by animating opacity
            let pulseTime = 0;
            if (!window.trajectoryPulseInterval) {
                window.trajectoryPulseInterval = setInterval(() => {
                    pulseTime += 0.05;
                    const pulseValue = 0.75 + 0.25 * Math.sin(pulseTime * 5);
                    
                    if (trajectoryMat && trajectoryGlowMat) {
                        trajectoryMat.opacity = 0.7 + (0.3 * pulseValue);
                        trajectoryGlowMat.opacity = 0.3 + (0.3 * pulseValue);
                    } else {
                        clearInterval(window.trajectoryPulseInterval);
                        window.trajectoryPulseInterval = null;
                    }
                }, 50);
            }
        } else {
            // Clear any existing animation for non-green trajectories
            if (window.trajectoryPulseInterval) {
                clearInterval(window.trajectoryPulseInterval);
                window.trajectoryPulseInterval = null;
            }
        }
    }
    
    if (trajectoryGlowMat) {
        trajectoryGlowMat.color.setHex(hexColor);
        
        // Make glow more visible for important states
        if (hexColor === 0x00ff00) { // Green (deflected)
            trajectoryGlowMat.opacity = 0.5; // More visible glow
        } else if (hexColor === 0xff0044) { // Red (danger)
            trajectoryGlowMat.opacity = 0.4;
        }
    }
    
    console.log('Trajectory color changed to:', hexColor.toString(16), 'with enhanced visual effects');
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