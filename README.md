# SynchroEdit

## 1. Description
SynchroEdit is a high-performance, real-time collaborative document editor. It features a minimalist "Dark OLED" aesthetic and utilizes CRDT technology (**Yjs**) to allow seamless multi-user collaboration without merge conflicts.

## 2. Key Features
- **Real-time Editing**: Instant synchronization across all users via Yjs and WebSockets.
- **Visual Presence**: Live cursor tracking with user names and personalized accent colors.
- **OLED Theming**: True black background with a dynamic, algorithmically-generated accent color engine.
- **Page Layout Engine**: A4-style pagination that dynamically manages content flow and page creation.
- **Robust Security**: Secure authentication with JWT, refresh tokens, Bcrypt hashing, account lockouts, and full email verification flows.
- **Offline Support**: Document persistence via IndexedDB allows for instant loading and offline resiliency.

## 3. Dynamic Theme System
The UI adaptively generates its color palette based on a user's chosen accent color:
- **Shade Generation**: The system calculates complementary lighter and darker shades on the fly.
- **Visual Cohesion**: Themes are applied to button glows, borders, selection highlights, and UI transitions.
- **Interactive Background**: A canvas-based constellation background reacts to the current theme.

## 4. Technical Stack
- **Frontend**: Vanilla JavaScript (ES Modules), Quill.js, Yjs.
- **Sync Engine**: Yjs (CRDT) over WebSockets.
- **Backend**: Node.js, Express.
- **Database**: MongoDB via Mongoose.
- **Storage**: IndexedDB (Frontend Cache).

## 5. Project Structure
The project follows a modular, manager-based architecture for maximum maintainability.

### Frontend (`/public/js`)
- **`/core`**: Core application lifecycle (`app.js`) and network abstraction.
- **`/editor`**: The central `Editor` class and its primary integration logic.
- **`/managers`**: Specialized logic handlers:
    - `PageManager`: Handles pagination and layout engine logic.
    - `LibraryManager`: Manages document listing, caching, and creation.
    - `CursorManager`: Synchronizes remote cursors and awareness state.
    - `BorderManager`, `ImageManager`, `NavigationManager`, etc.
- **`/ui`**: Interface components and theme controllers.
    - `UIManager`: Centralized event handling and modal orchestration.
    - `ToolbarController`: Logic for the rich-text editing toolbar.

### Backend (`/src`)
- **`/controllers`**: Clean API request handlers.
- **`/middleware`**: Modular Express middleware (Auth, Error handling, Security).
- **`/models`**: Mongoose schemas for Users, Documents, Sessions, and History.
- **`/routes`**: RESTful API route definitions.
- **`/sockets`**: Real-time WebSocket event orchestration.
- **`/utils`**: Server utilities including logging and graceful shutdown handlers.

## 6. Quick Start
1. **Clone the repository**.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment**: Create a `.env` file in the root:
   ```env
   PORT=3000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   # Optional for Email Features
   EMAIL_HOST=smtp.mailtrap.io
   EMAIL_PORT=2525
   EMAIL_USERNAME=your_username
   EMAIL_PASSWORD=your_password
   ```
4. **Start the server**:
   ```bash
   npm start
   ```

## 7. License
Licensed under the ISC License.
