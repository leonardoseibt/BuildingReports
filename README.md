# BuildingReports – Local Setup

This repo is an Express + Vite (React) monorepo with Drizzle ORM (Postgres/Neon).
In dev, the Express server runs Vite in middleware mode and serves the React app.

## Prerequisites
- Node.js 20+
- A Postgres database (Neon recommended) – connection string for `DATABASE_URL`

## Configure env
1. Copy `.env.example` to `.env` and fill `DATABASE_URL` and `SESSION_SECRET`.
2. For local dev, only `DATABASE_URL` and `SESSION_SECRET` are required.

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

### Local authentication (no Replit)
- Login automático (GET): `http://localhost:5000/api/login`
- Login via POST: `POST http://localhost:5000/api/login` com body JSON (ex.): `{ "email": "you@example.com", "id": "local-user" }`
- Logout: `GET http://localhost:5000/api/logout`

## Build and run (production-like)
```powershell
npm run build
npm start
```

## Notes
- All API routes are under `/api/*`.
- Replit removido: não é necessário configurar OIDC.
