// Asteroid tracking and management system
class AsteroidTracker {
    constructor(objects) {
        this.objects = objects;
        this.currentAsteroid = null;
        this.lastPosition = null;
        this.velocity = new THREE.Vector3();
        this.trackingInterval = null;
        
        this.init();
    }
    
    init() {
        console.log('AsteroidTracker initialized');
        this.startTracking();
    }
    
    // Convert lng/lat to 3D vector
    lngLatToVec(lng, lat, radius = 1) {
        const toRad = Math.PI / 180;
        const φ = lat * toRad;
        const λ = lng * toRad;
        return new THREE.Vector3(
            Math.cos(φ) * Math.cos(λ) * radius,
            Math.sin(φ) * radius,
            Math.cos(φ) * Math.sin(λ) * radius
        );
    }
    
    // Find current asteroid in objects array
    findAsteroid() {
        return this.objects.find(obj => obj.type === 'asteroid');
    }
    
    // Get asteroid 3D position
    getAsteroidPosition(asteroid) {
        if (!asteroid) return null;
        
        const radius = asteroid.altitude + 1; // Earth radius + altitude
        return this.lngLatToVec(asteroid.lng, asteroid.lat, radius);
    }
    
    // Calculate asteroid velocity based on position change
    calculateVelocity(currentPos, lastPos, deltaTime) {
        if (!lastPos || !currentPos) return new THREE.Vector3();
        
        return currentPos.clone().sub(lastPos).divideScalar(deltaTime);
    }
    
    // Update asteroid tracking
    update() {
        const asteroid = this.findAsteroid();
        
        if (!asteroid) {
            if (this.currentAsteroid) {
                console.log('Asteroid lost from tracking');
                this.currentAsteroid = null;
                this.lastPosition = null;
            }
            return null;
        }
        
        const currentPos = this.getAsteroidPosition(asteroid);
        
        // Calculate velocity if we have previous position
        if (this.lastPosition && currentPos) {
            this.velocity = this.calculateVelocity(currentPos, this.lastPosition, 0.1); // Assume 100ms delta
        }
        
        // Update tracking data
        this.currentAsteroid = asteroid;
        this.lastPosition = currentPos ? currentPos.clone() : null;
        
        return {
            asteroid: asteroid,
            position: currentPos,
            velocity: this.velocity.clone(),
            isMoving: this.velocity.length() > 0.001
        };
    }
    
    // Start continuous tracking
    startTracking() {
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
        }
        
        this.trackingInterval = setInterval(() => {
            const trackingData = this.update();
            
            if (trackingData) {
                console.log('Asteroid tracking update:', {
                    lng: trackingData.asteroid.lng.toFixed(3),
                    lat: trackingData.asteroid.lat.toFixed(3),
                    alt: trackingData.asteroid.altitude.toFixed(3),
                    velocity: trackingData.velocity.length().toFixed(4),
                    moving: trackingData.isMoving
                });
                
                // Trigger trajectory update if available
                if (window.trajectoryManager) {
                    window.trajectoryManager.update();
                }
            }
        }, 100); // Update every 100ms
        
        console.log('Asteroid tracking started');
    }
    
    // Stop tracking
    stopTracking() {
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
            console.log('Asteroid tracking stopped');
        }
    }
    
    // Get current tracking info
    getTrackingInfo() {
        return {
            hasAsteroid: !!this.currentAsteroid,
            position: this.lastPosition,
            velocity: this.velocity,
            asteroid: this.currentAsteroid
        };
    }
    
    // Predict future position
    predictPosition(timeSeconds) {
        if (!this.lastPosition || !this.currentAsteroid) return null;
        
        const futurePos = this.lastPosition.clone().add(
            this.velocity.clone().multiplyScalar(timeSeconds)
        );
        
        return futurePos;
    }
}

// Export for use in main script
window.AsteroidTracker = AsteroidTracker;