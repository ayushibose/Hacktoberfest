
import { useCallback, useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { FocusStatus } from "../types";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";

// Adjust these if detection is too sensitive or insensitive.
const YAW_THRESHOLD = 17;
const PITCH_THRESHOLD = 17;

type HeadPose = {
  yaw: number;
  pitch: number;
};

// Extract head orientation from MediaPipe's
// column-major 4x4 transformation matrix.
function getHeadPose(data: number[]): HeadPose | null {
  if (data.length !== 16) return null;

  // Third column represents the head's forward axis.
  const x = data[8];
  const y = data[9];
  const z = data[10];

  if (![x, y, z].every(Number.isFinite)) return null;
  if (Math.hypot(x, y, z) < 0.001) return null;

  const radiansToDegrees = 180 / Math.PI;

  return {
    yaw: Math.atan2(x, z) * radiansToDegrees,
    pitch:
      Math.atan2(-y, Math.hypot(x, z)) * radiansToDegrees,
  };
}

export function useFaceTracking(
  isSessionActive: boolean,
  alertAfterSeconds = 120
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<FaceLandmarker | null>(null);

  const intervalRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  const runIdRef = useRef(0);
  const loadingRef = useRef(false);
  const sessionRef = useRef(isSessionActive);
  const thresholdRef = useRef(alertAfterSeconds);

  const baselineRef = useRef<HeadPose | null>(null);
  const currentPoseRef = useRef<HeadPose | null>(null);

  const awaySinceRef = useRef<number | null>(null);
  const alertedRef = useRef(false);

  const badFramesRef = useRef(0);
  const goodFramesRef = useRef(0);

  const [status, setStatus] =
    useState<FocusStatus>("camera-off");

  const [headDirection, setHeadDirection] =
    useState("Not calibrated");

  const [headAngles, setHeadAngles] = useState({
    yaw: 0,
    pitch: 0,
  });

  const [awaySeconds, setAwaySeconds] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jumpscare, setJumpscare] = useState(false);
  const [calibrated, setCalibrated] = useState(false);

  useEffect(() => {
    sessionRef.current = isSessionActive;

    if (!isSessionActive) {
      awaySinceRef.current = null;
      alertedRef.current = false;
      setAwaySeconds(0);
      setJumpscare(false);
    }
  }, [isSessionActive]);

  useEffect(() => {
    thresholdRef.current = alertAfterSeconds;
  }, [alertAfterSeconds]);

  const cleanup = useCallback(() => {
    runIdRef.current++;
    loadingRef.current = false;

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    streamRef.current
      ?.getTracks()
      .forEach(track => track.stop());

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    modelRef.current?.close();
    modelRef.current = null;

    baselineRef.current = null;
    currentPoseRef.current = null;
    awaySinceRef.current = null;

    alertedRef.current = false;
    badFramesRef.current = 0;
    goodFramesRef.current = 0;
  }, []);

  const stopCamera = useCallback(() => {
    cleanup();

    setCameraOn(false);
    setLoading(false);
    setCalibrated(false);
    setStatus("camera-off");
    setHeadDirection("Not calibrated");
    setHeadAngles({ yaw: 0, pitch: 0 });
    setAwaySeconds(0);
    setJumpscare(false);
    setError("");
  }, [cleanup]);

  const startCamera = useCallback(async () => {
    if (
      loadingRef.current ||
      streamRef.current ||
      modelRef.current
    ) {
      return;
    }

    const runId = ++runIdRef.current;

    loadingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

      if (runId !== runIdRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        throw new Error("Video element unavailable");
      }

      video.srcObject = stream;
      await video.play();

      const vision =
        await FilesetResolver.forVisionTasks(WASM_URL);

      const model =
        await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
        });

      if (runId !== runIdRef.current) {
        model.close();
        return;
      }

      modelRef.current = model;
      setCameraOn(true);

      let lastVideoTime = -1;

      intervalRef.current = setInterval(() => {
        if (!modelRef.current || video.readyState < 2) {
          return;
        }

        if (video.currentTime === lastVideoTime) {
          return;
        }

        lastVideoTime = video.currentTime;

        const result = modelRef.current.detectForVideo(
          video,
          performance.now()
        );

        const face = result.faceLandmarks[0];
        const matrix =
          result.facialTransformationMatrixes[0];

        const pose = matrix
          ? getHeadPose(matrix.data)
          : null;

        currentPoseRef.current = pose;

        const baseline = baselineRef.current;

        // Do not monitor until calibration.
        if (!baseline) {
          setHeadDirection(
            pose ? "Ready to calibrate" : "No face detected"
          );
          return;
        }

        // Face detected but transformation unavailable:
        // do not count uncertain frames as distraction.
        if (face && !pose) {
          setHeadDirection("Head position unavailable");
          awaySinceRef.current = null;
          badFramesRef.current = 0;
          goodFramesRef.current = 0;
          setAwaySeconds(0);
          return;
        }

        let facingScreen = false;

        if (pose) {
          const yawDifference =
            pose.yaw - baseline.yaw;

          const pitchDifference =
            pose.pitch - baseline.pitch;

          const yaw = Math.abs(yawDifference);
          const pitch = Math.abs(pitchDifference);

          setHeadAngles({ yaw, pitch });

          const turnedSideways =
            yaw > YAW_THRESHOLD;

          const tiltedVertically =
            pitch > PITCH_THRESHOLD;

          facingScreen =
            !turnedSideways && !tiltedVertically;

          if (turnedSideways && tiltedVertically) {
            setHeadDirection(
              "Head turned diagonally"
            );
          } else if (turnedSideways) {
            setHeadDirection(
              "Head turned left/right"
            );
          } else if (tiltedVertically) {
            setHeadDirection(
              "Head tilted up/down"
            );
          } else {
            setHeadDirection(
              "Facing screen"
            );
          }
        } else {
          setHeadDirection("No face detected");
          setHeadAngles({ yaw: 0, pitch: 0 });
        }

        // Ignore brief tracking fluctuations.
        if (facingScreen) {
          goodFramesRef.current++;
          badFramesRef.current = 0;

          if (goodFramesRef.current >= 3) {
            setStatus("focused");

            awaySinceRef.current = null;
            alertedRef.current = false;

            setAwaySeconds(0);
          }
        } else {
          badFramesRef.current++;
          goodFramesRef.current = 0;

          if (badFramesRef.current < 4) {
            return;
          }

          setStatus(
            face ? "looking-away" : "away"
          );

          // Count distraction only during study sessions.
          if (sessionRef.current) {
            const now = Date.now();

            if (awaySinceRef.current === null) {
              awaySinceRef.current = now;
            }

            const seconds = Math.floor(
              (now - awaySinceRef.current) / 1000
            );

            setAwaySeconds(seconds);

            if (
              seconds >= thresholdRef.current &&
              !alertedRef.current
            ) {
              alertedRef.current = true;
              setJumpscare(true);
            }
          }
        }
      }, 250);
    } catch (err) {
      if (runId !== runIdRef.current) {
        return;
      }

      cleanup();
      setCameraOn(false);
      setLoading(false);

      setError(
        err instanceof Error
          ? err.message
          : "Could not start webcam"
      );
    } finally {
      if (runId === runIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [cleanup]);

  const calibrate = useCallback(() => {
    const pose = currentPoseRef.current;

    if (!pose) {
      setError(
        "Face the camera before calibrating."
      );
      return;
    }

    baselineRef.current = { ...pose };

    awaySinceRef.current = null;
    alertedRef.current = false;

    badFramesRef.current = 0;
    goodFramesRef.current = 0;

    setCalibrated(true);
    setStatus("focused");
    setHeadDirection("Facing screen");
    setHeadAngles({ yaw: 0, pitch: 0 });
    setAwaySeconds(0);
    setJumpscare(false);
    setError("");
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
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
    dismissJumpscare: () =>
      setJumpscare(false),
  };
}
