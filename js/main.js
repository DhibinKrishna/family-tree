// main.js
// Bootstraps DB, initializes UI and Canvas, and connects events

import { CanvasController } from './canvas.js';
import { UI } from './ui.js';
import { Renderer } from './render.js';
import { 
    initDB, getSetting, setSetting,
    addPerson, updatePerson, deletePerson, getAllPersons, 
    addRelation, deleteRelation, getAllRelations, 
    exportData, importData 
} from './db.js';

let persons = [];
let relations = [];
let personsMap = {};

async function bootstrap() {
    try {
        await initDB();
        await loadData();
        
        const canvasCtrl = new CanvasController('canvas-container', 'canvas');
        canvasCtrl.onBackgroundClick = () => Renderer.clearSelection();
        
        Renderer.init(canvasCtrl);
        Renderer.onNodeDrag = () => {
             // Efficient partial re-render, but for our scale, redrawing relations is fast enough
             Renderer.renderRelations(relations, personsMap);
        };
        Renderer.onNodeDragEnd = async (person) => {
             await updatePerson(person);
        };
        Renderer.onNodeClick = (person) => {
             UI.openPersonModal(person);
        };
        Renderer.onRelationClick = async (relation) => {
             UI.populateRelationDropdowns(persons);
             UI.openRelationModal(relation);
        };

        UI.init();
        
        const isFrozen = await getSetting('isFrozen');
        if (isFrozen) UI.setFrozen(true);
        
        UI.onFreezeToggle = async (frozenState) => {
            await setSetting('isFrozen', frozenState);
        };
        
        UI.onSavePerson = async (personData) => {
             const center = canvasCtrl.screenToCanvas(window.innerWidth / 2, window.innerHeight / 2);
             
             if (personData.id) {
                 // Keep existing coords
                 const existing = personsMap[personData.id];
                 personData.x = existing.x;
                 personData.y = existing.y;
                 await updatePerson(personData);
             } else {
                 // New person, place at center
                 personData.x = center.x - 90;
                 personData.y = center.y - 70;
                 await addPerson(personData);
             }
             await loadData();
             renderCanvas();
        };

        UI.onDeletePerson = async (id) => {
             await deletePerson(id);
             await loadData();
             renderCanvas();
        };

        UI.onDeleteRelation = async (id) => {
             await deleteRelation(id);
             await loadData();
             renderCanvas();
        };

        UI.onSaveRelation = async ({id, sourceId, targetId, type}) => {
             // Prevent duplicates if not editing
             if (!id) {
                 const exists = relations.find(r => 
                     (r.sourceId === sourceId && r.targetId === targetId) ||
                     (r.sourceId === targetId && r.targetId === sourceId)
                 );
                 if (exists) {
                     alert("A relationship between these two already exists.");
                     return;
                 }
             }
             
             if (id) {
                 // The DB layer needs an updateRelation method, or we delete & add
                 await deleteRelation(id);
                 await addRelation(sourceId, targetId, type);
             } else {
                 await addRelation(sourceId, targetId, type);
             }
             
             await loadData();
             renderCanvas();
        };

        UI.onExport = async () => {
             const json = await exportData();
             const blob = new Blob([json], { type: "application/json" });
             const url = URL.createObjectURL(blob);
             
             const a = document.createElement('a');
             a.href = url;
             a.download = "family_tree.json";
             a.click();
             
             URL.revokeObjectURL(url);
        };

        UI.onImport = async (jsonData) => {
             try {
                 await importData(jsonData);
                 UI.setFrozen(true);
                 await loadData();
                 renderCanvas();
                 canvasCtrl.resetView();
                 alert("Imported successfully. The canvas has been frozen to prevent accidental edits.");
             } catch(e) {
                 alert("Error importing JSON: " + e.message);
             }
        };

        UI.onResetView = () => canvasCtrl.resetView();

        // Hook drag-to-connect drawing to relationship modal
        Renderer.onLinkNodes = (sourcePerson, targetId) => {
             UI.populateRelationDropdowns(persons);
             // Pass partial relation object to populate form dropdowns
             UI.openRelationModal({
                 sourceId: String(sourcePerson.id),
                 targetId: String(targetId)
             });
        };

        // Hook drag-to-connect from spouse relation handle
        Renderer.onLinkSpouseToChild = async (parent1Id, parent2Id, childId) => {
            const exists1 = relations.find(r => 
                 (r.sourceId === parent1Id && r.targetId === childId) ||
                 (r.sourceId === childId && r.targetId === parent1Id)
            );
            if (!exists1) await addRelation(parent1Id, childId, 'parent-child');
            
            const exists2 = relations.find(r => 
                 (r.sourceId === parent2Id && r.targetId === childId) ||
                 (r.sourceId === childId && r.targetId === parent2Id)
            );
            if (!exists2) await addRelation(parent2Id, childId, 'parent-child');
            
            await loadData();
            renderCanvas();
        };

        function startAddingRelative(sourcePerson, sourceRel, type) {
            const originalOnSave = UI.onSavePerson;
            
            UI.onSavePerson = async (newPersonData) => {
                const newPerson = await addPerson(newPersonData);
                
                if (sourcePerson) {
                    await addRelation(sourcePerson.id, newPerson.id, type);
                } else if (sourceRel) {
                    await addRelation(sourceRel.sourceId, newPerson.id, 'parent-child');
                    await addRelation(sourceRel.targetId, newPerson.id, 'parent-child');
                }
                
                await loadData();
                renderCanvas();
                
                UI.onSavePerson = originalOnSave;
            };
            
            const modal = document.getElementById('person-modal');
            const onClose = () => {
                UI.onSavePerson = originalOnSave;
                modal.removeEventListener('close', onClose);
            };
            modal.addEventListener('close', onClose);
            
            UI.openPersonModal();
        }

        Renderer.onAddRelativeFromPerson = (personData) => {
            const hasSpouse = relations.some(r => r.type === 'spouse' && (r.sourceId === String(personData.id) || r.targetId === String(personData.id)));
            
            if (hasSpouse) {
                startAddingRelative(personData, null, 'parent-child');
            } else {
                UI.openChoiceModal(personData.name, (choiceType) => {
                    startAddingRelative(personData, null, choiceType);
                });
            }
        };

        Renderer.onAddChildFromSpouse = (rel) => {
            startAddingRelative(null, rel, 'parent-child');
        };

        const dragSaveTimers = {};
        Renderer.onNodeDragEnd = (movedPersons) => {
             // Save position after a 2-second debounce to prevent UI freezing
             const personsToSave = Array.isArray(movedPersons) ? movedPersons : [movedPersons];
             
             personsToSave.forEach(personData => {
                 if (dragSaveTimers[personData.id]) {
                     clearTimeout(dragSaveTimers[personData.id]);
                 }
                 
                 dragSaveTimers[personData.id] = setTimeout(async () => {
                     await updatePerson(personData);
                     // We don't need to loadData/renderCanvas here because the node is already visually in the right place
                     delete dragSaveTimers[personData.id];
                 }, 2000);
             });
        };

        renderCanvas();
        canvasCtrl.resetView();

    } catch (e) {
        console.error("Initialization Failed:", e);
        alert("Failed to initialize database: " + e.message);
    }
}

async function loadData() {
    persons = await getAllPersons();
    relations = await getAllRelations();
    
    personsMap = {};
    persons.forEach(p => personsMap[p.id] = p);
}

function renderCanvas() {
    Renderer.renderPersons(persons);
    Renderer.renderRelations(relations, personsMap);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
