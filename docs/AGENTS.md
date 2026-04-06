# Repository Guidelines

## Project Structure & Module Organization

`src/` contains the Express backend: `controllers/`, `middleware/`, `models/`, `routes/`, `sockets/`, and shared `utils/`. Browser code lives under `public/`, with `public/js/core`, `public/js/editor`, `public/js/managers`, and `public/js/ui` holding the client-side application logic. Static assets and entry pages are in `public/css`, `public/pages`, `public/index.html`, and `public/sw.js`. Tests are organized under `tests/unit`, `tests/integration`, `tests/e2e`, and `tests/frontend`.

## Build, Test, and Development Commands

- `npm start`: run the server with production-style settings.
- `npm run dev`: start locally with `DISABLE_SECURE_COOKIE=true` for development.
- `npm test`: run the full Jest suite (`unit` + `integration`).
- `npm run test:unit`: run unit tests only.
- `npm run test:integration`: run integration tests only.
- `npm run test:e2e`: run Playwright browser tests.
- `npm run lint`: run ESLint using `config/.eslintrc.json`.
- `npm run format`: format the repository with Prettier.

## Coding Style & Naming Conventions

Use ES modules, 2-space indentation, semicolons, single quotes, and trailing commas where valid. Keep lines at 100 characters or less. Follow the existing lowercase file naming pattern with descriptive suffixes, such as `authController.js`, `documentSocket.js`, and `pageManager.js`. Prefer small, focused modules in the existing folder boundaries rather than adding broad utility files.

## Testing Guidelines

Jest is the main test runner. Name tests with the `*.test.js` suffix and group them by layer, for example `tests/unit/controllers/authController.test.js` or `tests/integration/security.test.js`. `tests/setup.js` and `tests/env.js` provide shared test setup, so avoid duplicating environment bootstrapping in individual tests. Run the narrowest suite that covers your change before running `npm test`.

## Commit & Pull Request Guidelines

Recent commits use short, imperative messages with optional scopes, such as `fix(mobile-login): ...`, `feat: ...`, or `refactor: ...`. Keep commits similarly concise and specific. PRs should explain what changed, why it changed, and how it was verified. Include screenshots or screen recordings for UI changes and link related issues when available.

## Security & Configuration Tips

Do not commit `.env` files or secrets. Use `.env.example` and `.env.docker.example` as the starting point for local or containerized setups, and review `SECURITY_CHECKLIST.md` before making authentication, session, or token changes.
