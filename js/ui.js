// ui.js
// Handles DOM interactions, modals, and form parsing

export const UI = {
    onSavePerson: null,
    onDeletePerson: null,
    onSaveRelation: null,
    onExport: null,
    onImport: null,
    onResetView: null,
    onFreezeToggle: null,

    init() {
        this.bindToolbar();
        this.bindPersonModal();
        this.bindRelationModal();
    },

    setFrozen(isFrozen) {
        const freezeBtn = document.getElementById('freeze-btn');
        if (!freezeBtn) return;
        
        if (isFrozen) {
            document.body.classList.add('frozen');
            freezeBtn.textContent = 'Unfreeze';
            freezeBtn.classList.replace('outline', 'primary');
            document.getElementById('add-person-btn').disabled = true;
        } else {
            document.body.classList.remove('frozen');
            freezeBtn.textContent = 'Freeze';
            freezeBtn.classList.replace('primary', 'outline');
            document.getElementById('add-person-btn').disabled = false;
        }
    },

    bindToolbar() {
        const freezeBtn = document.getElementById('freeze-btn');
        if (freezeBtn) {
            freezeBtn.addEventListener('click', () => {
                const isFrozen = !document.body.classList.contains('frozen');
                this.setFrozen(isFrozen);
                if (this.onFreezeToggle) this.onFreezeToggle(isFrozen);
            });
        }

        document.getElementById('add-person-btn').addEventListener('click', () => {
             this.openPersonModal();
        });

        document.getElementById('export-btn').addEventListener('click', () => {
             if(this.onExport) this.onExport();
        });

        document.getElementById('clear-btn').addEventListener('click', () => {
             if (confirm("Are you sure you want to clear ALL family tree data? This action cannot be undone.")) {
                 if(this.onClearData) this.onClearData();
             }
        });

        document.getElementById('import-btn').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        document.getElementById('import-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if(!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                if(this.onImport) this.onImport(event.target.result);
                e.target.value = ''; // Reset
            };
            reader.readAsText(file);
        });

        document.getElementById('reset-view-btn').addEventListener('click', () => {
            if(this.onResetView) this.onResetView();
        });
    },

    bindPersonModal() {
        const modal = document.getElementById('person-modal');
        const form = document.getElementById('person-form');
        const deleteBtn = document.getElementById('delete-person-btn');

        // Cancel buttons in all modals
        document.querySelectorAll('.cancel-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
               e.target.closest('dialog').close();
            });
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const personData = {
                id: document.getElementById('person-id').value || null,
                name: document.getElementById('person-name').value,
                dob: document.getElementById('person-dob').value,
                gender: document.getElementById('person-gender').value,
                occupation: document.getElementById('person-occupation').value,
                location: document.getElementById('person-location').value,
                comments: document.getElementById('person-comments').value
            };

            if (this.onSavePerson) this.onSavePerson(personData);
            modal.close();
        });

        deleteBtn.addEventListener('click', () => {
             const id = document.getElementById('person-id').value;
             // Basic confirm check
             if(id && confirm("Are you sure you want to delete this person and all their relationships?")) {
                  if(this.onDeletePerson) this.onDeletePerson(id);
                  modal.close();
             }
        });
    },

    bindRelationModal() {
        const modal = document.getElementById('relation-modal');
        const form = document.getElementById('relation-form');
        const deleteBtn = document.getElementById('delete-relation-btn');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('rel-id').value || null;
            const sourceId = document.getElementById('rel-source').value;
            const targetId = document.getElementById('rel-target').value;
            const type = document.getElementById('rel-type').value;

            if(sourceId === targetId) {
                alert("Cannot link a person to themselves.");
                return;
            }

            if (this.onSaveRelation) this.onSaveRelation({ id, sourceId, targetId, type });
            modal.close();
        });
        
        deleteBtn.addEventListener('click', () => {
             const id = document.getElementById('rel-id').value;
             if(id && confirm("Are you sure you want to delete this relationship link?")) {
                  if(this.onDeleteRelation) this.onDeleteRelation(id);
                  modal.close();
             }
        });
    },

    openChoiceModal(personName, onChoose) {
        const modal = document.getElementById('choice-modal');
        document.getElementById('choice-person-name').textContent = personName;
        
        let childBtn = document.getElementById('btn-choice-child');
        let spouseBtn = document.getElementById('btn-choice-spouse');
        
        // Remove old listeners by replacing nodes
        const newChildBtn = childBtn.cloneNode(true);
        const newSpouseBtn = spouseBtn.cloneNode(true);
        childBtn.parentNode.replaceChild(newChildBtn, childBtn);
        spouseBtn.parentNode.replaceChild(newSpouseBtn, spouseBtn);
        
        newChildBtn.addEventListener('click', () => {
            modal.close();
            onChoose('parent-child');
        });
        
        newSpouseBtn.addEventListener('click', () => {
            modal.close();
            onChoose('spouse');
        });
        
        modal.showModal();
    },

    openPersonModal(existingPerson = null, customTitle = null, prefillData = {}) {
        const modal = document.getElementById('person-modal');
        const form = document.getElementById('person-form');
        const deleteBtn = document.getElementById('delete-person-btn');
        const title = document.getElementById('person-modal-title');

        form.reset();

        if (existingPerson) {
             title.textContent = "Edit Person";
             deleteBtn.style.display = 'block';

             document.getElementById('person-id').value = existingPerson.id;
             document.getElementById('person-name').value = existingPerson.name;
             document.getElementById('person-dob').value = existingPerson.dob || '';
             document.getElementById('person-gender').value = existingPerson.gender || '';
             document.getElementById('person-occupation').value = existingPerson.occupation || '';
             document.getElementById('person-location').value = existingPerson.location || '';
             document.getElementById('person-comments').value = existingPerson.comments || '';
        } else {
             title.textContent = customTitle || "Add Person";
             deleteBtn.style.display = 'none';
             document.getElementById('person-id').value = '';
             if (prefillData.gender) {
                 document.getElementById('person-gender').value = prefillData.gender;
             }
        }

        modal.showModal();
    },

    openRelationModal(existingRelation = null) {
        const modal = document.getElementById('relation-modal');
        const form = document.getElementById('relation-form');
        const deleteBtn = document.getElementById('delete-relation-btn');
        const title = document.getElementById('relation-modal-title');
        const sourceSelect = document.getElementById('rel-source');
        const targetSelect = document.getElementById('rel-target');
        
        // Will be populated by main.js before opening but we reset the form first
        form.reset();
        
        if (existingRelation) {
             title.textContent = existingRelation.id ? "Edit Relationship" : "Add Relationship";
             deleteBtn.style.display = existingRelation.id ? 'block' : 'none';
             
             document.getElementById('rel-id').value = existingRelation.id || '';
             sourceSelect.value = existingRelation.sourceId;
             targetSelect.value = existingRelation.targetId;
             document.getElementById('rel-type').value = existingRelation.type || '';

             // Prevent changing the bound persons on an pre-filled link
             sourceSelect.disabled = true;
             targetSelect.disabled = true;
        } else {
             title.textContent = "Add Relationship";
             deleteBtn.style.display = 'none';
             document.getElementById('rel-id').value = '';

             // Allow selecting for new links (if ever opened manually, though we removed the global button)
             sourceSelect.disabled = false;
             targetSelect.disabled = false;
        }
        
        modal.showModal();
    },
    
    populateRelationDropdowns(persons) {
        const sourceSelect = document.getElementById('rel-source');
        const targetSelect = document.getElementById('rel-target');
        
        sourceSelect.innerHTML = '';
        targetSelect.innerHTML = '';
        
        persons.forEach(p => {
             const option1 = document.createElement('option');
             option1.value = p.id;
             option1.textContent = p.name;
             sourceSelect.appendChild(option1);
             
             const option2 = document.createElement('option');
             option2.value = p.id;
             option2.textContent = p.name;
             targetSelect.appendChild(option2);
        });
    }
};
