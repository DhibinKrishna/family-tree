# Family Tree Visualizer

A lightweight, purely client-side web application for conceptualizing, linking, and visualizing family trees interactively.

This tool was designed with speed, simplicity, and total offline privacy in mind. There are no backend dependencies, no cloud databases, and no user accounts required. 

## 🔒 100% Private & Local

**Your data never leaves your device.** 

This application uses your browser's internal `IndexedDB` storage to securely save your family tree entries directly to your hard drive. 
- **No Cloud Involvement:** We do not transmit, analyze, or sync your data to any external servers. 
- **Shareable JSON:** Because the app is offline-first, you can safely export your entire tree as a lightweight `.json` file at any time. This allows you to securely email or share your family tree directly with relatives, who can then import that exact file into their own local browser to view it using the same app.

## Features

- **Infinite Canvas:** Drag, pan, and scroll-wheel zoom around an infinite grid.
- **Node Dragging & Multi-select:** Draggable person nodes, plus the ability to Shift-Click (or Cmd-Click) multiple people to drag them together.
- **Dynamic Linking:** Smooth drag-and-drop relationship mapping, rendering spousal connections (red) and parent-child connections (blue). 
- **Smart Click-to-Add:** Instantly generate new relatives by clicking on relationship markers. A choice dialog lets you pick Child or Spouse.
- **Long-Press Support (Mobile):** Long-press a person node to add a relative, or long-press a spouse line to add a child — no markers needed on touch devices.
- **Smart Defaults:**
  - Gender is auto-guessed when adding a spouse (opposite of the source person).
  - Relationship type is inferred from drag direction (horizontal → spouse, downward → parent-child).
  - New relatives are placed near their source person automatically.
- **Data Validation:**
  - Gender selection is required (Male / Female / Other).
  - A person cannot have more than 2 parents.
  - Duplicate relationships are blocked.
- **Freeze Mode:** Lock your canvas to prevent accidental edits while browsing large trees, a state which persists across exports so you can safely share your tree in "Read-Only" mode.
- **Clear All:** Reset your entire family tree with one click (with confirmation).
- **Responsive Toolbar:** The toolbar adapts gracefully to mobile screen sizes.

## Installation / Usage

1. **Serve locally:** You just need any basic HTTP server to run the files. If you have Node installed, simply run:
   ```bash
   npx serve .
   ```
2. Navigate to the local URL (e.g. `http://localhost:3000`) in any modern browser!
