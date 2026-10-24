
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
    headDirection,
    headAngles,
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
  } = useFaceTracking(
    isSessionActive,
    alertAfterSeconds
  );

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const labels: Record<FocusStatus, string> = {
    focused: "Facing screen (estimated)",
    "looking-away": "Looking away",
    away: "No face detected",
    "camera-off": "Camera off",
  };

  const buttonStyle = {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    color: "white",
    fontWeight: 600 as const,
    cursor: "pointer",
  };

  return (
    <section
      style={{
        background: "#171326",
        color: "white",
        padding: "24px",
        borderRadius: "16px",
        maxWidth: "500px",
      }}
    >
      <h2>👻 Ghost Surveillance</h2>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: "100%",
          maxWidth: "400px",
          borderRadius: "12px",
          background: "black",
          transform: "scaleX(-1)",
        }}
      />

      <div style={{ marginTop: "16px" }}>
        <p>
          <strong>Status:</strong>{" "}
          {cameraOn && !calibrated
            ? "Awaiting calibration"
            : labels[status]}
        </p>

        <p>
          <strong>Head direction:</strong>{" "}
          {headDirection}
        </p>

        <p>
          <strong>Horizontal rotation:</strong>{" "}
          {headAngles.yaw.toFixed(1)}°
        </p>

        <p>
          <strong>Vertical rotation:</strong>{" "}
          {headAngles.pitch.toFixed(1)}°
        </p>

        <p>
          <strong>Looking away:</strong>{" "}
          {awaySeconds}s
        </p>

        <p>
          <strong>Session:</strong>{" "}
          {isSessionActive ? "Active" : "Inactive"}
        </p>
      </div>

      {error && (
        <p style={{ color: "#ff8888" }}>
          {error}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginTop: "16px",
        }}
      >
        {!cameraOn && !loading ? (
          <button
            onClick={startCamera}
            style={{
              ...buttonStyle,
              background: "#7c3aed",
            }}
          >
            Enable Camera
          </button>
        ) : (
          <>
            {cameraOn && (
              <button
                onClick={calibrate}
                style={{
                  ...buttonStyle,
                  background: "#2563eb",
                }}
              >
                Calibrate
              </button>
            )}

            <button
              onClick={stopCamera}
              style={{
                ...buttonStyle,
                background: "#b91c1c",
              }}
            >
              {loading ? "Cancel" : "Stop Camera"}
            </button>
          </>
        )}
      </div>

      {cameraOn && (
        <p
          style={{
            marginTop: "12px",
            fontSize: "14px",
            color: "#cccccc",
          }}
        >
          {calibrated
            ? "Calibration saved. Move your head to test detection."
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
