# BuildingReports – Local Setup

This repo is an Express + Vite (React) monorepo with Drizzle ORM (Postgres/Neon).
In dev, the Express server runs Vite in middleware mode and serves the React app.

## Prerequisites
- Node.js 20+
- A Postgres database (Neon recommended) – connection string for `DATABASE_URL`

## Configure env
1. Copy `.env.example` to `.env` and fill `DATABASE_URL` and `SESSION_SECRET`.
2. For local dev, you can omit `REPL_ID` and `REPLIT_DOMAINS`.
   The server will enable a simple dev auth at `POST /api/dev/login`.

## Install
```powershell
# In repo root
npm install
```

## Create DB schema
```powershell
# Requires DATABASE_URL in .env
npm run db:push
```

## Run (development)
```powershell
npm run dev
```
- Server listens on http://localhost:5000
- Vite runs in middleware; the UI is available at `/`.

### Dev auth (local only)
- Log in: `POST http://localhost:5000/api/dev/login` with JSON body, e.g.
  `{ "email": "you@example.com", "id": "local-user" }`
- Or use a small script or REST client; the session cookie will be stored by your browser if you POST from it.
- Log out: `POST http://localhost:5000/api/dev/logout`

## Build and run (production-like)
```powershell
npm run build
npm start
```

## Notes
- All API routes are under `/api/*`.
- If you configure Replit OIDC for production, set `REPL_ID`, `REPLIT_DOMAINS`, and `ISSUER_URL`.
