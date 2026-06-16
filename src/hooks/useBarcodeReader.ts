import { useEffect, useRef, useCallback } from 'react';
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  NotFoundException,
} from '@zxing/library';

interface UseBarcodeReaderOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onDetected: (barcode: string) => void;
  enabled: boolean;
}

export function useBarcodeReader({ videoRef, onDetected, enabled }: UseBarcodeReaderOptions): void {
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const stop = useCallback(() => {
    readerRef.current?.reset();
    readerRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) return;

    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);
    readerRef.current = reader;

    let lastResult = '';
    let lastTime = 0;

    // decodeFromConstraints manages the camera stream and attaches it to the
    // provided video element — passing undefined for deviceId uses the default
    // (environment-facing) camera via the constraints below.
    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoEl,
        (result, err) => {
          if (result) {
            const now = Date.now();
            // Debounce: same barcode must not fire again within 3 s
            if (result.getText() === lastResult && now - lastTime < 3000) return;
            lastResult = result.getText();
            lastTime = now;
            navigator.vibrate?.(50);
            onDetectedRef.current(result.getText());
          } else if (err && !(err instanceof NotFoundException)) {
            // NotFoundException is normal (no barcode in frame) — ignore it
            console.warn('[barcode]', err);
          }
        },
      )
      .catch((err: unknown) => console.error('[barcode] start error', err));

    return () => {
      stop();
    };
  }, [enabled, stop, videoRef]);
}
