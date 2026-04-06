# Copilot Instructions for SynchroEdit

## Commands

### Development

- **Start production mode:** `npm start`
- **Start dev mode:** `npm run dev` (disables secure cookies for local HTTP testing)

### Testing

- **Run all tests:** `npm test` (unit + integration)
- **Unit tests only:** `npm run test:unit`
- **Integration tests only:** `npm run test:integration`
- **E2E tests:** `npm run test:e2e` (Playwright)
- **Run specific test file:** `npm run test:unit -- <path>` or `npm run test:integration -- <path>`
- **Run single test:** Add `.only` to test/describe block (e.g., `test.only(...)`)

### Code Quality

- **Lint:** `npm run lint`
- **Format:** `npm run format`

## Architecture Overview

### Real-Time Sync Engine

SynchroEdit uses **Yjs (CRDT)** for conflict-free collaborative editing:

- **Binary Storage:** Document state is stored as Base64-encoded Yjs updates in MongoDB (`yjsState` field)
- **Server-Side Y.Doc:** Backend maintains in-memory Y.Doc instances (`src/sockets/documentSocket.js`)
- **Debounced Persistence:** Changes are batched and saved to MongoDB after 2 seconds
- **WebSocket Protocol:** Uses `y-protocols/sync` and `y-protocols/awareness` for real-time synchronization
- **Direct Buffer Application:** Updates are applied from Buffers without intermediate serialization for performance

### Frontend Architecture

Modular class-based architecture with distinct responsibilities:

#### Core (`/public/js/core`)

- **`app.js`**: Main `App` class that bootstraps the application and manages global instances
- Sets `window.app` globally for cross-module access

#### Feature Modules (`/public/js`)

Organized by feature domain:

- **`/ui`**: UI components (`Auth`, `Theme`, `Profile`, `UIManager`, `DynamicBackground`)
- **`/editor`**: Editor integration (location varies by file structure)
- **`/managers`**: Specialized handlers (document library, page virtualization, cursors, etc.)

Key managers referenced in code:

- **`LibraryManager`**: Document listing, caching (IndexedDB), creation
- **`UIManager`**: Modal orchestration, centralized event handling
- **`PageManager`**: A4 pagination, dynamic page mounting/unmounting
- **`CursorManager`**: Remote cursor synchronization and awareness

### Backend Structure (`/src`)

Feature-based organization:

```
/src
├── server.js              # Entry point: HTTP + WebSocket setup
├── /auth                  # JWT authentication, session management
├── /documents             # Document models, controllers, WebSocket sync
│   ├── Document.js        # Mongoose model
│   └── History.js         # Version history model
├── /users                 # User profiles and account management
├── /middleware            # Security, auth, error handling
├── /sockets
│   └── documentSocket.js  # Core Yjs sync logic
├── /routes                # RESTful API definitions
├── /controllers           # API request handlers
└── /utils                 # Logging, shutdown handlers
```

## Key Conventions

### Yjs Document Structure

Documents use a specific Yjs data structure:

```javascript
// Root structures in Y.Doc
const pages = doc.getArray('pages'); // Array of page Y.Maps
const meta = doc.getMap('meta'); // Document metadata (title, etc.)

// Each page structure
const page = new Y.Map();
page.set('content', new Y.Text()); // Page content as Y.Text
```

When working with documents:

- Always use `Document.findById(id).select('+yjsState')` because `yjsState` has `select: false` in the schema
- Apply binary updates with `Y.applyUpdate(doc, Buffer.from(base64, 'base64'))`
- Extract state with `Y.encodeStateAsUpdate(doc)`

### Frontend Performance Patterns

#### Cache-First Loading

Documents load instantly from IndexedDB before WebSocket sync:

1. Check IndexedDB cache
2. Render cached content immediately
3. WebSocket syncs in background
4. Merge updates when available

#### Page Virtualization

The editor uses `IntersectionObserver` to mount/unmount pages dynamically:

- Only visible pages are rendered in the DOM
- Neighbor pages are pre-mounted to eliminate lag
- Critical for performance with large documents

### Theme System

**Never hardcode colors.** The UI uses a dynamic accent color engine:

