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

```
SynchroEdit/
├── config/              # Configuration files (ESLint, Prettier, Playwright, Babel)
├── docs/                # Development documentation
│   ├── AI_CONTEXT.md   # AI assistant context and conventions
│   ├── AGENTS.md       # AI agent instructions
│   ├── PERFORMANCE.md  # Performance optimization plans
│   ├── SECURITY_CHECKLIST.md
│   └── SETUP.md        # Detailed setup instructions
├── public/             # Frontend static files
│   └── js/
│       ├── app/        # Application initialization
│       ├── core/       # Core application lifecycle
│       ├── editor/     # Central Editor class
│       ├── features/   # Feature modules (auth, theme, etc.)
│       ├── managers/   # Specialized handlers (pages, library, cursors)
│       └── ui/         # UI components and controllers
├── scripts/            # Utility scripts
│   ├── dev/           # Development utilities
│   └── test/          # Test utilities
├── src/               # Backend source code
│   ├── auth/          # Authentication & JWT logic
│   ├── documents/     # Document models & WebSocket sync
│   ├── middleware/    # Express middleware (security, auth, errors)
│   ├── users/         # User profiles & account management
│   ├── utils/         # Server utilities & logging
│   └── server.js      # Application entry point
├── tests/             # Test suites
│   ├── e2e/           # End-to-end (Playwright)
│   ├── frontend/      # Frontend unit tests
│   ├── integration/   # Backend integration tests
│   └── unit/          # Backend unit tests
└── logs/              # Runtime logs (gitignored)
```

For detailed architecture and development guidance, see [`docs/AI_CONTEXT.md`](docs/AI_CONTEXT.md).

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

   See [`docs/SETUP.md`](docs/SETUP.md) for detailed configuration instructions.

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
