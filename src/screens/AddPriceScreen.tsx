import { useRef, useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Keyboard } from 'lucide-react';
import { useOcr } from '../hooks/useOcr';
import { useCameraStream } from '../hooks/useCameraStream';
import { fetchOFFName } from '../hooks/useOpenFoodFacts';
import { saveProduct, savePriceEntry, getProduct, getKnownStores } from '../db';
import { pushProduct, pushPriceEntry } from '../sync';
import { useAppStore } from '../store';
import type { PriceEntry, Product } from '../types';
import { formatPrice, generateId } from '../utils';

export default function AddPriceScreen() {
  const { barcode } = useParams<{ barcode: string }>();
  const navigate = useNavigate();

  const lastStore = useAppStore((s) => s.lastStore);
  const setLastStore = useAppStore((s) => s.setLastStore);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Uncontrolled refs — typing into these fields causes ZERO React re-renders
  const storeRef = useRef<HTMLInputElement>(null);
  const productNameRef = useRef<HTMLInputElement>(null);

  const [manualMode, setManualMode] = useState(false);
  const [ocrLocked, setOcrLocked] = useState(false);
  const [flash, setFlash] = useState(false);

  // Price is kept as state because OCR writes to it and we display it
  const [pricePence, setPricePence] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState('');

  const [knownStores, setKnownStores] = useState<string[]>([]);

  useCameraStream(videoRef, !manualMode);

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

  const handleOcrDetected = useCallback(
    (detected: number) => {
      if (ocrLocked) return;
      setPricePence(detected);
      setPriceInput((detected / 100).toFixed(2));
      setOcrLocked(true);
      setFlash(true);
      navigator.vibrate?.(80);
      setTimeout(() => setFlash(false), 400);
    },
    [ocrLocked],
  );

  useOcr({ videoRef, enabled: !manualMode && !ocrLocked, onDetected: handleOcrDetected });

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
      source: manualMode ? 'manual' : 'ocr',
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

      {/* Camera / OCR area */}
      {!manualMode && (
        <div className="relative bg-black" style={{ height: '220px' }}>
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          {!ocrLocked && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="absolute inset-0 bg-black/30" />
              <div
                className="relative border-2 border-white rounded-lg z-10"
                style={{ width: '50%', height: '50%' }}
              >
                <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-400 rounded-tl" />
                <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-400 rounded-tr" />
                <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-400 rounded-bl" />
                <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-400 rounded-br" />
              </div>
              <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                <span className="bg-black/70 text-white text-xs px-3 py-1 rounded-full">
                  Align price tag in the box
                </span>
              </div>
            </div>
          )}
          {flash && <div className="absolute inset-0 bg-white/50 pointer-events-none" />}
          {ocrLocked && pricePence !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="bg-green-500 rounded-2xl px-6 py-3 flex items-center gap-2">
                <Zap size={18} />
                <span className="font-bold text-lg">{formatPrice(pricePence)} captured</span>
              </div>
            </div>
          )}
        </div>
      )}

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
            {!manualMode && ocrLocked && (
              <button
                onClick={() => { setOcrLocked(false); setPricePence(null); setPriceInput(''); }}
                className="text-xs text-gray-400 px-3 active:text-white"
              >
                Retry
              </button>
            )}
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

        {/* Manual / OCR toggle */}
        <button
          onClick={() => setManualMode((m) => !m)}
          className="flex items-center gap-2 text-sm text-indigo-400 active:text-indigo-200"
        >
          <Keyboard size={16} />
          {manualMode ? 'Use camera OCR instead' : 'Enter price manually'}
        </button>
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
