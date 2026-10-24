
import { useState } from "react";
import FocusMonitor from "./components/FocusMonitor";

export default function App() {
  const [studying, setStudying] = useState(false);

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <h1 className="mb-5 text-3xl font-bold">
        👻 GhostMode - Webcam Test
      </h1>

      <button
        onClick={() => setStudying(!studying)}
        className="mb-5 rounded-lg bg-green-700 px-4 py-2"
      >
        {studying ? "Stop Studying" : "Start Studying"}
      </button>

      <FocusMonitor
        isSessionActive={studying}
        alertAfterSeconds={10}
      />
    </main>
  );
}
