# PomoGhost

PomoGhost is a Halloween Pomodoro dashboard with a Three.js companion, task list,
optional on-device webcam attention checks, and opt-in Gemma screen check-ins.

## Run locally

Install the root, frontend, and backend dependencies, then start both development
servers from the repository root:

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
npm run dev
```

The frontend and backend development servers run together. To start only one,
run `npm run dev` from its `frontend` or `backend` directory.
