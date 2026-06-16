import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { getProduct, getEntriesForBarcode, getCheapestForBarcode, deletePriceEntry, saveProduct } from '../db';
import { useOpenFoodFacts } from '../hooks/useOpenFoodFacts';
import type { Product, PriceEntry } from '../types';
import { formatPrice, formatDate } from '../utils';

export default function ResultScreen() {
  const { barcode } = useParams<{ barcode: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [cheapest, setCheapest] = useState<PriceEntry | null>(null);
  const [entries, setEntries] = useState<PriceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!barcode) return;
    setLoading(true);
    const [p, cheap, all] = await Promise.all([
      getProduct(barcode),
      getCheapestForBarcode(barcode),
      getEntriesForBarcode(barcode),
    ]);

    // No entries at all — redirect immediately to add-price
    if (all.length === 0) {
      navigate(`/add/${encodeURIComponent(barcode)}`, { replace: true });
      return;
    }

    setProduct(p ?? null);
    setCheapest(cheap ?? null);
    setEntries(all);
    setLoading(false);
  }, [barcode, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(id: string) {
    await deletePriceEntry(id);
    await load();
  }

  if (!barcode) return null;

  // Brief loading flash while DB query runs
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-gray-900 gap-3">
        <Loader2 size={28} className="text-indigo-400 animate-spin" />
        <p className="text-gray-400 text-sm">Checking database…</p>
      </div>
    );
  }

  /** Inline component: shows OFacts lookup status in the header */
  function OFFStatus() {
    const { name: offName, loading: offLoading } = useOpenFoodFacts(barcode ?? null);

    useEffect(() => {
      if (offName && product && !product.name) {
        const updated = { ...product, name: offName };
        setProduct(updated);
        void saveProduct(updated);
      }
    }, [offName]);

    const displayName = product?.name ?? offName;

    return (
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 truncate font-mono">{barcode}</p>
        {displayName ? (
          <p className="text-base font-semibold truncate">{displayName}</p>
        ) : offLoading ? (
          <p className="text-xs text-indigo-400 flex items-center gap-1 mt-0.5">
            <Loader2 size={11} className="animate-spin" />
            Looking up product name…
          </p>
        ) : (
          <p className="text-xs text-gray-600 mt-0.5">Unknown product</p>
        )}
      </div>
    );
  }

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
          className="p-2 -ml-2 rounded-full active:bg-white/10 text-white"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>
        <OFFStatus />
      </div>

      {/* Cheapest price hero */}
      {cheapest ? (
        <div className="flex flex-col items-center py-8 px-4 bg-gray-800 border-b border-gray-700">
          <p className="text-sm text-gray-400 uppercase tracking-widest mb-1">Cheapest seen</p>
          <p className="text-5xl font-bold text-green-400">{formatPrice(cheapest.pricePence)}</p>
          <p className="mt-2 text-lg text-gray-300">{cheapest.store}</p>
          <p className="text-xs text-gray-500 mt-1">{formatDate(cheapest.recordedAt)}</p>
        </div>
      ) : (
        <div className="flex items-center justify-center py-10 text-gray-500">
          No prices recorded yet
        </div>
      )}

      {/* Price history */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          All price history
        </h2>
        {entries.length === 0 && (
          <p className="text-gray-600 text-sm">No entries yet.</p>
        )}
        <ul className="space-y-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                e.id === cheapest?.id ? 'bg-green-900/40 border border-green-700/50' : 'bg-gray-800'
              }`}
            >
              <div>
                <p className="font-semibold text-white">{formatPrice(e.pricePence)}</p>
                <p className="text-sm text-gray-400">{e.store}</p>
                <p className="text-xs text-gray-600">{formatDate(e.recordedAt)} · {e.source}</p>
              </div>
              <button
                onClick={() => void handleDelete(e.id)}
                className="p-2 text-gray-600 active:text-red-400 rounded-full"
                aria-label="Delete entry"
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Add price button */}
      <div className="sticky bottom-0 px-4 py-3 bg-gray-900 border-t border-gray-800">
        <button
          onClick={() => navigate(`/add/${encodeURIComponent(barcode)}`)}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 active:bg-indigo-700 text-white font-semibold py-4 rounded-2xl text-base"
        >
          <PlusCircle size={20} />
          Add price at this store
        </button>
      </div>
    </div>
  );
}
