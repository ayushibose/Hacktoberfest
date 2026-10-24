# GhostMode dashboard

Implemented on `dashboard` in the existing `frontend` Vite/React application.

## Run and verify

From `frontend`:

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Tests use Node's built-in test runner and TypeScript stripping (Node 22.6+). No extra test framework is installed. The existing Vite version has its own Node engine requirements. If npm omits the Windows native Vite dependency, run `npm install --include=optional --os=win32 --cpu=x64` on Windows.

Open `/?demo=1` for mood and evolution previews and a temporary celebration. These controls change only in-memory presentation. The actual timer still uses real durations and awards real XP only at expiry. Ordinary mode hides the controls.

## Foundation and file ownership

Retained the existing React version, Vite configuration, TypeScript/ESLint configuration, StrictMode entry point, existing shared `StudySession`, `Ghost` and `FocusStatus` types, and the backend. There were no existing functional UI components to reuse. Replaced only the Vite demonstration in `App.tsx` and its sample styles. Kept its assets in place. Existing CSS is used without adding a Tailwind migration.

Added:

- `src/components/Dashboard.tsx`: layout, monitoring slots, real statistics, history, demo presentation, integration callbacks.
- `src/components/StudyTimer.tsx`: presets, custom duration validation, goal, task drop target, countdown and accessible session controls.
- `src/components/TaskList.tsx`: persistent task CRUD, filters and shared focus selection.
- `src/components/HalloweenDecor.tsx`: non-interactive SVG webs and reduced-motion-aware spider.
- `src/components/GhostPet.tsx`: lazy-loaded React Three Fiber canvas, reduced motion, visibility handling and WebGL fallback.
- `src/components/ghost/GhostModel.tsx`: original procedural geometry, reusable evolution stages, mood and pointer/petting animations.
- `src/hooks/useStudySession.ts`: one shared session store, browser storage and cross-tab coordination.
- `src/lib/studySession.ts`: pure validated persistence and session transitions.
- `src/lib/ghostProgression.ts`: evolution thresholds and monitoring-to-mood mapping.
- `tests/studySession.test.mjs`: focused regression tests.
- `public/ghost.svg`: original companion favicon, retaining the starter assets.

Also modified `src/types/index.ts` additively, page metadata in `index.html`, and npm manifests. Added `three`, `@react-three/fiber` v9 (compatible with the existing React 19), and `@types/three`. No external artwork, copied third-party source, API key, webcam or screenshot data is involved.

## Person 1 and Person 3 integration

`Dashboard` works with no props. Monitoring results default to `unknown` and `not_checked`; these are displayed honestly. The other developers' monitoring components do not exist on this branch and are not imported speculatively.

```tsx
<Dashboard
  attentionStatus={attentionStatus} // facing | away | unknown
  attentionConnected={cameraConnected} // optional: distinguish disconnected from unknown
  screenStatus={screenStatus}       // relevant | unrelated | uncertain | not_checked | checking
  focusMonitor={focusControls}      // optional ReactNode owned by Person 1
  screenMonitor={screenControls}    // optional ReactNode owned by Person 3
  onGoalChange={setStudyGoal}
  onSessionStatusChange={setSessionStatus}
  onMoodChange={setGhostMood}
  onHorrorChange={setHorrorEnabled}
/>
```

Use stable callbacks when connecting integrations. Callbacks deliver current state, including the initial value; they are not exactly-once event notifications. In particular, do not trigger a jumpscare merely because `onMoodChange` fires. Person 1 retains jumpscare ownership, consent and trigger logic. Horror is off by default and persisted; Person 1 should honor that flag. Nothing automatically opens a camera, captures a screen or calls an API.

The existing `FocusStatus` contract remains intact: an adapter can map `focused` to `facing`, `looking-away`/`away` to `away`, and `camera-off` to `unknown`.

`GhostPet` independently accepts `mood`, `stage`, an optional increasing `reaction` number for petting, and `horrorEnabled`. Evolution is independent of mood. The dashboard's monitoring mapper never claims a positive result when its inputs are unavailable.

## Persistence and timer semantics

`ghostmode:v1` stores the selected duration/mode, tasks, selected task ID, goal, horror preference, completed-session history, active/paused session and last completion ID in one JSON record. Additive defaults preserve legacy v1 history, XP and active sessions. Custom durations accept whole minutes from 5 through 180; controls cannot change an active schedule. XP (2 per scheduled minute), session count, total minutes and evolution are derived from the validated history rather than redundant counters that could disagree. All history is retained; the dashboard shows the latest five entries.

Running sessions use an absolute expiry timestamp. Paused sessions store remaining milliseconds and acquire a new expiry on resume. Reloading after the deadline completes the session once, using its original expiry as completion time. Cancelling before the deadline never awards XP. An already-expired session completes before any subsequent action is applied. Editing a goal updates both the current goal and active session's task.

Web Locks serialize storage transactions across tabs; storage events synchronize views. A unique session ID is saved atomically with its completion. Missing/corrupt/outdated records recover to safe defaults; duplicate history IDs and inconsistent active records are discarded. If storage fails, the session continues in memory with a visible persistence warning.

Focus buttons and native task drops dispatch the same task-focus action and update the authoritative goal delivered by onGoalChange. Editing a selected task updates that goal and the active session; typing a manual goal detaches the task selection. Deleting a selected task keeps the goal as a manual snapshot. Task changes never rewrite completed history or award XP.

The Halloween update retains the procedural ghost, with porcelain texture, cracks, vintage ribbon, expressive eyes and distinct mood lighting. SVG webs, spider motion and reward/evolution effects honor reduced motion. No new dependency was needed for this update.

## Validation and limitations

- `npm test`: 19 tests covering preset/custom rewards, validation, pause/resume/reload, delayed/repeated completion, cancellation, legacy migration, task lifecycle and goal synchronization, corrupt data, duplicate IDs, evolution and mood mapping.
- `npm run lint` and `npm run build` pass, including TypeScript compilation.
- Browser checks cover WebGL rendering, custom input, task creation/edit/focus/complete/delete, goal callbacks, persisted pause/task state, cancellation, monitoring inputs, reduced motion and desktop/mobile layouts. An isolated temporary QA page used separate sessionStorage and an accelerated clock: completing 7 minutes added exactly 14 XP, evolved 90 XP to 104 XP, and reload retained two history entries with no duplicate reward. The QA page was removed afterward. Native dragstart/dragover/drop handlers were exercised with DragEvents and selected the task correctly; the automation gesture itself did not deliver a final drop, so a physical mouse drag remains a manual verification item.
- Three.js is lazy-loaded so the dashboard/timer can render first. Its production chunk is approximately 920 KB (244 KB gzip); Vite reports a non-blocking chunk-size warning. React Three Fiber currently emits a non-blocking Three.js Clock deprecation warning.
- Cross-tab serialization relies on Web Locks in modern secure-context browsers (including localhost). Older browsers without Web Locks have best-effort storage synchronization, not a transactional multi-tab guarantee.
- This is local, device/browser-specific progress, not server-backed account data. Wall-clock changes and deliberate localStorage edits are not an anti-cheat boundary. Very long histories may eventually exhaust browser storage, at which point the visible storage warning applies.
- Webcam detection, Gemma analysis and fullscreen jumpscares remain Person 1/Person 3 work.

