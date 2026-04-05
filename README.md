# SynchroEdit

## 1. Description
SynchroEdit is a high-performance, real-time collaborative document editor. It features a minimalist "Dark OLED" aesthetic and utilizes CRDT technology (**Yjs**) to allow seamless multi-user collaboration without merge conflicts.

Test it out here: https://syncroedit.online

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

### Local Development
1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/synchroedit.git
   cd synchroedit
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**: 
   Copy the example environment file and update it with your settings:
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` and configure:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: Generate a secure secret using:
     ```bash
     node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
     ```
   - Generate RSA keys for JWT (optional but recommended):
     ```bash
     ssh-keygen -t rsa -b 2048 -m PEM -f jwtRS256.key
     openssl rsa -in jwtRS256.key -pubout -outform PEM -out jwtRS256.key.pub
     ```
   - Configure email settings if you want email verification features

4. **Start the server**:
   ```bash
   npm start
   ```

### Docker Deployment
1. **Copy and configure docker environment**:
   ```bash
   cp .env.docker.example .env
   ```
   Edit `.env` and set secure values for `JWT_SECRET` and RSA keys.

2. **Start with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

**Security Note**: Never commit your `.env` file or any file containing secrets to version control. All sensitive configuration is excluded via `.gitignore`.

## 7. License
Licensed under the ISC License.
