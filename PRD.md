# Product Requirements Document (PRD): Family Tree Visualization

## Overview
A lightweight, client-side web application for visualizing family trees. Users can dynamically add people, specify their details (Name, DOB, Gender, Occupation, Location, Comments), and connect them with designated relationships (Parent-Child, Spouse).

## Core Requirements
### 1. Data Management
- **Local Persistence:** Data must be saved directly to the user's browser via IndexedDB (`FamilyTreeDB`) for immediate reloads across sessions. IndexedDB supports multiple stores (`persons`, `relationships`, and user configuration `settings`).
- **CRUD Entities (Person):** Ability to add, edit, and delete people nodes. Gender input must be rigorously enforced (Male/Female/Other) to block incomplete data states.
- **CRUD Entities (Relationships):** Ability to add and delete relation paths between existing nodes.
- **Data Portability:** Features must exist to export the entire state as a `.json` blob and similarly import to overwrite/recover state. Imported files will always automatically set the `isFrozen` UI lock.
- **Clear All Data:** A dedicated button (with confirmation prompt) allows users to wipe all persons and relations from the database instantly.

### 2. Canvas Interaction
- **Infinite Pane:** The primary canvas must allow drag-to-pan actions (click background and drag) and scroll-wheel zoom (in/out centered to pointer). A Home button exists to intelligently reset and center the canvas frame dynamically mapping the outer bounds of all loaded nodes.
- **Freeze Mode:** Applications must support a persisted "Freeze Mode" where all structural modifications (adding nodes, moving nodes, drawing links) are locked, preserving only pan and zoom functions for clean browsing.
- **Node Dragging & Multi-select:** Person nodes must physically be draggable across the canvas bounds, independent of pan. Positions are saved to the database via a debounced write to prevent UI freezes. Users may Shift-click or Cmd-click multiple targets to group and drag them simultaneously.
- **Drag-to-Connect & Click-to-Add:** Users can connect two people by dragging a connection line from a plus icon on one node directly to another. Alternatively, single-clicking the link marker intelligently routes them into an "Add Relative" dialog mapped automatically to the clicked source.
- **Dual-Parent Linking:** Hovering over a spouse relationship line reveals a plus handle. Dragging from this handle (or single-clicking it) to a child automatically links that child to both parents simultaneously.
- **Responsive Toolbar:** The floating toolbar wraps and scales gracefully on mobile viewports (dividers are hidden below 600px).

### 3. Smart Rules & Behaviors
- **Long-Press (Mobile):** On touch devices, long-pressing (500ms) a person node triggers the same "Add Relative" flow as clicking the marker. Long-pressing a spouse line triggers "Add Child". Both cancel cleanly if the finger moves.
- **Smart Gender Guessing:** When adding a spouse, the gender of the new person is automatically pre-filled as the opposite of the source person (male↔female). If the source is "Other", the field is left blank and must be manually selected.
- **Smart Relationship Detection:** When dragging a link from one person to another, the relationship type is inferred from the drag direction:
  - Horizontal drag (left/right) → pre-selects **Spouse**
  - Downward drag → pre-selects **Parent-Child**
  - Upward or ambiguous → leaves blank, forcing manual selection
- **Contextual Modal Titles:** The person modal title dynamically reflects the action: "Add Child", "Add Spouse", or "Add Person" depending on the flow.
- **Position Near Source:** New relatives are placed in the vicinity of their source person:
  - Spouse → to the right (+220px, same row)
  - Child from person → directly below (+200px)
  - Child from spouse line → below the midpoint of both parents
- **Max 2 Parents:** A person cannot have more than 2 parent-child relationships as the child. An error is shown if this limit is exceeded.
- **Unified Spouse-Child Deletion:** Deleting a parent-child line that originates from a spouse midpoint removes both parent links simultaneously, preventing orphan re-attachment.
- **Always Show Choice Modal:** Clicking a person's marker always presents the Child/Spouse choice dialog, supporting multiple spouses per person.

### 4. Visualizations
- **Nodes:** Each person renders as a styled card complete with a silhouette avatar reflecting their gender input.
- **Relationships:** Links dynamically render as SVG paths tracking from the absolute core geometrical center (width/2, height/2) of a source node to the geometric center of a target node.
  - Spouse links render as dotted red lines.
  - Parent-Child links render as solid blue lines.
  - Children shared between documented spouses render as a single unified blue connection originating from the core midpoint of the dotted red spouse line, vastly improving visual hierarchy.

## Target Architecture
- **HTML/CSS/JS** exclusively. No build tools or large framework dependencies (e.g., React, D3) to maintain ultra-fast initialization and portability.
- **File Structure:**
    - `index.html` structure
    - `style.css` styles
    - `js/main.js` core bootstrapping
    - `js/db.js` async storage layer
    - `js/ui.js` DOM listeners and modal forms
    - `js/render.js` Canvas manipulation and Math
    - `js/canvas.js` Abstract panning and zooming container logic
