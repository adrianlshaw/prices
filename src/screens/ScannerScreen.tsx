import { useRef, useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Cloud, X, Eye, EyeOff } from 'lucide-react';
import { useBarcodeReader } from '../hooks/useBarcodeReader';
import { useAppStore } from '../store';
import { isNeonConfigured, setNeonConfig, getNeonClient } from '../neon';
import { migrateLocalToNeon } from '../sync';

const DISMISSED_KEY = 'neon_setup_dismissed';

export default function ScannerScreen() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const setPendingBarcode = useAppStore((s) => s.setPendingBarcode);
  const [scanning, setScanning] = useState(true);

  const [showPrompt, setShowPrompt] = useState(false);
  const [apiUrl] = useState('https://ep-flat-surf-abxdgt89.apirest.eu-west-2.aws.neon.tech/neondb/rest/v1');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');

  useEffect(() => {
    if (!isNeonConfigured() && localStorage.getItem(DISMISSED_KEY) !== 'true') {
      setShowPrompt(true);
    }
  }, []);

  async function handleConnect() {
    const url = apiUrl.trim();
    const key = apiKey.trim();
    if (!url || !key) return;
    setStatus('saving');
    setNeonConfig(url, key);
    try {
      const client = getNeonClient()!;
      const { error } = await client.from('products').select('barcode').limit(1);
      if (error) throw error;
      setStatus('ok');
      void migrateLocalToNeon();
      setTimeout(() => {
        setShowPrompt(false);
      }, 800);
    } catch {
      setStatus('error');
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setShowPrompt(false);
  }

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

      {/* Cloud sync setup prompt */}
      {showPrompt && (
        <div
          className="absolute inset-x-0 bottom-0 bg-gray-900/95 backdrop-blur-sm rounded-t-2xl px-5 pt-5 pb-safe"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cloud size={18} className="text-indigo-400" />
              <span className="font-semibold text-white">Set up cloud sync</span>
            </div>
            <button onClick={handleDismiss} className="text-gray-500 active:text-white p-1" aria-label="Dismiss">
              <X size={18} />
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Enter your Neon database password to sync prices across devices.
          </p>

          <div className="relative mb-3">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setStatus('idle'); }}
              placeholder="Database password (npg_…)"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 active:text-white p-1"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {status === 'error' && (
            <p className="text-xs text-red-400 mb-2">Connection failed — check password and try again.</p>
          )}
          {status === 'ok' && (
            <p className="text-xs text-green-400 mb-2">Connected!</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => void handleConnect()}
              disabled={!apiKey.trim() || status === 'saving'}
              className="flex-1 bg-indigo-600 text-white text-sm font-semibold py-3 rounded-xl active:bg-indigo-700 disabled:opacity-40"
            >
              {status === 'saving' ? 'Connecting…' : 'Connect'}
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 bg-gray-800 text-gray-400 text-sm font-semibold py-3 rounded-xl active:bg-gray-700"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
