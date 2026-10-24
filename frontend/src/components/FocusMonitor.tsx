
import { useEffect } from "react";
import { useFaceTracking } from "../hooks/useFaceTracking";
import type { FocusStatus } from "../types";
import JumpScare from "./JumpScare";

interface FocusMonitorProps {
  isSessionActive: boolean;
  alertAfterSeconds?: number;
  onStatusChange?: (status: FocusStatus) => void;
}

export default function FocusMonitor({
  isSessionActive,
  alertAfterSeconds = 120,
  onStatusChange,
}: FocusMonitorProps) {
  const {
    videoRef,
    status,
    awaySeconds,
    cameraOn,
    loading,
    error,
    jumpscare,
    calibrated,
    startCamera,
    stopCamera,
    calibrate,
    dismissJumpscare,
  } = useFaceTracking(isSessionActive, alertAfterSeconds);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const labels: Record<FocusStatus, string> = {
    focused: "Facing screen (estimated)",
    "looking-away": "Head turned away",
    away: "No face detected",
    "camera-off": "Camera disabled",
  };

  return (
    <section className="rounded-2xl bg-slate-900 p-5 text-white">
      <h2 className="mb-3 text-xl font-bold">
        👁 Ghost Surveillance
      </h2>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full max-w-sm scale-x-[-1] rounded-xl bg-black"
      />

      <p className="mt-3">
        Status: <strong>{labels[status]}</strong>
      </p>

      <p>Looking away: {awaySeconds}s</p>

      <p className="text-sm text-gray-400">
        Session: {isSessionActive ? "Active" : "Inactive"}
      </p>

      {error && (
        <p className="mt-2 text-red-400">{error}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!cameraOn ? (
          <button
            disabled={loading}
            onClick={startCamera}
            className="rounded-lg bg-purple-600 px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Loading camera..." : "Enable Camera"}
          </button>
        ) : (
          <>
            <button
              onClick={calibrate}
              className="rounded-lg bg-blue-600 px-4 py-2"
            >
              Calibrate
            </button>

            <button
              onClick={stopCamera}
              className="rounded-lg bg-red-700 px-4 py-2"
            >
              Stop Camera
            </button>
          </>
        )}
      </div>

      {cameraOn && (
        <p className="mt-3 text-sm text-gray-300">
          {calibrated
            ? "Calibration saved for this session."
            : "Face your screen normally, then click Calibrate."}
        </p>
      )}

      <JumpScare
        isOpen={jumpscare}
        onClose={dismissJumpscare}
      />
    </section>
  );
}
