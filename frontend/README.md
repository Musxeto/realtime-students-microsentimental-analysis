# Frontend Dashboard

React dashboard for the Real-Time Students Micro-Sentimental Analysis system.

## Stack

- React 18
- TypeScript
- Vite
- Redux Toolkit + RTK Query
- React Router v6
- Tailwind CSS
- Tremor charts
- react-use-websocket
- react-icons and lucide-react

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Setup

```bash
npm install
```

Create env values in a .env file if needed:

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

Start dev server:

```bash
npm run dev
```

## Architecture

```text
src/
  app/                  # Redux store, providers, routing
  components/           # Shared layout and reusable components
  config/               # Environment and app constants
  features/
    auth/               # Login, token handling, route guards
    admin/              # Admin pages and workflows
    teacher/            # Teacher pages and workflows
    live-session/       # Live monitoring and charts
  hooks/                # Custom hooks (websocket and shared logic)
  services/             # RTK Query API slices
  types/                # Shared TypeScript models
```

## Current Routes

- /login
- /admin
- /dashboard
- /session/start
- /session/:id

Route protection is role-based in src/features/auth/ProtectedRoute.tsx.

## Real-Time Flow

- Session is created via backend REST endpoint.
- Frontend opens WebSocket connection to /sessions/ws/stream/{session_id}.
- Incoming payload updates engagement visualizations and live indicators.

## Build Notes

- Production build currently succeeds.
- Tremor charts increase bundle size; route-level code splitting can be added if needed.
