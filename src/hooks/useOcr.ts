import { useEffect, useRef, useCallback } from 'react';
import { createWorker, type Worker } from 'tesseract.js';

interface UseOcrOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  onDetected: (pricePence: number, rawText: string) => void;
}

// Match: optional £/€, digits, dot or comma, exactly 2 decimal places
// e.g. £2.99  2.99  2,99  £12.50
const PRICE_RE = /[£€]?\s*(\d{1,4}[.,]\d{2})\b/;

function parsePriceToPence(raw: string): number {
  const normalised = raw.replace(/[£€\s]/g, '').replace(',', '.');
  return Math.round(parseFloat(normalised) * 100);
}

/**
 * Draws the centre crop of the video onto the canvas, converts to grayscale,
 * and boosts contrast — dramatically improves Tesseract accuracy on price tags.
 */
function prepareFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;

  // Crop to the middle 50% width x middle 33% height of the frame
  const cropW = Math.floor(vw * 0.5);
  const cropH = Math.floor(vh * 0.33);
  const cropX = Math.floor((vw - cropW) / 2);
  const cropY = Math.floor((vh - cropH) / 2);

  // Scale up 2x so Tesseract sees larger text
  canvas.width = cropW * 2;
  canvas.height = cropH * 2;

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

  // Grayscale + contrast boost
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const contrast = 1.8;
  const intercept = 128 * (1 - contrast);
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const v = Math.min(255, Math.max(0, contrast * gray + intercept));
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
  return true;
}

export function useOcr({ videoRef, enabled, onDetected }: UseOcrOptions): void {
  const workerRef = useRef<Worker | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const stopInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const terminateWorker = useCallback(async () => {
    stopInterval();
    if (workerRef.current) {
      await workerRef.current.terminate();
      workerRef.current = null;
    }
  }, [stopInterval]);

  useEffect(() => {
    if (!enabled) {
      void terminateWorker();
      return;
    }

    let active = true;

    async function initWorker() {
      const worker = await createWorker('eng', 1);
      await worker.setParameters({
        // PSM 7 = treat image as a single text line — ideal for price tags
        tessedit_pageseg_mode: '7' as Parameters<typeof worker.setParameters>[0]['tessedit_pageseg_mode'],
        tessedit_char_whitelist: '0123456789£€.,',
      });
      if (!active) {
        await worker.terminate();
        return;
      }
      workerRef.current = worker;

      intervalRef.current = setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;

        if (!prepareFrame(video, canvasRef.current)) return;

        try {
          const { data } = await workerRef.current!.recognize(canvasRef.current);
          const text = data.text.trim();

          const m = PRICE_RE.exec(text);
          if (m && data.confidence > 50) {
            const pence = parsePriceToPence(m[0]);
            if (pence >= 1 && pence < 100_000) {
              onDetectedRef.current(pence, text);
            }
          }
        } catch (err) {
          console.warn('[ocr]', err);
        }
      }, 1500);
    }

    void initWorker();

    return () => {
      active = false;
      void terminateWorker();
    };
  }, [enabled, terminateWorker, videoRef]);
}
