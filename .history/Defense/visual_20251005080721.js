// visual.js - Asteroid Defense Game System
// Import from the same ESM source as globe.html to avoid duplicate Three.js instances
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
    
/**
 * Updates the game state based on a laser hit
 * @param {Number} power - Laser power (0-100) 
 * @returns {Object} - Updated game state
 */
export function registerLaserHit(power) {
    // Increment hit points based on power
    const powerFactor = power / 100;
    const hitIncrement = powerFactor * 1.0; // Higher power = more deflection
    
    // Add to total hits
    hitPoints += hitIncrement;
    
    // Determine game state
    const isDeflected = hitPoints >= requiredHits;
    
    // Calculate deflection percentage
    const deflectionPercent = Math.min(100, Math.round((hitPoints / requiredHits) * 100));
    
    // Generate appropriate message
    let message = "";
    if (isDeflected) {
        message = `Asteroid successfully deflected! (${deflectionPercent}% deflection achieved)`;
    } else {
        message = `Laser hit! Deflection progress: ${deflectionPercent}%. Need more hits!`;
    }
    
    // Update game message
    gameMessage = message;
    
    // Return updated game state
    return {
        hits: hitPoints,
        required: requiredHits,
        deflected: isDeflected,
        percent: deflectionPercent,
        message: message,
        power: power
    };
}

/**
 * Resets the game state
 */
export function resetGameState() {
    hitPoints = 0;
    gameMessage = "Satellite defense system ready. Fire laser to deflect the asteroid!";
    gameActive = true;
    
    return {
        hits: hitPoints,
        required: requiredHits,
        deflected: false,
        active: gameActive,
        message: gameMessage
    };
}

/**
 * Gets the current game state
 */
export function getGameState() {
    return {
        hits: hitPoints,
        required: requiredHits,
        deflected: hitPoints >= requiredHits,
        active: gameActive,
        message: gameMessage
    };
}

/**
 * Calculates the deflection amount based on laser power and asteroid properties
 * @param {Number} power - Laser power (0-100)
 * @param {Number} asteroidDiameter - Asteroid diameter in meters
 * @param {Number} asteroidDensity - Asteroid density in kg/m³
 * @returns {Object} - Deflection data
 */
export function calculateDeflection(power, asteroidDiameter, asteroidDensity) {
    // Scale power to meaningful range (0-1)
    const scaledPower = power / 100;
    
    // Calculate asteroid mass (simplified)
    const radius = asteroidDiameter / 2;
    const volume = (4/3) * Math.PI * Math.pow(radius, 3);
    const mass = volume * asteroidDensity;
    
    // Calculate force applied (simplified physics)
    const baseForce = 1000000 * scaledPower; // Base laser force in newtons
    const force = baseForce * Math.pow(scaledPower, 1.5); // Non-linear scaling
    
    // Calculate acceleration (F = ma)
    const acceleration = force / mass;
    
    // Calculate deflection angle change (simplified)
    const angleChange = Math.min(5, acceleration * 0.00001);
    
    // Calculate orbit change in km at Earth distance
    const orbitChangeKm = angleChange * 150000000 * Math.PI / 180;
    
    return {
        power: power,
        force: force.toExponential(2) + " N",
        acceleration: acceleration.toExponential(2) + " m/s²",
        angleChange: angleChange.toFixed(4) + "°",
        orbitChangeKm: Math.round(orbitChangeKm).toLocaleString() + " km",
        effectivenessPercent: Math.round(scaledPower * 100 * (1 - mass/1e15))
    };
}

/**
 * Creates an alert message for the player
 * @param {String} message - Message to display
 * @param {String} type - Message type (info, success, warning, error)
 * @returns {Object} - Alert data
 */
export function createGameAlert(message, type = 'info') {
    gameMessage = message;
    
    return {
        message: message,
        type: type,
        timestamp: Date.now()
    };
}

/**
 * Creates an asteroid trajectory visualization system
 * @param {Object} scene - The Three.js scene
 * @returns {Object} - Trajectory system
 */
export function createAsteroidTrajectory(scene) {
    console.log('Creating asteroid trajectory visualization system');
    
    // This function is implemented inside globe.html with updateTrajectoryVisualization
    // This is just a stub to avoid the reference error
    
    return {
        update: () => {
            // This would be called to update the trajectory
            console.log('Trajectory visualization update requested');
            return true;
        }
    };
}

// Export all game functions for global access
export default {
    initializeDefenseSystem,
    createLaserImpact,
    registerLaserHit,
    resetGameState,
    getGameState,
    calculateDeflection,
    createGameAlert,
    createAsteroidTrajectory
};