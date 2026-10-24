# Hacktoberfest

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