- User selects one accent color
- System generates complementary shades programmatically
- Use CSS variables or the `Theme` class methods
- Applies to buttons, borders, selections, cursor colors, background effects

### Testing Conventions

#### Backend Tests

- **Integration tests:** Use `mongodb-memory-server` for real database operations
- **CSRF mocking:** CSRF protection is automatically mocked via `tests/mocks/csrf.js`
- **Test isolation:** `beforeEach` clears User, Document, and History collections

#### Frontend Tests

- **Test environment flag:** Set `window.testEnv = true` to prevent automatic `App` instantiation
- **Module mocking:** Yjs WebSocket and Quill modules are mocked in Jest config
- Uses `jest-environment-jsdom` for DOM testing

#### E2E Tests

- Playwright launches a test server automatically (`tests/e2e/start-server.js`)
- Runs on `http://localhost:3000` with `reuseExistingServer: true` in dev
- Tests both desktop (Chrome) and mobile (Pixel 5) viewports

### Environment Configuration

Development requires a `.env` file (see `.env.example`):

**Critical variables:**

- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT signing (generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- `DISABLE_SECURE_COOKIE`: Set to `true` for local HTTP development (required for `npm run dev`)

**Optional:**

- `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEYS`: RSA keys for production JWT signing
- `ENABLE_EMAIL_VERIFICATION`: Enable email verification flows
- Email settings (`EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASSWORD`)

### Security Patterns

- **JWT tokens:** Stored in HTTP-only cookies (secure in production)
- **CSRF protection:** Uses `csrf-csrf` middleware
- **Rate limiting:** Applied to auth endpoints
- **Helmet:** Security headers configured
- **bcrypt:** Password hashing with salt rounds

## Project-Specific Patterns

### WebSocket Message Flow

```javascript
// Client connects -> Server verifies JWT/ticket
// Client sends sync messages -> Server updates Y.Doc
// Server broadcasts to all clients on document
// Debounced save to MongoDB every 2 seconds
```

### Document Lifecycle

1. **Load:** Fetch from IndexedDB → Connect WebSocket → Sync with server
2. **Edit:** Local Quill changes → Yjs captures → Broadcast via WebSocket
3. **Persist:** Server batches updates → Saves to MongoDB (debounced)

### Awareness (Live Cursors)

Uses `y-protocols/awareness` to share:

- Cursor position
- Selection range
- User name and accent color

State is ephemeral (not persisted to DB).

## Common Gotchas

1. **Mongoose select:** `yjsState` field requires explicit selection with `+yjsState`
2. **Test environment:** Frontend tests must set `window.testEnv = true` before importing `app.js`
3. **WebSocket lifecycle:** Server must call `doc.conns.set(ws, ...)` and clean up on disconnect
4. **Buffer handling:** Always convert Base64 strings to Buffer when applying Yjs updates
5. **CSRF in tests:** Integration tests automatically mock CSRF; unit tests skip it with `SKIP_DB_SETUP=true`

## Development Workflow

### Adding a New Feature

1. **Backend:** Create module in `/src/<feature>` with controller, routes, and model
2. **Frontend:** Add class/module to `/public/js/<feature>`
3. **Wire up:** Import and instantiate in `app.js` if needed globally
4. **Test:** Add integration tests (backend) and unit/E2E tests (frontend)

### Debugging Real-Time Sync

- Check WebSocket connection in browser DevTools (Network → WS)
- Server logs document state size on load
- Use `Y.logUpdate(update)` to inspect binary updates
- Verify `doc.conns` Map tracks active connections

### Running Tests in Watch Mode

Jest doesn't have built-in watch mode configured. To run tests continuously:

```bash
npx jest --watch tests/unit
```

## File Locations

### Configuration

- ESLint: `config/.eslintrc.json` + `config/.eslintignore`
- Prettier: `config/.prettierrc` + `config/.prettierignore`
- Playwright: `playwright.config.js`
- Jest: Inline in `package.json`

### Entry Points

- **Backend:** `src/server.js`
- **Frontend:** `public/js/core/app.js` (loaded via `public/index.html`)
- **Service Worker:** `public/sw.js` (offline caching)
