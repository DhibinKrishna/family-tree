// canvas.js
// Handles infinite pan, zoom, and background dot grid translations.

export class CanvasController {
    constructor(containerId, canvasId) {
        this.container = document.getElementById(containerId);
        this.canvas = document.getElementById(canvasId);

        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;

        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;

        this.setupEventListeners();
        this.updateTransform();
    }

    setupEventListeners() {
        // Zooming via mouse wheel
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSensitivity = 0.001;
            const delta = e.deltaY;
            
            // Calculate new scale, clamped to some reasonable values
            let newScale = this.scale - (delta * zoomSensitivity);
            newScale = Math.min(Math.max(0.1, newScale), 3); // between 10% and 300%
            
            // Need to zoom in towards the mouse pointer
            const rect = this.container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Compute how much the container's translation should adjust to keep the pointer over the same canvas spot
            const scaleRatio = newScale / this.scale;
            this.translateX = mouseX - (mouseX - this.translateX) * scaleRatio;
            this.translateY = mouseY - (mouseY - this.translateY) * scaleRatio;
            
            this.scale = newScale;
            this.updateTransform();
        }, { passive: false });

        // Panning pointer down
        this.container.addEventListener('pointerdown', (e) => {
            // Only pan if clicking on the background container, not on an absolute node element
            if (e.target === this.container || e.target === this.canvas || e.target.id === 'connections-layer') {
                if (this.onBackgroundClick) this.onBackgroundClick(e);
                this.isPanning = true;
                this.startX = e.clientX - this.translateX;
                this.startY = e.clientY - this.translateY;
                this.container.setPointerCapture(e.pointerId);
            }
        });

        // Panning pointer move
        this.container.addEventListener('pointermove', (e) => {
            if (this.isPanning) {
                this.translateX = e.clientX - this.startX;
                this.translateY = e.clientY - this.startY;
                this.updateTransform();
            }
        });

        // Panning pointer up/cancel
        this.container.addEventListener('pointerup', (e) => {
            this.isPanning = false;
            this.container.releasePointerCapture(e.pointerId);
        });
        this.container.addEventListener('pointercancel', () => {
             this.isPanning = false;
        });
    }

    resetView() {
        const nodes = document.querySelectorAll('.person-node');
        if (nodes.length === 0) {
            this.scale = 1;
            this.translateX = 0;
            this.translateY = 0;
            this.updateTransform();
            return;
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        // Calculate bounding box in abstract canvas coordinates
        nodes.forEach(node => {
            const x = parseFloat(node.style.left);
            const y = parseFloat(node.style.top);
            const w = node.offsetWidth;
            const h = node.offsetHeight;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + w > maxX) maxX = x + w;
            if (y + h > maxY) maxY = y + h;
        });

        // Add padding
        const padding = 100;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const contentW = maxX - minX;
        const contentH = maxY - minY;
        
        const screenW = window.innerWidth;
        const screenH = window.innerHeight - 80; // Account for toolbar area

        // Compute needed scale to fit everything, clamped max to 1
        const scaleX = screenW / contentW;
        const scaleY = screenH / contentH;
        this.scale = Math.min(scaleX, scaleY, 1);

        // Center it
        this.translateX = (screenW - (contentW * this.scale)) / 2 - (minX * this.scale);
        this.translateY = (screenH - (contentH * this.scale)) / 2 - (minY * this.scale) + 60; // Offset down slightly for toolbar

        this.updateTransform();
    }

    updateTransform() {
        // Update the CSS transform of the canvas element
        this.canvas.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
        
        // Update the CSS background position of the container to create an illusion of the grid moving
        this.container.style.backgroundPosition = `${this.translateX}px ${this.translateY}px`;
        this.container.style.backgroundSize = `${20 * this.scale}px ${20 * this.scale}px`;
    }
    
    // Convert screen coordinates to canvas space coordinates
    screenToCanvas(x, y) {
        return {
            x: (x - this.translateX) / this.scale,
            y: (y - this.translateY) / this.scale
        };
    }
}
