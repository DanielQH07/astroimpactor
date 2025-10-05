// Debug panel for monitoring asteroid tracking and trajectory
class DebugPanel {
    constructor() {
        this.panel = null;
        this.isVisible = false;
        this.updateInterval = null;
        
        this.init();
    }
    
    init() {
        this.createPanel();
        this.startUpdating();
        console.log('DebugPanel initialized');
    }
    
    createPanel() {
        // Create debug panel HTML
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        panel.style.display = 'none';
        
        panel.innerHTML = `
            <h4>🛰️ Asteroid Defense Debug</h4>
            
            <div class="debug-section">
                <div class="debug-label">Asteroid Tracking:</div>
                <div id="asteroid-status" class="debug-value">
                    <span class="status-indicator status-inactive"></span>No asteroid detected
                </div>
                <div id="asteroid-position" class="debug-value">Position: N/A</div>
                <div id="asteroid-velocity" class="debug-value">Velocity: N/A</div>
            </div>
            
            <div class="debug-section">
                <div class="debug-label">Trajectory System:</div>
                <div id="trajectory-status" class="debug-value">
                    <span class="status-indicator status-inactive"></span>Trajectory hidden
                </div>
                <div id="trajectory-points" class="debug-value">Points: 0</div>
                <div id="trajectory-color" class="debug-value">Color: N/A</div>
            </div>
            
            <div class="debug-section">
                <div class="debug-label">Scene Objects:</div>
                <div id="scene-objects" class="debug-value">Objects: 0</div>
                <div id="scene-lines" class="debug-value">Lines: 0</div>
                <div id="test-lines" class="debug-value">Test Lines: Hidden</div>
            </div>
            
            <div class="debug-section">
                <div class="debug-label">Camera Info:</div>
                <div id="camera-position" class="debug-value">Position: N/A</div>
                <div id="camera-target" class="debug-value">Target: N/A</div>
            </div>
            
            <div class="debug-section">
                <div class="debug-label">Performance:</div>
                <div id="frame-rate" class="debug-value">FPS: N/A</div>
                <div id="update-rate" class="debug-value">Updates/sec: N/A</div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.panel = panel;
    }
    
    updateAsteroidInfo(tracker) {
        if (!tracker) return;
        
        const info = tracker.getTrackingInfo();
        const statusEl = document.getElementById('asteroid-status');
        const positionEl = document.getElementById('asteroid-position');
        const velocityEl = document.getElementById('asteroid-velocity');
        
        if (info.hasAsteroid) {
            statusEl.innerHTML = `<span class="status-indicator status-active"></span>Asteroid tracked`;
            
            if (info.position) {
                positionEl.textContent = `Position: (${info.position.x.toFixed(2)}, ${info.position.y.toFixed(2)}, ${info.position.z.toFixed(2)})`;
            }
            
            const velMagnitude = info.velocity.length();
            velocityEl.innerHTML = `Velocity: ${velMagnitude.toFixed(4)} units/s ${velMagnitude > 0.001 ? '<span style="color: #00ff00;">MOVING</span>' : '<span style="color: #ffaa00;">STATIC</span>'}`;
        } else {
            statusEl.innerHTML = `<span class="status-indicator status-inactive"></span>No asteroid detected`;
            positionEl.textContent = 'Position: N/A';
            velocityEl.textContent = 'Velocity: N/A';
        }
    }
    
    updateTrajectoryInfo(trajectoryManager) {
        if (!trajectoryManager) return;
        
        const statusEl = document.getElementById('trajectory-status');
        const pointsEl = document.getElementById('trajectory-points');
        const colorEl = document.getElementById('trajectory-color');
        
        if (trajectoryManager.isVisible) {
            statusEl.innerHTML = `<span class="status-indicator status-active"></span>Trajectory visible`;
        } else {
            statusEl.innerHTML = `<span class="status-indicator status-inactive"></span>Trajectory hidden`;
        }
        
        if (trajectoryManager.trajectoryGeom && trajectoryManager.trajectoryGeom.attributes.position) {
            const pointCount = trajectoryManager.trajectoryGeom.attributes.position.count;
            pointsEl.textContent = `Points: ${pointCount}`;
        } else {
            pointsEl.textContent = 'Points: 0';
        }
        
        if (trajectoryManager.trajectoryMat) {
            const color = trajectoryManager.trajectoryMat.color.getHexString();
            colorEl.innerHTML = `Color: #${color} <span style="color: #${color};">●</span>`;
        }
    }
    
    updateSceneInfo(scene, testLines) {
        const objectsEl = document.getElementById('scene-objects');
        const linesEl = document.getElementById('scene-lines');
        const testLinesEl = document.getElementById('test-lines');
        
        if (scene) {
            objectsEl.textContent = `Objects: ${scene.children.length}`;
            
            const lines = scene.children.filter(child => child.type === 'Line');
            linesEl.textContent = `Lines: ${lines.length}`;
        }
        
        if (testLines && testLines.length > 0) {
            const visible = testLines[0].visible;
            testLinesEl.innerHTML = `Test Lines: ${visible ? '<span style="color: #00ff00;">Visible</span>' : '<span style="color: #ff4444;">Hidden</span>'}`;
        }
    }
    
    updateCameraInfo(camera) {
        if (!camera) return;
        
        const positionEl = document.getElementById('camera-position');
        const targetEl = document.getElementById('camera-target');
        
        positionEl.textContent = `Position: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`;
        
        // Calculate camera target (approximate)
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        const target = camera.position.clone().add(direction.multiplyScalar(10));
        targetEl.textContent = `Target: (${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)})`;
    }
    
    updatePerformanceInfo() {
        const frameRateEl = document.getElementById('frame-rate');
        const updateRateEl = document.getElementById('update-rate');
        
        // Simple FPS calculation
        if (!this.lastFrameTime) {
            this.lastFrameTime = performance.now();
            this.frameCount = 0;
        }
        
        this.frameCount++;
        const now = performance.now();
        const deltaTime = now - this.lastFrameTime;
        
        if (deltaTime >= 1000) { // Update every second
            const fps = Math.round((this.frameCount * 1000) / deltaTime);
            frameRateEl.textContent = `FPS: ${fps}`;
            
            this.frameCount = 0;
            this.lastFrameTime = now;
        }
        
        updateRateEl.textContent = 'Updates/sec: 10'; // Fixed at 10 Hz
    }
    
    update() {
        if (!this.isVisible) return;
        
        // Update all debug information
        if (window.asteroidTracker) {
            this.updateAsteroidInfo(window.asteroidTracker);
        }
        
        if (window.trajectoryManager) {
            this.updateTrajectoryInfo(window.trajectoryManager);
        }
        
        if (window.world) {
            this.updateSceneInfo(window.world.scene(), window.testLines);
            this.updateCameraInfo(window.world.camera());
        }
        
        this.updatePerformanceInfo();
    }
    
    show() {
        if (this.panel) {
            this.panel.style.display = 'block';
            this.isVisible = true;
            console.log('Debug panel shown');
        }
    }
    
    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
            this.isVisible = false;
            console.log('Debug panel hidden');
        }
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    startUpdating() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.update();
        }, 100); // Update every 100ms
    }
    
    stopUpdating() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}

// Export for use in main script
window.DebugPanel = DebugPanel;