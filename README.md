SYNCHROEDIT | PROJECT OVERVIEW

1. DESCRIPTION
SynchroEdit is a real-time collaborative document editor. It features a 
minimalist "Dark OLED" aesthetic and uses CRDT technology to allow 
multiple people to edit the same document simultaneously without conflicts.

2. KEY FEATURES
- Real-time Editing: Instant sync across all users via Yjs and WebSockets.
- Visual Presence: See others' cursors with names and personalized colors.
- OLED Theming: True black background with a dynamic accent color engine.
- Math Support: Shorthand translation for mathematical symbols (e.g. sqrt).
- Page Layout: A4-style pagination that creates new pages as you type.
- Security: Secure login with JWT, hashed passwords, account lockouts, email verification, and password resets.

3. DYNAMIC THEME SYSTEM
The UI is algorithmically generated based on your chosen accent color:
- The system calculates lighter and darker shades automatically.
- It applies these to button glows, borders, and selection highlights.
- A canvas-based constellation background reacts to the chosen color.

4. TECHNICAL STACK
- Frontend: Vanilla JavaScript (ES Modules), Tailwind CSS, Quill.js.
- Sync Engine: Yjs (CRDT) over WebSockets.
- Backend: Node.js and Express.
- Database: MongoDB via Mongoose.



5. PROJECT STRUCTURE
- /public/js/core: Main application and networking logic.
- /public/js/editor: Editor initialization and Yjs bindings.
- /public/js/ui: Theme engine and interface components.
- /src/controllers: API request handlers.
- /src/middleware: Express middleware.
- /src/models: Database schemas for users and documents.
- /src/routes: Express route definitions.
- /src/sockets: Server-side WebSocket handling.
- /src/utils: Utility functions.

6. QUICK START
1. Clone the repository.
2. Run "npm install".
3. Create a .env file with:
   - PORT: Server port (e.g., 3000)
   - MONGODB_URI: Connection string for MongoDB
   - JWT_SECRET: Secret key for JWT authentication
   - (Optional) SMTP_USER, SMTP_PASS: For email verification/password reset
4. Run "npm start".

7. LICENSE
Licensed under the ISC License.