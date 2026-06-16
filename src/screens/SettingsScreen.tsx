import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Trash2, ChevronRight } from 'lucide-react';
import { getAllProducts, deleteProduct, clearAllData, exportAllAsCSV } from '../db';
import type { Product } from '../types';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

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
