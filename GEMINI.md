# Project Context: ERD Designer

ERD Designer is a professional web-based tool for modeling Entity-Relationship Diagrams.

## Tech Stack
- **Frontend:** React 18+, TypeScript, Vite, Vanilla CSS.
- **Library:** `@xyflow/react` (React Flow) for diagramming.
- **Backend:** Node.js, Express (REST API).
- **Deployment:** Render.com (Client as Static Site, Server as Web Service).

## Core Logic & Features
- **Entities:** Table-based structure. Attributes managed via a `(+)` button inside the node.
- **Relationships:** Fixed-size diamond (square rotated 45deg). Cardinality pickers (1, N, M) positioned precisely on the left and right points.
- **Connection Rules:** 
  - Strictly prohibits direct connections between nodes of the same type (Entity-to-Entity or Relationship-to-Relationship).
  - 90-degree orthogonal routing (`SmoothStep` edges).
- **Interactions:**
  - **Undo/Redo:** Ctrl + Z / Ctrl + Y (50-state history).
  - **Sidebar Toggle:** Ctrl + B or menu icon.
  - **Mobile:** One-finger panning enabled via `panOnDrag`.
  - **Default Theme:** Dark Mode.

## Deployment Details
- **Frontend URL Environment Variable:** `VITE_API_URL`
- **Backend Port:** `process.env.PORT || 5000`
- **Persistence:** Local `diagrams.json` (Note: ephemeral on free hosting tiers).

## Maintenance
- Always run `npm run build` in the `client` folder to verify TypeScript types before pushing to GitHub.
