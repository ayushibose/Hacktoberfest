# PomoGhost dashboard and monitoring

## Run locally

From the repository root:

```sh
npm ci
npm ci --prefix frontend --include=dev
npm ci --prefix backend --include=dev
npm run dev
```

Frontend: http://localhost:5173 (or Vite's next free port). Backend: http://localhost:3001. Configure `GOOGLE_AI_STUDIO_API_KEY` (or `GEMMA_API_KEY`) in the existing backend environment for Gemma requests. Nothing in this integration changes the backend API or model settings.

If npm skips Vite's Windows optional binding, stop Vite and run `npm install --include=optional --os=win32 --cpu=x64` from `frontend`.

From `frontend`, run `npm run lint`, `npm test`, and `npm run build`. Tests use Node's built-in runner with TypeScript stripping (Node 22.6+; also honor Vite's Node requirements).

## Integrated monitoring

`App` renders `Dashboard`, which connects both teammates' features by default:

- Person 1: `FocusMonitor` calls the existing `useFaceTracking`. Camera enable/stop, calibration, head-pose thresholds, frame smoothing, and 250ms detection interval are unchanged. Continuous looking away for 30 seconds during a session displays a styled, keyboard-accessible overlay and honors the saved Haunted reactions setting. Unknown or uncalibrated tracking never claims the user is facing the screen. Camera processing stays local. Pausing or ending a session resets the distraction counter.
- Person 3: the dashboard calls `useScreenCapture` directly. The standalone testing `ScreenMonitor.tsx` has been removed. Starting or resuming a focus session invokes `getDisplayMedia` synchronously from the button click, before any asynchronous storage work, so the browser can show its screen chooser. The timer continues even if sharing is cancelled; Share screen retries during an active session. Requests use the same `/api/analyse-screen` endpoint, current authoritative goal, JPEG limits (1280x720, quality 0.6), and 30-second cadence, plus an initial check. Check now triggers a manual check.
- The user chooses the shared screen/window/tab in the browser. Screenshots are sent through the existing backend to Gemma and are not saved by this UI. Blank goals do not trigger API calls. There is no automatic camera permission request.
- Pausing, cancelling, completing, unmounting, or using Stop sharing releases screen tracks, clears capture timers, aborts in-flight frontend requests, and clears feedback. A permission chooser resolved after the session ends cannot leave a live capture behind. Changing the goal aborts the old analysis and ignores stale results. Requests time out after 90 seconds without overlapping one another.
- A page refresh cannot restore browser media permissions or streams automatically. The timer restores independently; click Share screen for an already-running restored session. Resume requests sharing again after a pause.
- Relevant, unrelated, uncertain, checking, disconnected, permission-denied, and API-error states are displayed in the dashboard. Unrelated responses use a red alert card with the provider's explanation and suggestions, feed the ghost mood, and immediately open the same styled distraction overlay used for camera warnings when Haunted reactions are enabled.

Existing `Dashboard` props remain available for embedding: attentionStatus, attentionConnected, screenStatus, focusMonitor, screenMonitor, onGoalChange, onSessionStatusChange, onMoodChange, onHorrorChange. Custom monitor nodes and supplied status values override their default presentation. Use stable callbacks. Callbacks report state, not exactly-once events.

## Timer and persistence

Presets remain 15, 25, and 45 minutes. Custom has separate integer Minutes and Seconds fields from **00:00 through 180:00** (seconds 0–59). Invalid or incomplete values disable Start. Active duration controls are locked.

Duration is still stored in minutes in the same `ghostmode:v1` record, now allowing whole-second fractions. Arithmetic rounds scheduled time to whole milliseconds to preserve exact expiry and reload validation. Existing whole-minute history, XP, tasks, goals, and active sessions require no migration or reset. XP remains two per scheduled minute, prorated for seconds; the UI formats XP to two decimal places while preserving the full saved calculation. A zero-second session completes immediately, records zero time and zero XP, and closes any late screen stream. Duplicate completion IDs cannot earn rewards again.

Running timers use absolute expiry timestamps; paused timers preserve remaining milliseconds. History remains the source of truth for XP, time, and session count. Task focus buttons, native drops, edits, and manual goals all update the same authoritative goal used for analysis. Task changes never rewrite completed history or grant XP. Web Locks serialize cross-tab storage writes where available; older browsers use best-effort synchronization. Storage failures display a warning and continue in memory.

## Companion and interface

The procedural Three.js ghost retains evolution stages Wisp (0 XP), Haunted (100 XP), and Possessed (300 XP), independently of temporary mood. Halloween SVG decorations and animations respect reduced motion. Open `/?demo=1` to preview moods and stages; timer/history/XP remain real.

## Validation

- 27 deterministic tests cover preset and second-level rewards, zero-second completion, invalid durations, pause/resume/reload, cancellation, duplicate completion, legacy saves, task lifecycle and authoritative goal, progression, and mood mapping.
- TypeScript build and ESLint pass. The existing lazy Three.js chunk still produces Vite's non-blocking size warning.
- An isolated browser fixture used synthetic canvas screen streams, mocked API responses, and separate sessionStorage. Verified direct click activation for automatic sharing, current goal in requests, styled unrelated feedback, stale-response rejection after goal changes, track release on pause/cancel/expiry, denied permissions, late permission resolution after cancellation, webcam error presentation, one-second completion/reload, and zero-second completion. The temporary fixture is removed from the final source.
- Live webcam hardware/calibration and real provider responses require the user's camera permission, chosen shared surface, and configured backend credentials. Automated integration checks do not claim to validate hardware detection or model accuracy.


### Camera preview and tracking diagnostics

The camera has an off-state placeholder containing Enable camera. The live video uses `object-fit: contain` in its frame so wide or tall camera feeds remain fully visible. The direction comes from live calibrated head pose, while away seconds count only during an active focus session. Idle/paused sessions say the away timer is paused instead of displaying a misleading fixed zero. Tracking details expose the processed-frame count and angles.

Stopped camera frames now produce an Unknown attention reading and suspend/reset the continuous-away timer after three seconds, rather than retaining an old Facing screen result. Detection exceptions stop the camera and show a retryable error; a browser-ended camera track restores the placeholder. The original thresholds and frame smoothing remain unchanged. An isolated synthetic-camera check verified direction changes, the active away counter, the 30-second overlay, stalled-feed detection/recovery, and detector-error recovery.
