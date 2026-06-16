import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Trash2, ChevronRight, Cloud, Eye, EyeOff, RefreshCw, Copy, Check } from 'lucide-react';
import { getAllProducts, deleteProduct, clearAllData, exportAllAsCSV } from '../db';
import {
  getNeonPassword,
  setNeonPassword,
  clearNeonConfig,
  isNeonConfigured,
  getNeonSql,
} from '../neon';
import { migrateLocalToNeon, pullAndMerge } from '../sync';
import type { Product } from '../types';

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

export default function SettingsScreen() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // Neon config state
  const [neonKey, setNeonKey] = useState(() => getNeonPassword());
  const [showKey, setShowKey] = useState(false);
  const [neonStatus, setNeonStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>(
    () => (isNeonConfigured() ? 'ok' : 'idle'),
  );
  const [syncing, setSyncing] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  const load = useCallback(async () => {
    setProducts(await getAllProducts());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(barcode: string) {
    await deleteProduct(barcode);
    await load();
  }

  async function handleExport() {
    const csv = await exportAllAsCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleClearAll() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    await clearAllData();
    setConfirmClear(false);
    await load();
  }

  async function handleSaveNeon() {
    const key = neonKey.trim();
    if (!key) {
      clearNeonConfig();
      setNeonStatus('idle');
      return;
    }
    setNeonPassword(key);
    setNeonStatus('testing');
    try {
      const sql = getNeonSql()!;
      await sql`SELECT barcode FROM products LIMIT 1`;
      setNeonStatus('ok');
      void migrateLocalToNeon();
    } catch {
      setNeonStatus('error');
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      await pullAndMerge();
      await load();
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  }

  function handleCopySql() {
    void navigator.clipboard.writeText(SETUP_SQL);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  }

  const filtered = products.filter(
    (p) =>
      p.barcode.includes(search) ||
      p.name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div
      className="flex flex-col min-h-dvh bg-gray-900 text-white"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-gray-800"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-2 rounded-full active:bg-white/10"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>
        <p className="font-semibold text-lg">Settings</p>
      </div>

      {/* Actions */}
      <div className="px-4 pt-5 space-y-3">
        <button
          onClick={() => void handleExport()}
          className="w-full flex items-center justify-between bg-gray-800 px-4 py-4 rounded-xl active:bg-gray-700"
        >
          <div className="flex items-center gap-3">
            <Download size={20} className="text-indigo-400" />
            <span>Export data as CSV</span>
          </div>
          <ChevronRight size={18} className="text-gray-500" />
        </button>

        <button
          onClick={() => void handleClearAll()}
          className={`w-full flex items-center justify-between px-4 py-4 rounded-xl active:bg-red-900/50 ${
            confirmClear ? 'bg-red-800 border border-red-600' : 'bg-gray-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <Trash2 size={20} className="text-red-400" />
            <span className={confirmClear ? 'text-red-300 font-semibold' : ''}>
              {confirmClear ? 'Tap again to confirm — this is permanent' : 'Clear all data'}
            </span>
          </div>
          <ChevronRight size={18} className="text-gray-500" />
        </button>
      </div>

      {/* Cloud Sync — Neon */}
      <div className="px-4 pt-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Cloud Sync (Neon)
        </p>
        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <Cloud size={16} className={neonStatus === 'ok' ? 'text-green-400' : 'text-gray-500'} />
            <span className="text-sm text-gray-400">
              {neonStatus === 'idle' && 'Not configured'}
              {neonStatus === 'testing' && 'Testing connection…'}
              {neonStatus === 'ok' && <span className="text-green-400">Connected</span>}
              {neonStatus === 'error' && <span className="text-red-400">Connection failed — check password and try again</span>}
            </span>
          </div>

          {/* DB Password */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Database password</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={neonKey}
                onChange={(e) => setNeonKey(e.target.value)}
                placeholder="npg_…"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 active:text-white p-1"
                aria-label={showKey ? 'Hide password' : 'Show password'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Actions row */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => void handleSaveNeon()}
              className="flex-1 bg-indigo-600 text-white text-sm font-semibold py-2 rounded-lg active:bg-indigo-700"
            >
              {neonStatus === 'testing' ? 'Testing…' : 'Save & Test'}
            </button>
            {neonStatus === 'ok' && (
              <button
                onClick={() => void handleSyncNow()}
                disabled={syncing}
                className="flex items-center gap-1.5 bg-gray-700 text-white text-sm font-semibold px-3 py-2 rounded-lg active:bg-gray-600 disabled:opacity-50"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                Sync
              </button>
            )}
            {neonStatus === 'ok' && (
              <button
                onClick={() => {
                  clearNeonConfig();
                  setNeonKey('');
                  setNeonStatus('idle');
                }}
                className="bg-gray-700 text-red-400 text-sm font-semibold px-3 py-2 rounded-lg active:bg-gray-600"
              >
                Disconnect
              </button>
            )}
          </div>

          {/* Setup SQL */}
          <button
            onClick={() => setShowSql((v) => !v)}
            className="text-xs text-gray-500 underline underline-offset-2 active:text-gray-300"
          >
            {showSql ? 'Hide setup SQL' : 'Show setup SQL (run once in Neon console)'}
          </button>
          {showSql && (
            <div className="relative mt-1">
              <pre className="bg-gray-900 rounded-lg p-3 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap">
                {SETUP_SQL}
              </pre>
              <button
                onClick={handleCopySql}
                className="absolute top-2 right-2 bg-gray-700 rounded p-1 active:bg-gray-600"
                aria-label="Copy SQL"
              >
                {sqlCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-gray-400" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Product list */}
      <div className="px-4 pt-6 flex-1 overflow-y-auto">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Stored products ({products.length})
        </p>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or barcode"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {filtered.length === 0 && (
          <p className="text-gray-600 text-sm">No products found.</p>
        )}
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li
              key={p.barcode}
              className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3"
            >
              <button
                className="flex-1 text-left"
                onClick={() => navigate(`/result/${encodeURIComponent(p.barcode)}`)}
              >
                <p className="font-medium text-white">{p.name ?? <span className="text-gray-500 italic">Unnamed</span>}</p>
                <p className="text-xs text-gray-500 font-mono">{p.barcode}</p>
              </button>
              <button
                onClick={() => void handleDelete(p.barcode)}
                className="p-2 text-gray-600 active:text-red-400 rounded-full ml-2"
                aria-label="Delete product"
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
