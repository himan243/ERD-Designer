# Project Context: ERD Designer (Final Checkpoint v1.0)

ERD Designer is a professional, mobile-optimized web-based tool for modeling Entity-Relationship Diagrams.

## Tech Stack
- **Frontend:** React 18+, TypeScript, Vite, Vanilla CSS.
- **Library:** `@xyflow/react` (React Flow) for diagramming.
- **Backend:** Node.js, Express (REST API).
- **Deployment:** Ready for Render.com (Client: Static Site, Server: Web Service).

## Core Logic & Features
- **Entities:** Table-based structure. 
  - Internal attribute management with "Click to Add" (+).
  - Primary Key (PK) toggle (underlined text + key icon).
  - Hover-to-reveal delete actions for attributes.
- **Relationships:** Fixed-size diamond (perfect square rotated 45deg). 
  - Cardinality pickers (1, N, M) positioned precisely on the left and right points.
  - Hover-to-reveal cardinality selection.
- **Connection Rules:** 
  - Strictly prohibits direct connections between same-type nodes (Entity-to-Entity or Relationship-to-Relationship).
  - 90-degree orthogonal routing (`SmoothStep` edges) with 16px border radius.
  - Connection radius set to 50 for easy snapping.
- **UI Components:**
  - **Action Toolbar:** Top-center panel containing Undo, Redo, and a Delete Selected button.
  - **Collapsible Sidebar:** Toggleable via Ctrl + B or menu icon; uses "Click to Add" logic for mobile.
  - **Branding:** Title "ERD Designer", Custom attribution "Himan Kalita - 2026" in the bottom-right panel.
- **Interactions:**
  - **Undo/Redo:** Full 50-state history management.
  - **Mobile:** One-finger panning (`panOnDrag`), pinch-to-zoom, and tap-to-place sidebar items.
  - **Default Theme:** Dark Mode.

## Keyboard Shortcuts
- `Ctrl + Z`: Undo
- `Ctrl + Y`: Redo
- `Ctrl + B`: Toggle Sidebar
- `Delete / Backspace`: Delete selected items (context-aware)
- `Enter`: Save and deselect text during inline editing

## Deployment Details
- **Environment Variable:** `VITE_API_URL` for the frontend.
- **Backend Port:** `process.env.PORT || 5000`.
- **Health Check:** `/health` endpoint added for Render monitoring.

## Maintenance
- Always run `npm run build` in the `client` folder to verify TypeScript types before deployment.
