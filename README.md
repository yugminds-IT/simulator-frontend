# Robo Coders simulator: frontend

Vite + three.js. Students sign in with their YugMinds account and learn the Robo Coders kit in 3D.

## Run locally
```
npm install
npm run dev          # http://localhost:5173, /api → http://localhost:3100 (SIM_API=... to change)
```

## Deploy (Hostinger VPS, Coolify)
- Build pack: **Dockerfile** (this folder). Port **80**.
- Environment variable: `API_URL` = the backend's address, no trailing slash.
  - Backend with its own domain: `https://simapi.yugminds.org`
  - Or the backend container on the same server: `http://<backend-container-name>:3100`
- The site calls `/api/...` on its own domain; nginx forwards it to `API_URL`, so the sign-in cookie works without CORS.
