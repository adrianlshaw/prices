import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fetchOFFName } from '../hooks/useOpenFoodFacts';
import { saveProduct, savePriceEntry, getProduct, getKnownStores } from '../db';
import { pushProduct, pushPriceEntry } from '../sync';
import { useAppStore } from '../store';
import type { PriceEntry, Product } from '../types';
import { generateId } from '../utils';

export default function AddPriceScreen() {
  const { barcode } = useParams<{ barcode: string }>();
  const navigate = useNavigate();

  const lastStore = useAppStore((s) => s.lastStore);
  const setLastStore = useAppStore((s) => s.setLastStore);

  const storeRef = useRef<HTMLInputElement>(null);
  const productNameRef = useRef<HTMLInputElement>(null);

  // Price state
  const [pricePence, setPricePence] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState('');

  const [knownStores, setKnownStores] = useState<string[]>([]);

  // Load known stores once on mount
  useEffect(() => {
    void getKnownStores().then(setKnownStores);
  }, []);

  // Pre-fill product name from DB then Open Food Facts — writes directly to DOM, no re-render
  useEffect(() => {
    if (!barcode) return;
    void (async () => {
      const p = await getProduct(barcode);
      if (p?.name && productNameRef.current) {
        productNameRef.current.value = p.name;
        return;
      }
      const offName = await fetchOFFName(barcode);
      if (offName && productNameRef.current && !productNameRef.current.value) {
        productNameRef.current.value = offName;
      }
    })();
  }, [barcode]);

  function handlePriceInput(val: string) {
    setPriceInput(val);
    const n = parseFloat(val.replace(',', '.'));
    setPricePence(isNaN(n) ? null : Math.round(n * 100));
  }

  async function handleSave() {
    if (!barcode) return;
    const store = storeRef.current?.value.trim() ?? '';
    const productName = productNameRef.current?.value.trim() ?? '';
    if (pricePence === null || pricePence <= 0 || store === '') return;

    setLastStore(store);

    const existingProduct = await getProduct(barcode);
    const product: Product = existingProduct ?? {
      barcode,
      name: productName || undefined,
      createdAt: new Date().toISOString(),
    };
    if (!existingProduct || (!existingProduct.name && productName)) {
      product.name = productName || undefined;
      await saveProduct(product);
      void pushProduct(product);
    }

    const entry: PriceEntry = {
      id: generateId(),
      barcode,
      store,
      pricePence,
      recordedAt: new Date().toISOString(),
      source: 'manual',
    };
    await savePriceEntry(entry);
    void pushPriceEntry(entry);

    navigate(`/result/${encodeURIComponent(barcode)}`);
  }

  const canSave = pricePence !== null && pricePence > 0;

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
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full active:bg-white/10"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="font-semibold">Add price</p>
          <p className="text-xs text-gray-400 font-mono">{barcode}</p>
        </div>
      </div>

      {/* Form — uncontrolled inputs prevent re-renders from typing */}
      <div className="flex-1 px-4 pt-5 space-y-4">

        {/* Price */}
        <div>
          <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wide">
            Price (£)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => handlePriceInput(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-xl font-mono text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Store — uncontrolled */}
        <div>
          <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wide">
            Store
          </label>
          <input
            ref={storeRef}
            type="text"
            list="known-stores"
            defaultValue={lastStore}
            placeholder="e.g. Tesco"
            autoComplete="off"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-base text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <datalist id="known-stores">
            {knownStores.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        {/* Product name — uncontrolled, pre-filled via ref */}
        <div>
          <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wide">
            Product name <span className="normal-case font-normal">(optional)</span>
          </label>
          <input
            ref={productNameRef}
            type="text"
            defaultValue=""
            placeholder="Leave blank to skip"
            autoComplete="off"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-base text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Save */}
      <div className="px-4 py-3 bg-gray-900 border-t border-gray-800">
        <button
          disabled={!canSave}
          onClick={() => void handleSave()}
          className="w-full py-4 rounded-2xl text-base font-semibold transition-colors
            disabled:bg-gray-700 disabled:text-gray-500
            enabled:bg-indigo-600 enabled:active:bg-indigo-700 enabled:text-white"
        >
          Save
        </button>
      </div>
    </div>
  );
}
