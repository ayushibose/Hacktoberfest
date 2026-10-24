
import { useCallback, useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { FocusStatus } from "../types";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";


  export function useFaceTracking(
  isSessionActive: boolean,
  alertAfterSeconds = 120
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<FaceLandmarker | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runIdRef = useRef(0);
  const sessionRef = useRef(isSessionActive);
  const awaySinceRef = useRef<number | null>(null);
  const alertedRef = useRef(false);
  const baselineRef = useRef(0);
  const offsetRef = useRef<number | null>(null);
  const badFramesRef = useRef(0);
  const goodFramesRef = useRef(0);

  const [status, setStatus] = useState<FocusStatus>("camera-off");
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

  const stopCamera = useCallback(() => {
    runIdRef.current++;

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    modelRef.current?.close();
    modelRef.current = null;

    awaySinceRef.current = null;
    alertedRef.current = false;
    offsetRef.current = null;
    badFramesRef.current = 0;
    goodFramesRef.current = 0;

    setStatus("camera-off");
    setAwaySeconds(0);
    setCameraOn(false);
    setLoading(false);
    setJumpscare(false);
    setCalibrated(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (streamRef.current || modelRef.current) return;

    const runId = ++runIdRef.current;
    setLoading(true);
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });

      if (runId !== runIdRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("Video element not ready");

      video.srcObject = stream;
      await video.play();

      const vision = await FilesetResolver.forVisionTasks(WASM_URL);

      const model = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "VIDEO",
        numFaces: 1,
      });

      if (runId !== runIdRef.current) {
        model.close();
        return;
      }

      modelRef.current = model;
      setCameraOn(true);

      let lastVideoTime = -1;

      intervalRef.current = setInterval(() => {
        if (video.readyState < 2 || !modelRef.current) return;
        if (video.currentTime === lastVideoTime) return;

        lastVideoTime = video.currentTime;

        const result = modelRef.current.detectForVideo(
          video,
          performance.now()
        );

        const face = result.faceLandmarks[0];
        let facingScreen = false;

        if (face) {
          // Approximate left-right head rotation.
          const leftEye = face[33];
          const rightEye = face[263];
          const nose = face[4];

          const eyeMid = (leftEye.x + rightEye.x) / 2;
          const eyeWidth = Math.abs(rightEye.x - leftEye.x);

          if (eyeWidth > 0.001) {
            const offset = (nose.x - eyeMid) / eyeWidth;
            offsetRef.current = offset;

            // Tune this threshold after testing.
            facingScreen =
              Math.abs(offset - baselineRef.current) < 0.16;
          }
        } else {
          offsetRef.current = null;
        }

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

          // Ignore very brief tracking errors.
          if (badFramesRef.current < 4) return;

          setStatus(face ? "looking-away" : "away");

          if (sessionRef.current) {
            const now = Date.now();

            if (awaySinceRef.current === null) {
              awaySinceRef.current = now;
            }

            const seconds = Math.floor(
              (now - awaySinceRef.current) / 1000
            );

            setAwaySeconds(seconds);

            if (seconds >= alertAfterSeconds && !alertedRef.current) {
              alertedRef.current = true;
              setJumpscare(true);
            }
          }
        }
      }, 250);
    } catch (err) {
      if (runId !== runIdRef.current) return;

      stopCamera();
      setError(
        err instanceof Error ? err.message : "Camera unavailable"
      );
    } finally {
      if (runId === runIdRef.current) setLoading(false);
    }
  }, [alertAfterSeconds, stopCamera]);

  function calibrate() {
    if (offsetRef.current === null) return;

    baselineRef.current = offsetRef.current;
    awaySinceRef.current = null;
    alertedRef.current = false;
    badFramesRef.current = 0;
    goodFramesRef.current = 0;

    setCalibrated(true);
    setAwaySeconds(0);
  }

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return {
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
    dismissJumpscare: () => setJumpscare(false),
  };
}
