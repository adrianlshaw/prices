import { useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useBarcodeReader } from '../hooks/useBarcodeReader';
import { useAppStore } from '../store';

export default function ScannerScreen() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const setPendingBarcode = useAppStore((s) => s.setPendingBarcode);
  const [scanning, setScanning] = useState(true);

  const handleDetected = useCallback(
    (barcode: string) => {
      setScanning(false);
      setPendingBarcode(barcode);
      // Navigate immediately — ResultScreen will redirect to /add if no entry exists
      navigate(`/result/${encodeURIComponent(barcode)}`);
    },
    [navigate, setPendingBarcode],
  );

  useBarcodeReader({ videoRef, onDetected: handleDetected, enabled: scanning });

  return (
    <div className="relative w-full h-dvh bg-black overflow-hidden">
      {/* Full-screen camera */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        playsInline
        muted
      />

      {/* Scan guide overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="relative w-64 h-40">
          <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-md" />
          <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-md" />
          <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-md" />
          <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-md" />
          <div className="absolute inset-x-2 top-0 h-0.5 bg-white/60 animate-bounce" style={{ animationDuration: '2s' }} />
        </div>
        <p className="mt-4 text-white/70 text-sm font-medium tracking-wide">
          Point at a barcode
        </p>
      </div>

      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <span className="text-white font-semibold text-lg">Price Checker</span>
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-full bg-white/10 active:bg-white/25 text-white"
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
