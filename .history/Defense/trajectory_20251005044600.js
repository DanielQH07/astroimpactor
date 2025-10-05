// Trajectory visualization system
class TrajectoryManager {
    constructor(scene, objects) {
        this.scene = scene;
        this.objects = objects;
        this.trajectoryLine = null;
        this.trajectoryGeom = null;
        this.trajectoryMat = null;
        this.isVisible = false;
        
        this.init();
    }
    
    init() {
        // Initialize trajectory line
        this.trajectoryGeom = new THREE.BufferGeometry();
        this.trajectoryMat = new THREE.LineBasicMaterial({
            color: 0xff0044,      // Bright pink for visibility
            transparent: true,
            opacity: 1.0,
            depthTest: false,     // Always render on top
            depthWrite: false,    // Don't write to depth buffer
            linewidth: 2
        });
        
        this.trajectoryLine = new THREE.Line(this.trajectoryGeom, this.trajectoryMat);
        this.trajectoryLine.visible = false;
        this.trajectoryLine.renderOrder = 1000;  // High render priority
        
        this.scene.add(this.trajectoryLine);
        console.log('TrajectoryManager initialized');
    }
    
    // Convert lng/lat to 3D vector (helper function)
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
    
    // Find current asteroid
    getCurrentAsteroid() {
        return this.objects.find(obj => obj.type === 'asteroid');
    }
    
    // Update trajectory visualization
    update() {
        const asteroid = this.getCurrentAsteroid();
        
        if (!asteroid) {
            this.hide();
            console.log('No asteroid found, hiding trajectory');
            return;
        }
        
        console.log('Updating trajectory for asteroid at:', {
            lng: asteroid.lng,
            lat: asteroid.lat,
            alt: asteroid.altitude
        });
        
        // Get asteroid position in 3D space
        const asteroidRadius = asteroid.altitude + 1; // Earth radius + altitude
        const asteroidPos = this.lngLatToVec(asteroid.lng, asteroid.lat, asteroidRadius);
        
        console.log('Asteroid 3D position:', asteroidPos);
        
        // Create trajectory direction (simple: away from Earth center)
        const earthCenter = new THREE.Vector3(0, 0, 0);
        const direction = asteroidPos.clone().sub(earthCenter).normalize();
        
        // Create trajectory line points
        const trajectoryLength = 20;  // Line extends 20 units
        const startDistance = 5;      // Start 5 units behind asteroid
        
        const startPoint = asteroidPos.clone().add(direction.clone().multiplyScalar(-startDistance));
        const endPoint = asteroidPos.clone().add(direction.clone().multiplyScalar(trajectoryLength));
        
        console.log('Trajectory line:', {
            start: startPoint,
            end: endPoint,
            direction: direction
        });
        
        // Update geometry
        const points = [
            startPoint.x, startPoint.y, startPoint.z,
            asteroidPos.x, asteroidPos.y, asteroidPos.z,  // Through asteroid
            endPoint.x, endPoint.y, endPoint.z
        ];
        
        const positionArray = new THREE.Float32BufferAttribute(points, 3);
        this.trajectoryGeom.setAttribute('position', positionArray);
        this.trajectoryGeom.computeBoundingSphere();
        
        // Make visible
        this.show();
        
        console.log('Trajectory updated with', points.length / 3, 'points');
    }
    
    show() {
        if (this.trajectoryLine) {
            this.trajectoryLine.visible = true;
            this.isVisible = true;
            console.log('Trajectory line shown');
        }
    }
    
    hide() {
        if (this.trajectoryLine) {
            this.trajectoryLine.visible = false;
            this.isVisible = false;
            console.log('Trajectory line hidden');
        }
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.update();
        }
    }
    
    // Change trajectory color (for deflection indication)
    setColor(color) {
        if (this.trajectoryMat) {
            this.trajectoryMat.color.setHex(color);
        }
    }
    
    // Set trajectory to show deflection
    showDeflection(asteroidPos, newDirection) {
        console.log('Showing deflected trajectory');
        
        // Green color for successful deflection
        this.setColor(0x00ff00);
        
        // Create deflected trajectory points
        const trajectoryLength = 25;
        const points = [];
        
        // Add points along the new direction
        for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const distance = t * trajectoryLength;
            const point = asteroidPos.clone().add(newDirection.clone().multiplyScalar(distance));
            points.push(point.x, point.y, point.z);
        }
        
        // Update geometry
        const positionArray = new THREE.Float32BufferAttribute(points, 3);
        this.trajectoryGeom.setAttribute('position', positionArray);
        this.trajectoryGeom.computeBoundingSphere();
        
        this.show();
        console.log('Deflected trajectory shown with', points.length / 3, 'points');
    }
}

// Export for use in main script
window.TrajectoryManager = TrajectoryManager;