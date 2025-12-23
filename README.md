===========================================================
SYNCHROEDIT: PROJECT OVERVIEW
===========================================================

DESCRIPTION:
A real-time collaborative document editor focusing on speed, 
security, and a custom math formatting engine.

CORE FEATURES:
- Real-time Sync: CRDT-based collaboration (Yjs).
- Math Editor: Converts shorthand (sqrt, ^2) to formatted symbols.
- Rich Text: Full styling, image support, and multi-page layout.
- Security: JWT auth, bcrypt hashing, and rate limiting.
- Management: Version history, cursor tracking, and auto-save.

TECH STACK:
- Frontend: Vanilla JS (logic), Tailwind CSS (OLED UI), Quill.
- Backend: Node.js, Express.js.
- Real-time: WebSockets (ws).
- Database: MongoDB.
- Hosting: Render.

QUICK START:
1. npm install
2. Configure .env (PORT, MONGODB_URI, JWT_SECRET)
3. npm start

PROJECT STRUCTURE:
/public       - Client editor modules and styles
/src/sockets  - Real-time relay logic
/src/models   - MongoDB schemas (Docs/Users)
/src/routes   - API endpoints
/tests        - Jest/Supertest suite

DEVELOPMENT:
- Test: npm test
- Lint: npm run lint
- Format: npm run format

LICENSE: ISC
===========================================================