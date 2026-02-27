// render.js
// Handles rendering nodes into the HTML layer and SVG paths into the connection layer

export const Renderer = {
    canvasController: null,
    onNodeDragEnd: null,
    onNodeClick: null,
    onRelationClick: null,
    
    selectedNodes: new Set(),
    personNodeCache: {},

    clearSelection() {
        this.selectedNodes.forEach(id => {
            const cache = this.personNodeCache[id];
            if (cache && cache.node) cache.node.classList.remove('selected');
        });
        this.selectedNodes.clear();
    },
    
    init(canvasController) {
        this.canvasController = canvasController;
        this.nodesLayer = document.getElementById('nodes-layer');
        this.handlesLayer = document.getElementById('handles-layer');
        this.connectionsLayer = document.getElementById('connections-layer');
        this.svgNS = "http://www.w3.org/2000/svg";
        
        // Resize observer or window resize to ensure SVG layer covers bounds if needed
        // but absolute overlaying handles it mostly
    },

    renderPersons(persons) {
        this.nodesLayer.innerHTML = '';
        this.personNodeCache = {};
        
        persons.forEach(person => {
             const node = document.createElement('div');
             node.className = 'person-node';
             node.dataset.id = person.id;
             
             // Initial position or center screen if null
             if (person.x === undefined || person.y === undefined) {
                  // Fallback to center visually (approx)
                  person.x = window.innerWidth / 2 - 90; // Half node width
                  person.y = window.innerHeight / 2 - 50;
             }
             
             node.style.left = `${person.x}px`;
             node.style.top = `${person.y}px`;
             
             const genderClass = person.gender ? person.gender : 'unknown';
             
             node.innerHTML = `
                <div class="avatar-header">
                    <div class="avatar ${genderClass}"></div>
                </div>
                <div class="node-info">
                    <div class="node-name">${person.name}</div>
                    ${person.dob ? `<div class="node-meta">${person.dob}</div>` : ''}
                    ${person.location ? `<div class="node-meta">${person.location}</div>` : ''}
                </div>
                <div class="link-handle" title="Drag to connect">➕</div>
             `;
             
             this.makeNodeInteractive(node, person);
             this.nodesLayer.appendChild(node);
             
             this.personNodeCache[person.id] = { node: node, data: person };
             
             // Restore selection styling if this node was already selected
             if (this.selectedNodes.has(person.id)) {
                 node.classList.add('selected');
             }
        });
    },

    makeNodeInteractive(nodeElement, personData) {
        let isDragging = false;
        let isDrawingLink = false;
        let tempLinkPath = null;
        let startClientX, startClientY;
        let startNodeX, startNodeY;
        let startPositions = {};
        let hasMoved = false;

        nodeElement.addEventListener('pointerdown', (e) => {
            e.stopPropagation(); // Prevent canvas pan
            hasMoved = false;
            nodeElement.setPointerCapture(e.pointerId);
            
            startClientX = e.clientX;
            startClientY = e.clientY;
            
            if (e.target.closest('.link-handle')) {
                isDrawingLink = true;
                isDragging = false;
                
                startNodeX = personData.x + 180 / 2; // Node width is 180
                startNodeY = personData.y + nodeElement.offsetHeight / 2; // Node height / 2
                
                tempLinkPath = document.createElementNS(this.svgNS, 'path');
                tempLinkPath.classList.add('relation-line');
                tempLinkPath.style.stroke = 'var(--primary)';
                tempLinkPath.style.strokeDasharray = '4,4';
                tempLinkPath.style.pointerEvents = 'none'; // Don't block pointerup
                this.connectionsLayer.appendChild(tempLinkPath);
            } else {
                isDragging = true;
                isDrawingLink = false;
                
                // Multi-select management
                if (e.shiftKey || e.metaKey) {
                    if (this.selectedNodes.has(personData.id)) {
                        this.selectedNodes.delete(personData.id);
                        nodeElement.classList.remove('selected');
                        isDragging = false; // Don't drag if we just deselected
                    } else {
                        this.selectedNodes.add(personData.id);
                        nodeElement.classList.add('selected');
                    }
                } else if (!this.selectedNodes.has(personData.id)) {
                    this.clearSelection();
                    this.selectedNodes.add(personData.id);
                    nodeElement.classList.add('selected');
                }

                // Cache start positions for ALL selected nodes
                startPositions = {};
                this.selectedNodes.forEach(id => {
                    const cache = this.personNodeCache[id];
                    if (cache) {
                        startPositions[id] = { x: cache.data.x, y: cache.data.y };
                        cache.node.style.zIndex = 10;
                    }
                });
            }
        });

        nodeElement.addEventListener('pointermove', (e) => {
            if (!isDragging && !isDrawingLink) return;
            
            const dx = (e.clientX - startClientX) / this.canvasController.scale;
            const dy = (e.clientY - startClientY) / this.canvasController.scale;
            
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
            
            if (isDragging) {
                // Apply delta to ALL selected nodes
                this.selectedNodes.forEach(id => {
                    const cache = this.personNodeCache[id];
                    if (cache && startPositions[id]) {
                        cache.data.x = startPositions[id].x + dx;
                        cache.data.y = startPositions[id].y + dy;
                        cache.node.style.left = `${cache.data.x}px`;
                        cache.node.style.top = `${cache.data.y}px`;
                    }
                });
                
                // Arbitrarily pass the reference node ID to trigger relation redrawing
                if (this.onNodeDrag) this.onNodeDrag(personData.id);
            } else if (isDrawingLink) {
                const endX = startNodeX + dx;
                const endY = startNodeY + dy;
                tempLinkPath.setAttribute('d', `M ${startNodeX} ${startNodeY} L ${endX} ${endY}`);
            }
        });

        const endDrag = (e) => {
            if (!isDragging && !isDrawingLink) return;
            
            // Revert z-index for all selected
            this.selectedNodes.forEach(id => {
                const cache = this.personNodeCache[id];
                if (cache) cache.node.style.zIndex = '';
            });

            nodeElement.releasePointerCapture(e.pointerId);
            
            if (isDragging) {
                isDragging = false;
                if (hasMoved) {
                    // Send out an array of actual person data objects that moved
                    const movedPersons = Array.from(this.selectedNodes).map(id => this.personNodeCache[id]?.data).filter(Boolean);
                    if(this.onNodeDragEnd) this.onNodeDragEnd(movedPersons);
                } else {
                     if(!e.target.closest('.link-handle')) {
                         // If not moving and no modifier, clicking an already-selected active node resets focus to ONLY that node
                         if (!e.shiftKey && !e.metaKey) {
                             if (this.selectedNodes.size > 1) {
                                 this.clearSelection();
                                 this.selectedNodes.add(personData.id);
                                 nodeElement.classList.add('selected');
                             }
                             if(this.onNodeClick) this.onNodeClick(personData);
                         }
                     }
                }
            } else if (isDrawingLink) {
                isDrawingLink = false;
                if (tempLinkPath) {
                    tempLinkPath.remove();
                    tempLinkPath = null;
                }
                
                // Find what we dropped on
                nodeElement.style.pointerEvents = 'none';
                const droppedOn = document.elementFromPoint(e.clientX, e.clientY);
                nodeElement.style.pointerEvents = '';
                
                if (droppedOn) {
                    const targetNode = droppedOn.closest('.person-node');
                    // data attributes are strings, map correctly
                    if (targetNode && targetNode.dataset.id && String(targetNode.dataset.id) !== String(personData.id)) {
                        if(this.onLinkNodes) this.onLinkNodes(personData, targetNode.dataset.id);
                    } else if (!hasMoved) { // Clicked their own node's marker
                        if(this.onAddRelativeFromPerson) this.onAddRelativeFromPerson(personData);
                    }
                } else if (!hasMoved) { // Dropped on empty space but didn't actually drag
                    if(this.onAddRelativeFromPerson) this.onAddRelativeFromPerson(personData);
                }
            }
        };

        nodeElement.addEventListener('pointerup', endDrag);
        nodeElement.addEventListener('pointercancel', endDrag);
    },

    makeRelationHandleInteractive(handle, rel) {
        let isDrawingLink = false;
        let tempLinkPath = null;
        let startClientX, startClientY;
        let startNodeX, startNodeY;
        let hasMovedMarker = false;
        
        handle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            isDrawingLink = true;
            hasMovedMarker = false;
            handle.setPointerCapture(e.pointerId);
            
            startClientX = e.clientX;
            startClientY = e.clientY;
            
            startNodeX = parseFloat(handle.style.left);
            startNodeY = parseFloat(handle.style.top);
            
            tempLinkPath = document.createElementNS(this.svgNS, 'path');
            tempLinkPath.classList.add('relation-line');
            tempLinkPath.style.stroke = 'var(--primary)';
            tempLinkPath.style.strokeDasharray = '4,4';
            tempLinkPath.style.pointerEvents = 'none';
            this.connectionsLayer.appendChild(tempLinkPath);
        });
        
        handle.addEventListener('pointermove', (e) => {
            if (!isDrawingLink) return;
            
            const dx = (e.clientX - startClientX) / this.canvasController.scale;
            const dy = (e.clientY - startClientY) / this.canvasController.scale;
            
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMovedMarker = true;
            
            const endX = startNodeX + dx;
            const endY = startNodeY + dy;
            tempLinkPath.setAttribute('d', `M ${startNodeX} ${startNodeY} L ${endX} ${endY}`);
        });
        
        const endDrag = (e) => {
            if (!isDrawingLink) return;
            isDrawingLink = false;
            handle.releasePointerCapture(e.pointerId);
            
            if (tempLinkPath) {
                tempLinkPath.remove();
                tempLinkPath = null;
            }
            
            // Find what we dropped on
            handle.style.pointerEvents = 'none';
            const droppedOn = document.elementFromPoint(e.clientX, e.clientY);
            handle.style.pointerEvents = 'auto'; // re-enable just in case
            
            if (droppedOn) {
                const targetNode = droppedOn.closest('.person-node');
                if (targetNode && targetNode.dataset.id) {
                    const childId = targetNode.dataset.id;
                    if (childId !== String(rel.sourceId) && childId !== String(rel.targetId)) {
                        if(this.onLinkSpouseToChild) this.onLinkSpouseToChild(rel.sourceId, rel.targetId, childId);
                    }
                } else if (!hasMovedMarker) {
                    if(this.onAddChildFromSpouse) this.onAddChildFromSpouse(rel);
                }
            } else if (!hasMovedMarker) {
                if(this.onAddChildFromSpouse) this.onAddChildFromSpouse(rel);
            }
        };
        
        handle.addEventListener('pointerup', endDrag);
        handle.addEventListener('pointercancel', endDrag);
    },

    renderRelations(relations, personsMap) {
        this.connectionsLayer.innerHTML = '';
        this.handlesLayer.innerHTML = '';
        
        const nodeWidth = 180;
        
        // Helper to get node height
        const getNodeHeight = (id) => {
            const el = document.querySelector(`[data-id="${id}"]`);
            return el ? el.offsetHeight : 140; 
        };

        // 1. Identify Spouses and their Midpoints
        const spouses = relations.filter(r => r.type === 'spouse');
        const spouseMidpoints = {}; // Key: "id1_id2" or "id2_id1" to Midpoint Object
        const handledChildrenMap = {}; // Key: "relId" to skip drawing later
        
        spouses.forEach((rel) => {
            const source = personsMap[rel.sourceId];
            const target = personsMap[rel.targetId];
            if (!source || !target) return;
            
            const startX = source.x + nodeWidth / 2;
            const startY = source.y + getNodeHeight(source.id) / 2;
            const endX = target.x + nodeWidth / 2;
            const endY = target.y + getNodeHeight(target.id) / 2;
            
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            
            spouseMidpoints[`${rel.sourceId}_${rel.targetId}`] = { x: midX, y: midY, sourceId: rel.sourceId, targetId: rel.targetId };
            spouseMidpoints[`${rel.targetId}_${rel.sourceId}`] = { x: midX, y: midY, sourceId: rel.sourceId, targetId: rel.targetId };
            
            // Draw Spouse Line
            const path = document.createElementNS(this.svgNS, 'path');
            path.classList.add('relation-line');
            path.dataset.id = rel.id;

            const hitbox = document.createElementNS(this.svgNS, 'path');
            hitbox.classList.add('relation-line-hitbox');
            hitbox.dataset.id = rel.id;
            
            const cpX = (startX + endX) / 2;
            const d = `M ${startX} ${startY} C ${cpX} ${startY}, ${cpX} ${endY}, ${endX} ${endY}`;
            path.style.stroke = "#e74c3c";
            path.style.strokeDasharray = "5,5"; // dotted line
            
            // Spouse Drag Handle
            const handle = document.createElement('div');
            handle.classList.add('relation-handle');
            handle.title = "Drag to add child";
            handle.innerHTML = "➕";
            handle.style.left = `${midX}px`;
            handle.style.top = `${midY}px`;
            
            handle.addEventListener('pointerenter', () => handle.classList.add('active'));
            handle.addEventListener('pointerleave', () => handle.classList.remove('active'));
            
            this.makeRelationHandleInteractive(handle, rel);
            this.handlesLayer.appendChild(handle);
            
            path.setAttribute('d', d);
            hitbox.setAttribute('d', d);
            
            hitbox.addEventListener('click', () => { if(this.onRelationClick) this.onRelationClick(rel); });
            
            hitbox.addEventListener('pointerenter', () => {
                path.style.strokeWidth = "5px";
                handle.classList.add('active');
            });
            hitbox.addEventListener('pointerleave', () => {
                path.style.strokeWidth = "3px";
                handle.classList.remove('active');
            });
            
            this.connectionsLayer.appendChild(path);
            this.connectionsLayer.appendChild(hitbox);
        });

        // 2. Map Parent-Child Relationships
        const parentChildRels = relations.filter(r => r.type === 'parent-child');
        
        // Find children shared by spouses
        const childParentMap = {}; // childId -> array of relation objects
        parentChildRels.forEach(rel => {
            if (!childParentMap[rel.targetId]) childParentMap[rel.targetId] = [];
            childParentMap[rel.targetId].push(rel);
        });
        
        // 3. Draw Shared Child Lines
        Object.keys(childParentMap).forEach(childId => {
            const parentRels = childParentMap[childId];
            if (parentRels.length === 2) {
                const parent1Id = parentRels[0].sourceId;
                const parent2Id = parentRels[1].sourceId;
                
                const spouseKey = `${parent1Id}_${parent2Id}`;
                const midpoint = spouseMidpoints[spouseKey];
                
                if (midpoint) {
                    // This child has two parents who are explicitly spouses!
                    const child = personsMap[childId];
                    if (child) {
                        const startX = midpoint.x;
                        const startY = midpoint.y;
                        const endX = child.x + nodeWidth / 2;
                        const endY = child.y + getNodeHeight(childId) / 2;
                        
                        const path = document.createElementNS(this.svgNS, 'path');
                        path.classList.add('relation-line');
                        path.dataset.id = parentRels[0].id; // Arbitrarily pick first for ID binding

                        const hitbox = document.createElementNS(this.svgNS, 'path');
                        hitbox.classList.add('relation-line-hitbox');
                        hitbox.dataset.id = parentRels[0].id; // Bind click to one of the raw relations
            
                        const cpY = (startY + endY) / 2;
                        const d = `M ${startX} ${startY} C ${startX} ${cpY}, ${endX} ${cpY}, ${endX} ${endY}`;
                        path.style.stroke = "#3498db";
                        path.style.strokeWidth = "2px";
            
                        path.setAttribute('d', d);
                        hitbox.setAttribute('d', d);
                        
                        // We will allow deleting the relationship bundle by clicking the unified line
                        hitbox.addEventListener('click', () => { if(this.onRelationClick) this.onRelationClick(parentRels[0]); });
                        
                        this.connectionsLayer.appendChild(path);
                        this.connectionsLayer.appendChild(hitbox);
                        
                        // Mark these as handled so we don't draw individual lines
                        handledChildrenMap[parentRels[0].id] = true;
                        handledChildrenMap[parentRels[1].id] = true;
                    }
                }
            }
        });

        // 4. Draw Remaining Independent Parent-Child Lines
        parentChildRels.forEach(rel => {
            if (handledChildrenMap[rel.id]) return; // Skip if drawn as unified spouse child
            
            const source = personsMap[rel.sourceId];
            const target = personsMap[rel.targetId];
            if(!source || !target) return;
            
            const startX = source.x + nodeWidth / 2;
            const startY = source.y + getNodeHeight(source.id) / 2;
            const endX = target.x + nodeWidth / 2;
            const endY = target.y + getNodeHeight(target.id) / 2;

            const path = document.createElementNS(this.svgNS, 'path');
            path.classList.add('relation-line');
            path.dataset.id = rel.id;

            const hitbox = document.createElementNS(this.svgNS, 'path');
            hitbox.classList.add('relation-line-hitbox');
            hitbox.dataset.id = rel.id;
            
            const cpY = (startY + endY) / 2;
            const d = `M ${startX} ${startY} C ${startX} ${cpY}, ${endX} ${cpY}, ${endX} ${endY}`;
            path.style.stroke = "#3498db";
            
            path.setAttribute('d', d);
            hitbox.setAttribute('d', d);
            
            hitbox.addEventListener('click', () => { if(this.onRelationClick) this.onRelationClick(rel); });
            
            this.connectionsLayer.appendChild(path);
            this.connectionsLayer.appendChild(hitbox);
        });
    }
};
