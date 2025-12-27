# Performance Plan: Accelerating Document Generation

This plan outlines strategies to significantly increase the speed of document generation and initial load times for SynchroEdit, focusing on architecture and data flow optimizations without immediate code implementation.

## 1. Bottleneck Analysis (Current State)
*   **Client-Side Initialization:** Currently, the client (browser) is responsible for initializing the first page structure upon connection. This creates a "round-trip" delay:
    1.  Client connects.
    2.  Client sees empty doc.
    3.  Client creates page structure.
    4.  Client syncs back to server.
*   **Sequential Loading:** The application loads the UI shell, then connects WebSocket, then fetches data.
*   **Database Writes:** New documents might be synchronously writing initial state to MongoDB before confirming creation.

## 2. Server-Side Pre-Initialization (The "Hot Start" Strategy)
**Goal:** eliminate the client-side "first page creation" step.

*   **Server-Side Templates:** When `POST /api/documents` is called, the server should generate the initial Yjs binary state (with Page 1 already created) and save it to MongoDB immediately.
*   **Pre-computed State:** Store a "blank document" Yjs state buffer in memory or cache. When a new doc is requested, clone this buffer instead of building it from scratch.
*   **Zero-Latency Connect:** When the client connects via WebSocket, the document is *already populated*. The client simply renders it immediately upon the first sync step, removing the "wait -> check empty -> create -> sync" cycle.

## 3. Optimistic UI & Local First
**Goal:** Make the UI interactive immediately, before the server responds.

*   **Local Shell Generation:** The "New Document" button should immediately navigate to the editor and render a local, temporary "Untitled" document in memory.
*   **Background Sync:** While the user starts typing, the app performs the API call to create the ID and connect the WebSocket in the background.
*   **Seamless Transition:** Once the server connection is established, merge the local changes (typed during the wait) with the server state transparently.

## 4. Database Optimization
**Goal:** Reduce `createDocument` API latency.

*   **Async Persistence:** The `createDocument` API endpoint should only create the metadata (ID, Owner). The heavy Yjs state initialization can be deferred or handled by the WebSocket server upon first connection.
*   **Read vs. Write Models:** Use a lightweight model for the document list (just title/date) and a heavy model for content. Don't load full document content just to verify existence.

## 5. Network & Caching
**Goal:** Faster asset delivery.

*   **Aggressive Caching:** Ensure `y-websocket`, `quill`, and other static assets have long-term cache headers (Immutable).
*   **Resource Preloading:** Use `<link rel="preload">` for critical scripts in `index.html`.
*   **Connection Warm-up:** If the user hovers over "New Document", start opening the WebSocket connection or fetching the ticket in anticipation.

## 6. Execution Steps (Summary)
1.  **Refactor Backend:** Move initial page creation logic from Client (`editor.js`) to Server (`documentController.js` or `documentSocket.js`).
2.  **Update API:** Ensure `POST /create` returns the new ID instantly.
3.  **Frontend Optimism:** Render the editor immediately on button click, using a temporary ID if necessary, then URL swap.
