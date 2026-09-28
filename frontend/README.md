# Meeting Pre-Agent Frontend

This frontend connects to your existing FastAPI backend. It uses Vite + React + TypeScript and Tailwind CSS.

Prerequisites:
- Node.js 18+ and npm
- Backend running at the URL configured in `.env` (`VITE_API_BASE_URL`)

Install:

```bash
cd frontend
npm install
```

Run (development):

```bash
npm run dev
```

Build:

```bash
npm run build
```

Environment:
- Set `VITE_API_BASE_URL` at production build time to the public FastAPI base URL, with no trailing slash (for example, `https://api.example.com`). It is required for a production build deployment; provide it in the build environment.
- `.env.development` contains the local API URL for Vite development only; it is not loaded by the production build.
- `VITE_API_BASE_URL` is a public URL, not a secret. Never put LLM or Hindsight credentials in frontend environment variables.

Notes:
- The frontend uses the backend's real endpoints (e.g., `/api/chat`, `/api/health`, `/api/memory/retain`, `/api/memory/recall`).
- Configure the backend's `FRONTEND_URL` to the deployed frontend origin. The backend does not use wildcard CORS.
