import { useState, useEffect } from 'react';

interface OFFProduct {
  product_name?: string;
  abbreviated_product_name?: string;
}

interface OFFResponse {
  status: number;
  product?: OFFProduct;
}

const cache = new Map<string, string | null>();

/** Synchronous cache read — returns undefined if not yet fetched */
export function getCachedOFFName(barcode: string): string | null | undefined {
  return cache.has(barcode) ? (cache.get(barcode) ?? null) : undefined;
}

/** Fire-and-forget fetch that populates the cache. Returns the name or null. */
export async function fetchOFFName(barcode: string): Promise<string | null> {
  if (cache.has(barcode)) return cache.get(barcode) ?? null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}.json`,
      { signal: controller.signal, headers: { 'User-Agent': 'PriceChecker/1.0' } },
    );
    const data = (await r.json()) as OFFResponse;
    const resolved =
      data.status === 1
        ? (data.product?.abbreviated_product_name ?? data.product?.product_name ?? null)
        : null;
    cache.set(barcode, resolved);
    return resolved;
  } catch {
    cache.set(barcode, null);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Reactive hook — use in screens where you need loading state (e.g. ResultScreen) */
export function useOpenFoodFacts(barcode: string | null): { name: string | null; loading: boolean } {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!barcode) {
      setName(null);
      return;
    }

    if (cache.has(barcode)) {
      setName(cache.get(barcode) ?? null);
      return;
    }

    setLoading(true);
    let cancelled = false;
    fetchOFFName(barcode).then((resolved) => {
      if (!cancelled) {
        setName(resolved);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [barcode]);

  return { name, loading };
}
