# SynchroEdit - Collaborative Document Editor

A real-time collaborative document editor built with Node.js and Quill Rich Text Editor.

## Phase 1: The Foundation (Local Setup) ✅

### Features Implemented

**Rich Text Editor Foundation:**
- ✅ Quill Rich Text Editor (replaces basic contentEditable)
- ✅ Quill Delta format for document representation (enables future real-time sync)
- ✅ Professional formatting toolbar with bold, italic, underline, alignment, lists

**Core Features:**
- ✅ Multiple pages support
- ✅ Zoom in/out functionality
- ✅ Image insertion
- ✅ Character & word count
- ✅ Auto-save to localStorage

**Server Infrastructure:**
- ✅ Express.js server for serving the application
- ✅ WebSocket support for real-time communication (ready for Phase 2)
- ✅ Document state management on server
- ✅ Message routing between clients

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

```bash
# Navigate to project directory
cd your-synchroedit-folder

# Install dependencies (already done)
npm install

# Start the server
npm start
```

The server will start at `http://localhost:3000`

## How It Works

### Quill Delta Format
Quill uses a "Delta" format to represent document changes:
```javascript
// Example Delta
{
  ops: [
    { insert: "Hello " },
    { insert: "World", attributes: { bold: true } },
    { insert: "\n" }
  ]
}
```

This format is:
- **Lightweight**: Easy to transmit over network
- **Operational**: Describes changes, not just content
- **Composable**: Perfect for merging multiple edits (needed for real-time collaboration)

### Architecture

```
┌─────────────┐                    ┌──────────────┐
│  Browser 1  │                    │  Browser 2   │
│  (Quill)    │                    │  (Quill)     │
└──────┬──────┘                    └──────┬───────┘
       │ WebSocket                        │
       │ Message: {type, data}            │
       └────────────┬──────────────────────┘
                    │
            ┌───────▼────────┐
            │  Node.js Server │
            │  (Express.js)   │
            │  + WebSocket    │
            └─────────────────┘
```

## Next Steps: Phase 2

To enable real-time collaboration, we'll implement:
- Operational Transformation (OT) for conflict resolution
- Real-time delta sync between clients
- Cursor position tracking
- User presence indicators

## File Structure

```
.
├── server.js          # Express.js + WebSocket server
├── index.html         # HTML with Quill editor
├── script.js          # Client-side logic
├── package.json       # Node.js dependencies
└── README.md          # This file
```

## Technologies Used

- **Backend**: Node.js, Express.js, WebSocket (ws)
- **Frontend**: Quill Rich Text Editor
- **Storage**: localStorage (Phase 1) → Database (Phase 2)
