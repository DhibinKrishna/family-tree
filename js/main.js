// main.js
// Bootstraps DB, initializes UI and Canvas, and connects events

import { CanvasController } from './canvas.js';
import { UI } from './ui.js';
import { Renderer } from './render.js';
import { 
    initDB, getSetting, setSetting,
    addPerson, updatePerson, deletePerson, getAllPersons, 
    addRelation, deleteRelation, getAllRelations, 
    exportData, importData, clearData 
} from './db.js';

let persons = [];
let relations = [];
let personsMap = {};

function getParentCount(childId) {
    return relations.filter(r => r.type === 'parent-child' && 
        (String(r.targetId) === String(childId))
    ).length;
}

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
        let pairedRelation = null; // For unified spouse-child lines
        Renderer.onRelationClick = async (relation, secondRelation = null) => {
             pairedRelation = secondRelation;
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
             const center = canvasCtrl.getViewportCenter();
             
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
             // Also delete paired relation from unified spouse-child line
             if (pairedRelation) {
                 await deleteRelation(pairedRelation.id);
                 pairedRelation = null;
             }
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
                 // Enforce max 2 parents per child
                 if (type === 'parent-child' && getParentCount(targetId) >= 2) {
                     alert("This person already has 2 parents.");
                     return;
                 }
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

        UI.onClearData = async () => {
             try {
                 await clearData();
                 await loadData();
                 renderCanvas();
                 canvasCtrl.resetView();
                 UI.setFrozen(false);
             } catch(e) {
                 alert("Error clearing data: " + e.message);
             }
        };

        UI.onResetView = () => canvasCtrl.resetView();

        // Hook drag-to-connect drawing to relationship modal
        Renderer.onLinkNodes = (sourcePerson, targetId) => {
             UI.populateRelationDropdowns(persons);
             
             // Smart relationship detection based on drag direction
             const target = personsMap[targetId];
             let suggestedType = '';
             if (target) {
                 const dx = target.x - sourcePerson.x;
                 const dy = target.y - sourcePerson.y;
                 if (Math.abs(dx) > Math.abs(dy)) {
                     // Horizontal drag → spouse
                     suggestedType = 'spouse';
                 } else if (dy > 0) {
                     // Downward drag → parent-child
                     suggestedType = 'parent-child';
                 }
                 // Upward or ambiguous → leave blank, force manual pick
             }
             
             UI.openRelationModal({
                 sourceId: String(sourcePerson.id),
                 targetId: String(targetId),
                 type: suggestedType
             });
        };

        // Hook drag-to-connect from spouse relation handle
        Renderer.onLinkSpouseToChild = async (parent1Id, parent2Id, childId) => {
            // Count how many NEW parent links would be added
            const exists1 = relations.find(r => 
                 (r.sourceId === parent1Id && r.targetId === childId) ||
                 (r.sourceId === childId && r.targetId === parent1Id)
            );
            const exists2 = relations.find(r => 
                 (r.sourceId === parent2Id && r.targetId === childId) ||
                 (r.sourceId === childId && r.targetId === parent2Id)
            );
            const newLinksNeeded = (!exists1 ? 1 : 0) + (!exists2 ? 1 : 0);
            
            if (getParentCount(childId) + newLinksNeeded > 2) {
                alert("This person already has 2 parents. A person cannot have more than 2 parents.");
                return;
            }
            
            if (!exists1) await addRelation(parent1Id, childId, 'parent-child');
            if (!exists2) await addRelation(parent2Id, childId, 'parent-child');
            
            await loadData();
            renderCanvas();
        };

        function startAddingRelative(sourcePerson, sourceRel, type) {
            const originalOnSave = UI.onSavePerson;
            
            // Derive a contextual title for the modal
            let modalTitle = "Add Person";
            let prefillData = {};
            if (sourceRel) {
                modalTitle = "Add Child";
            } else if (type === 'parent-child') {
                modalTitle = "Add Child";
            } else if (type === 'spouse') {
                modalTitle = "Add Spouse";
                // Best-guess gender: opposite of source person
                if (sourcePerson && sourcePerson.gender === 'male') {
                    prefillData.gender = 'female';
                } else if (sourcePerson && sourcePerson.gender === 'female') {
                    prefillData.gender = 'male';
                }
                // 'other' or missing → leave blank, force manual selection
            }
            
            UI.onSavePerson = async (newPersonData) => {
                // Position near the source
                if (sourcePerson) {
                    if (type === 'spouse') {
                        newPersonData.x = sourcePerson.x + 220;
                        newPersonData.y = sourcePerson.y;
                    } else {
                        newPersonData.x = sourcePerson.x;
                        newPersonData.y = sourcePerson.y + 200;
                    }
                } else if (sourceRel) {
                    const p1 = personsMap[sourceRel.sourceId];
                    const p2 = personsMap[sourceRel.targetId];
                    if (p1 && p2) {
                        newPersonData.x = (p1.x + p2.x) / 2;
                        newPersonData.y = Math.max(p1.y, p2.y) + 200;
                    }
                }
                
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
            
            UI.openPersonModal(null, modalTitle, prefillData);
        }

        Renderer.onAddRelativeFromPerson = (personData) => {
            UI.openChoiceModal(personData.name, (choiceType) => {
                startAddingRelative(personData, null, choiceType);
            });
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
