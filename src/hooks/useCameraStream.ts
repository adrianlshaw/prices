import { useEffect, useRef, useCallback } from 'react';

/**
 * Starts the rear camera and attaches its stream to the given video element.
 * Stops cleanly on unmount or when `enabled` becomes false.
 */
export function useCameraStream(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): void {
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [videoRef]);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => console.error('[camera]', err));

    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, stop, videoRef]);
}
