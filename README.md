# PomoGhost

## Try the deployed application

The current deployment is available at:

https://ayushibose.github.io/Hacktoberfest/

## How PomoGhost works

PomoGhost is a focused study workspace with a haunted companion called Morrow (or whatever you rename it). Create a task or type a goal, choose a preset or custom session length, and start the timer. You can pause, resume, cancel, or reset a session at any time. Completed sessions award XP, update your total focus time and completed-session count, and appear in your session history. Progress, tasks, and history are saved in your browser when storage is available.

While a session is running, you can:

- Add, edit, complete, delete, filter, and reorder tasks by dragging one onto the timer to make it the current focus.
- Watch Morrow react to your progress. Morrow evolves from Wisp to Haunted to Possessed as you earn XP, and you can pet the companion at any time.
- Enable your webcam for optional on-device face tracking. Calibrate it to monitor whether you are facing the screen; the away timer can trigger a haunted alert when you look away for too long.
- Share a screen for optional AI check-ins. The browser asks you to choose what to share, and Gemma checks the selected screen against your current goal every 30 seconds. You can also run a check manually, stop sharing, and view explanations or suggestions. Screen sharing stops when the session is paused or finished.
- Turn haunted reactions on or off. With reactions enabled, Morrow can become suspicious or angry and can alert you when the webcam or screen analysis detects a distraction.

The webcam and screen-sharing features are optional. Webcam attention is processed on your device, while screen images are sent to the backend for Gemma analysis only when you choose to share a screen. If you cancel the screen-sharing request, the focus timer can still run without AI check-ins.

There is also a demo-mode feature (can toggle in top right) which lets you test different functions of the app, like levelling up Morrow or triggering jumpscares, for demonstration purposes, since a long pomodoro timer doesn't translate well for quick demonstrations.

## Local setup

Requirements:

- Node.js 22 or later
- npm
- A Google AI Studio API key for screen analysis

Clone the repository and install dependencies:

```bash
git clone https://github.com/ayushibose/Hacktoberfest.git
cd Hacktoberfest
npm install
npm install --prefix frontend
npm install --prefix backend
```

Create `backend/.env` with the backend configuration:

```env
GOOGLE_AI_STUDIO_API_KEY=your_api_key
GEMMA_MODEL=gemma-4
PORT=3001
```

Start the frontend and backend together from the repository root:

```bash
npm run dev
```

Open the frontend at:

http://localhost:5173

The backend runs at:

http://localhost:3001

To start only one service:

```bash
npm run dev --prefix frontend
npm run dev --prefix backend
```

## Validation

Run the frontend checks:

```bash
npm run lint --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
```
