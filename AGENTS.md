# Agents Developer Guide

This repository contains the source code for the Family Tree Visualization application. It relies deliberately on low-level zero-dependency architectures to maximize rendering efficiency and offline compatibility.

## Core Directives for Changes

When adjusting UI or rendering mechanics, refer to the following constraints:

1. **Storage Constraint**: All persistent properties must be channeled through `js/db.js` into IndexedDB. State is not saved to the cloud natively. If schema modifications occur on `persons` or `relationships` or UI `settings`, you must strictly increment the `DB_VERSION` variable inside `initDB()`. Position updates specifically utilize a 2-second debounce mechanism to prevent rapid write locks from freezing the UI during continuous canvas dragging. Features like Freeze/Lock state must be aggressively forced on Import actions.
2. **Modular Integrity**:
   - UI form events and toolbars are strictly isolated within `js/ui.js`.
   - Drawing properties mapping to coordinates must exclusively be done in `js/render.js`.
   - Never use direct global variables across modules. Everything must be passed into controllers or managed within `main.js`.
3. **SVG Connection Layer**: The relationship visualizing links heavily rely on Safari/WebKit rendering constraints. Do not modify the `<svg>` DOM container footprint (`width: 1px; height: 1px`) inside `index.html`. It relies on absolute `overflow: visible` trickery to draw across the infinite grid canvas. A sibling `#handles-layer` overlay tracks draggable endpoints securely independently from the SVG `<path>`s.
4. **Vanilla Enforcement**: Do not introduce NPM modules, Webpack build steps, or frameworks (React, Vue, etc.) for UI components without an explicit directive.
5. **Interaction Mapping**: Mac browsers hijack `Ctrl + Click` to open Context Menus (Right-Click). Any logic intended for multi-selection or alternate actions MUST utilize `Shift Key` or `Meta Key` (Cmd) strictly instead of `Ctrl`.

## Smart Interaction Rules

These rules are implemented in `main.js` and `render.js` and must be preserved:

6. **Long-Press Detection (500ms)**: On mobile, a long-press on a person node triggers the "Add Relative" flow (same as clicking the marker). A long-press on a spouse line triggers "Add Child". The timer must be cancelled if the finger moves (drag) or is lifted quickly (tap). Implemented via `setTimeout` with `clearTimeout` on `pointermove`/`pointerup`/`pointercancel`.
7. **Smart Gender Prefill**: When the "Add Spouse" flow is triggered, `startAddingRelative` must infer the opposite gender from the source person and pass it via `prefillData.gender` to `openPersonModal`. If source gender is "other" or missing, leave blank to force manual selection.
8. **Smart Relationship Type Detection**: In `onLinkNodes`, compare the `x`/`y` positions of source and target persons. If `|dx| > |dy|` → suggest "spouse". If `dy > 0` → suggest "parent-child". Otherwise leave the type dropdown empty (force manual pick).
9. **Position Near Source**: New relatives created via `startAddingRelative` must be placed near the source: spouse at `x+220, same y`; child at `same x, y+200`; child from spouse line below the midpoint of both parents.
10. **Max 2 Parents Enforcement**: Before creating a `parent-child` relation, call `getParentCount(childId)`. If ≥ 2, block with an alert. This applies in `onSaveRelation`, and `onLinkSpouseToChild` (which checks the combined count of new links needed).
11. **Unified Spouse-Child Deletion**: When a child has 2 parents who are spouses, the child line renders as a single SVG path from the spouse midpoint. The hitbox click handler passes **both** `parentRels` to `onRelationClick`. `onDeleteRelation` must delete the `pairedRelation` as well, preventing orphan re-attachment.
12. **Always Show Choice Modal**: `onAddRelativeFromPerson` must always open the choice modal (Child or Spouse) regardless of existing spouse count, supporting polygamous family trees.

## Implementation Details
- `x` and `y` tracking occurs dynamically when a `.person-node` is dragged. `js/render.js` relies on inverse transformation scaling mapped to the mathematical `canvasController.scale` variable from `js/canvas.js` to ensure the pointer correctly offsets nodes regardless of the camera zoom level.
- Bezier curves utilize the source node's true geometrical center mapping directly to the target node's geometrical center (`x + width/2, y + height/2`) for both horizontal and vertical lineages, replacing old edge-anchors for predictable arranging.
- Drag indicator lines use direct pointer-to-canvas coordinate conversion via `container.getBoundingClientRect()`, `translateX`, `translateY`, and `scale` to track precisely under the pointer at any zoom level.
