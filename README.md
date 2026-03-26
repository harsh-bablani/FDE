# FDE Project

This repository includes the required top-level structure:

- `/src`
- `/README.md`
- `/sessions`

## Project Structure

- `order-to-cash-frontend/` - React + Vite frontend (deployed on Vercel)
- `order-to-cash-graph-api/` - Node.js + Express backend (deployed on Render)
- `src/` - repository-level source placeholder directory
- `sessions/` - repository-level sessions directory for run logs or notes

## Setup Instructions

### 1) Clone and install dependencies

```bash
git clone <your-repo-url>
cd FDE
cd order-to-cash-frontend && npm install
cd ../order-to-cash-graph-api && npm install
```

### 2) Backend environment variables (Render or local `.env`)

Set the following:

- `GEMINI_API_KEY=<your_gemini_api_key>`
- `GEMINI_MODEL=gemini-2.0-flash` (optional, recommended)
- `PORT=3001` (local only, optional)

### 3) Run locally

Backend:

```bash
cd order-to-cash-graph-api
npm run dev
```

Frontend:

```bash
cd order-to-cash-frontend
npm run dev
```

Optional frontend env (`order-to-cash-frontend/.env`):

```bash
VITE_API_URL=http://localhost:3001
```

### 4) Verify APIs

- Backend health: `GET /health`
- Gemini test: `GET /api/query/test-gemini`
- Chat endpoint: `POST /api/query`

## Deployment Notes

- Backend on Render must have `GEMINI_API_KEY` configured.
- Frontend on Vercel should point `VITE_API_URL` to the Render backend URL.

