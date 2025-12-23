# 📄 SynchroEdit

SynchroEdit is a modern, real-time collaborative document editor designed with a minimalist "Dark OLED" aesthetic. It leverages CRDT (Conflict-free Replicated Data Types) for seamless, conflict-free collaboration similar to Google Docs.

## ✨ Key Features

-   **Real-time Collaboration:** Powered by **Yjs** and **WebSockets** for instant, conflict-free editing across multiple users.
-   **Visual Presence:** Remote cursor tracking with name tags and user-specific accent colors.
-   **Dynamic Background:** Interactive canvas-based constellation background that follows the user's chosen accent color.
-   **Customizable UI:** True "OLED Black" dark mode and high-contrast light mode with user-definable accent colors.
-   **Math Editor (Roadmap):** Integrated shorthand translation (e.g., `sqrt(2)`) into formatted mathematical symbols.
-   **Rich Text Editing:** Full formatting suite (Bold, Italic, Lists, Alignment) powered by Quill.
-   **Multi-Page Layout:** Word-processor style multi-page experience with auto-paging.
-   **Secure Authentication:** JWT-based authentication with email verification (logged to console in dev mode).
-   **Persistence:** Automatic synchronization with MongoDB and debounced state saving.

## 🛠️ Tech Stack

-   **Frontend:** Vanilla TypeScript/JavaScript (ES Modules), Tailwind CSS, Quill.js, Yjs.
-   **Backend:** Node.js, Express.js.
-   **Real-time Engine:** WebSockets (`ws` library) with Yjs sync protocol.
-   **Database:** MongoDB via Mongoose.
-   **Security:** JWT, bcryptjs, Helmet CSP, express-rate-limit.

## 🚀 Getting Started

### Prerequisites

-   Node.js (v16+)
-   MongoDB (Local or Atlas)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/golba98-dev/SynchroEdit.git
    cd SynchroEdit
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment:**
    Create a `.env` file in the root directory:
    ```env
    PORT=3000
    MONGODB_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret_key
    SMTP_USER=optional_smtp_user
    SMTP_PASS=optional_smtp_password
    ```

4.  **Start the server:**
    ```bash
    npm start
    ```

## 📁 Project Structure

-   `/public`: Frontend assets, ES modules, and styles.
    -   `/js/core`: Main application logic and network handling.
    -   `/js/editor`: Real-time editor engine and Yjs bindings.
    -   `/js/managers`: Page, border, and cursor management.
    -   `/js/ui`: Theme, profile, and UI component controllers.
-   `/src`: Backend source code.
    -   `/controllers`: API request handlers.
    -   `/models`: Mongoose schemas.
    -   `/routes`: Express route definitions.
    -   `/sockets`: WebSocket and Yjs synchronization logic.
-   `/tests`: Comprehensive test suite.

## 🧪 Development

-   **Run Tests:** `npm test`
-   **Linting:** `npm run lint`
-   **Formatting:** `npm run format`

## 📜 License

This project is licensed under the ISC License.
