# GhostMode Backend API

The backend runs on port `3001` by default.

Start it locally with:

```bash
cd backend
npm run dev
```

The base URL is:

```text
http://localhost:3001
```

Set a different port with the `PORT` environment variable.

## Environment variables

Create `backend/.env` for Google AI Studio analysis:

```env
GOOGLE_AI_STUDIO_API_KEY=your_google_ai_studio_api_key
GEMMA_MODEL=gemma-4
PORT=3001
```

The backend uses Google AI Studio's OpenAI-compatible endpoint by default:

```text
https://generativelanguage.googleapis.com/v1beta/openai/
```

The API key is only used by the backend and must not be exposed in the frontend. `GEMMA_MODEL` should be the exact multimodal Gemma model ID enabled for your Google AI Studio project. The default is `gemma-4`.

For a compatible proxy or alternate deployment, override the endpoint with:

```env
GEMMA_BASE_URL=https://your-openai-compatible-endpoint/v1/
```

`GEMMA_API_KEY` remains supported as a backwards-compatible alias, but `GOOGLE_AI_STUDIO_API_KEY` is preferred for this project.

## `GET /health`

Use this endpoint to check that the backend is running.

### Request

```bash
curl http://localhost:3001/health
```

### Successful response

Status: `200 OK`

```json
{
  "status": "ok"
}
```

## `POST /api/analyse-screen`

Analyses a transient screenshot against a user's study goal. The endpoint assesses whether the visible content appears related to the goal; it does not determine whether the user is genuinely productive.

Screenshots are sent as base64-encoded image data URLs and are not stored by this backend.

### Request headers

```http
Content-Type: application/json
```

### Request body

```json
{
  "goal": "Complete my Python assignment",
  "imageDataUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
}
```

#### Fields

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `goal` | string | Yes | 1–500 characters |
| `imageDataUrl` | string | Yes | Base64 data URL for `png`, `jpeg`, `jpg`, or `webp`; maximum 10,000,000 characters |

The browser can create a suitable image data URL from a captured video frame with:

```ts
const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
```

The current frontend bounds captured frames to 1280x720 and uses JPEG quality
`0.6` to reduce upload and multimodal inference time. Screen analysis only
needs enough detail to identify the type of content on screen, not a
pixel-perfect screenshot.

### Example request

```bash
curl -X POST http://localhost:3001/api/analyse-screen \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Complete my Python assignment",
    "imageDataUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
  }'
```

### Successful response

Status: `200 OK`

```json
{
  "relevance": "relevant",
  "explanation": "The screen shows a Python code editor and assignment-related documentation.",
  "suggestions": [
    "Continue implementing the assignment."
  ]
}
```

`relevance` is one of:

- `relevant` — the visible content appears related to the stated goal.
- `unrelated` — the visible content appears unrelated to the stated goal.
- `uncertain` — there is not enough evidence to make a reliable classification.

The `suggestions` array contains zero to three short strings.

### Error responses

#### `400 Bad Request`

The request body is missing, malformed, or fails validation.

```json
{
  "error": "Provide a study goal (1-500 characters) and a valid base64 image data URL."
}
```

#### `502 Bad Gateway`

The Gemma provider is unavailable, incorrectly configured, or returned an invalid response.

```json
{
  "error": "Screen analysis is temporarily unavailable.",
  "detail": "Provider error details are included during local development only."
}
```

The backend logs the provider-side error server-side. During local development, a non-secret provider diagnostic is also returned in `detail` to make invalid keys, model IDs, unsupported image input, and unsupported response formats easier to diagnose. Production responses omit this field.

## Frontend integration

The reusable frontend surfaces are:

- `frontend/src/components/ScreenMonitor.tsx` — optional controls and analysis result display.
- `frontend/src/hooks/useScreenCapture.ts` — capture lifecycle and API integration for custom dashboard UI.

`ScreenMonitor` does not own the application shell, dashboard, ghost canvas, goal persistence, or browser alerts. Pass the dashboard's current goal in as a prop and use callbacks to connect analysis results to the ghost:

```tsx
import { ScreenMonitor } from './components/ScreenMonitor'
import type { ScreenAnalysis } from './hooks/useScreenCapture'

function DashboardScreenAnalysis({ goal }: { goal: string }) {
  const handleUnrelated = (analysis: ScreenAnalysis) => {
    // Trigger the dashboard/ghost reaction here.
    console.log('Ghost feedback:', analysis.explanation)
  }

  return (
    <ScreenMonitor
      goal={goal}
      onAnalysis={(analysis) => console.log('Latest analysis:', analysis)}
      onUnrelated={handleUnrelated}
      showGoalInput={false}
      intervalMs={30_000}
    />
  )
}
```

Available `ScreenMonitor` props:

| Prop | Purpose |
|---|---|
| `goal` | Current study goal owned by the dashboard |
| `onGoalChange` | Optional callback for the built-in goal input |
| `onAnalysis` | Called after a valid analysis result |
| `onUnrelated` | Called when a valid result is classified as `unrelated` |
| `onError` | Called when capture or API analysis fails |
| `intervalMs` | Capture cadence; the demo default is 30 seconds |
| `apiUrl` | Optional backend base URL override |
| `showGoalInput` | Hide the input when the dashboard already owns goal editing |

The frontend uses `VITE_API_URL` when provided and otherwise defaults to `http://localhost:3001`:

```env
VITE_API_URL=http://localhost:3001
```

Example client call:

```ts
const response = await fetch(`${apiUrl}/api/analyse-screen`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ goal, imageDataUrl }),
})

if (!response.ok) {
  throw new Error((await response.json()).error ?? 'Analysis failed')
}

const result = await response.json()
```

The current testing build invokes this endpoint manually with **Analyze now** and automatically every 30 seconds while screen sharing is active. Pass `intervalMs={15 * 60 * 1000}` for the intended production cadence.
