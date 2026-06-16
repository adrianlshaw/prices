import { useRef, useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Cloud, X, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { useBarcodeReader } from '../hooks/useBarcodeReader';
import { useAppStore } from '../store';
import { isNeonConfigured, setNeonPassword, getNeonSql } from '../neon';
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
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error' | 'needs-tables'>('idle');
  const [sqlCopied, setSqlCopied] = useState(false);

  const SETUP_SQL = `CREATE TABLE IF NOT EXISTS products (
  barcode TEXT PRIMARY KEY,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS price_entries (
  id UUID PRIMARY KEY,
  barcode TEXT NOT NULL REFERENCES products(barcode) ON DELETE CASCADE,
  store TEXT NOT NULL,
  price_pence INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ocr', 'manual'))
);`;

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
    setNeonPassword(key);
    try {
      const sql = getNeonSql()!;
      await sql`SELECT barcode FROM products LIMIT 1`;
      setStatus('ok');
      void migrateLocalToNeon();
      setTimeout(() => setShowPrompt(false), 800);
    } catch (err) {
      const msg = String(err);
      if (msg.includes('does not exist') || msg.includes('42P01')) {
        setStatus('needs-tables');
        return;
      }
      setStatus('error');
    }
  }

  function handleCopySql() {
    void navigator.clipboard.writeText(SETUP_SQL);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  }

  function handleTablesCreated() {
    // User says they've run the SQL — re-test
    setStatus('idle');
    void handleConnect();
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
        <div className="relative w-72 h-44">
          {/* Corner brackets */}
          <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-md" style={{ borderWidth: '3px', borderRight: 'none', borderBottom: 'none' }} />
          <span className="absolute top-0 right-0 w-8 h-8 border-white rounded-tr-md" style={{ borderWidth: '3px', borderLeft: 'none', borderBottom: 'none' }} />
          <span className="absolute bottom-0 left-0 w-8 h-8 border-white rounded-bl-md" style={{ borderWidth: '3px', borderRight: 'none', borderTop: 'none' }} />
          <span className="absolute bottom-0 right-0 w-8 h-8 border-white rounded-br-md" style={{ borderWidth: '3px', borderLeft: 'none', borderTop: 'none' }} />
          {/* Scanning line */}
          <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-green-400/80 animate-pulse" />
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
            <p className="text-xs text-red-400 mb-2">Connection failed — check your password and try again.</p>
          )}
          {status === 'ok' && (
            <p className="text-xs text-green-400 mb-2">Connected!</p>
          )}
          {status === 'needs-tables' && (
            <div className="mb-3">
              <p className="text-xs text-amber-400 mb-2">Connected! Now run this SQL once in the <a href="https://console.neon.tech" target="_blank" rel="noreferrer" className="underline">Neon console</a>:</p>
              <div className="relative">
                <pre className="bg-gray-950 rounded-lg p-2.5 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">{SETUP_SQL}</pre>
                <button
                  onClick={handleCopySql}
                  className="absolute top-1.5 right-1.5 bg-gray-700 rounded p-1 active:bg-gray-600"
                  aria-label="Copy SQL"
                >
                  {sqlCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-gray-400" />}
                </button>
              </div>
              <button
                onClick={handleTablesCreated}
                className="mt-2 w-full bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-xl active:bg-indigo-700"
              >
                I've run the SQL — continue
              </button>
            </div>
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
