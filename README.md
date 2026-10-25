# PomoGhost - Your Spooky Study Buddy (Halloween Edition)
**PomoGhost** combines Pomodoro timers, AI-powered screen analysis and face analysis, and a tamagotchi-style pet to make studying more productive and fun - halloween themed.

### Try it live : [PomoGhost](https://ayushibose.github.io/PomoGhost/)
<img width="700" height="350" alt="image" src="https://github.com/user-attachments/assets/83ece6f0-a6ad-44ab-a96e-61b0c9fbdb8a" />


## Spooky Features 👻

### Study Timer & Task Management
- Create, edit, complete, delete, and filter tasks.
- Drag tasks onto the timer or enter a study goal manually.
- Choose preset or custom session lengths, with pause, resume, and reset controls.
- Track completed sessions, total study time, and XP earned.

### Virtual Ghost Companion
- Meet **Morrow**, your ghost companion who grows as you study.
- Earn XP to evolve Morrow through **Wisp → Haunted → Possessed**.
- Pet Morrow and watch its mood change based on your study activity.

### Webcam Focus Detection
- Optional on-device head tracking using **MediaPipe**.
- Calibrate your webcam to detect when you're facing away from the screen.
- Looking away for too long can trigger spooky jumpscares and notifications.

### AI Screen Analysis
- Optionally share a screen, window, or tab for analysis by **Gemma**.
- Every 30 seconds, AI checks whether the visible content appears relevant to your study goal.
- Receive feedback and suggestions, or manually select **Check Now**.
- Screen sharing stops automatically when your session ends or pauses.

### Progress & Personalisation
- View study history, completed sessions, total focus time, and ghost evolution.
- Progress and tasks are saved locally in your browser.
- Enable or disable haunted reactions and optional monitoring features.

### Demo Mode
Toggle **Demo Mode** in the top-right corner to instantly test ghost evolution, XP rewards, moods, and jumpscares without waiting for a full Pomodoro session.

**Stay focused, grow your ghost, or prepare to be haunted! 👻**

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
