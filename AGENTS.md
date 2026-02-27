# Agents Developer Guide

This repository contains the source code for the Family Tree Visualization application. It relies deliberately on low-level zero-dependency architectures to maximize rendering efficiency and offline compatibility.

## Core Directives for Changes

When adjusting UI or rendering mechanics, refer to the following abstractions constraints:

1. **Storage Constraint**: All persistent properties must be channeled through `js/db.js` into IndexedDB. State is not saved to the cloud natively. If schema modifications occur on `persons` or `relationships` or UI `settings`, you must strictly increment the `DB_VERSION` variable inside `initDB()`. Position updates specifically utilize a 2-second debounce mechanism to prevent rapid write locks from freezing the UI during continuous canvas dragging. Features like Freeze/Lock state must be aggressively forced on Import actions.
2. **Modular Integrity**:
   - UI form events and toolbars are strictly isolated within `js/ui.js`.
   - Drawing properties mapping to coordinates must exclusively be done in `js/render.js`.
   - Never use direct global variables across modules. Everything must be passed into controllers or managed within `main.js`.
3. **SVG Connection Layer**: The relationship visualizing links heavily rely on Safari/WebKit rendering constraints. Do not modify the `<svg>` DOM container footprint (`width: 1px; height: 1px`) inside `index.html`. It relies on absolute `overflow: visible` trickery to draw across the infinite grid canvas. A sibling `#handles-layer` overlay tracks draggable endpoints securely independently from the SVG `<path>`s.
4. **Vanilla Enforcement**: Do not introduce NPM modules, Webpack build steps, or frameworks (React, Vue, etc.) for UI components without an explicit directive.
5. **Interaction Mapping**: Mac browsers hijack `Ctrl + Click` to open Context Menus (Right-Click). Any logic intended for multi-selection or alternate actions MUST utilize `Shift Key` or `Meta Key` (Cmd) strictly instead of `Ctrl`.

## Implementation Details
- `x` and `y` tracking occurs dynamically when a `.person-node` is dragged. `js/render.js` relies on inverse transformation scaling mapped to the mathematical `canvasController.scale` variable from `js/canvas.js` to ensure the pointer correctly offsets nodes regardless of the camera zoom level.
- Bezier curves utilize the source node's true geometrical center mapping directly to the target node's geometrical center (`x + width/2, y + height/2`) for both horizontal and vertical lineages, replacing old edge-anchors for predictable arranging.
