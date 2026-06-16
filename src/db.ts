import Dexie, { type Table } from 'dexie';
import type { Product, PriceEntry } from './types';

class PriceDB extends Dexie {
  products!: Table<Product, string>;
  priceEntries!: Table<PriceEntry, string>;

  constructor() {
    super('PriceCheckerDB');
    this.version(1).stores({
      products: 'barcode, createdAt',
      priceEntries: 'id, barcode, store, recordedAt',
    });
  }
}

export const db = new PriceDB();

// ── helpers ──────────────────────────────────────────────────────────────────

export async function getProduct(barcode: string): Promise<Product | undefined> {
  return db.products.get(barcode);
}

export async function saveProduct(product: Product): Promise<void> {
  await db.products.put(product);
}

export async function savePriceEntry(entry: PriceEntry): Promise<void> {
  await db.priceEntries.put(entry);
}

export async function getEntriesForBarcode(barcode: string): Promise<PriceEntry[]> {
  return db.priceEntries
    .where('barcode')
    .equals(barcode)
    .sortBy('recordedAt')
    .then((entries) => entries.reverse());
}

export async function getCheapestForBarcode(barcode: string): Promise<PriceEntry | undefined> {
  const entries = await db.priceEntries.where('barcode').equals(barcode).toArray();
  if (entries.length === 0) return undefined;
  return entries.reduce((min, e) => (e.pricePence < min.pricePence ? e : min));
}

export async function getAllProducts(): Promise<Product[]> {
  return db.products.orderBy('createdAt').reverse().toArray();
}

export async function deleteProduct(barcode: string): Promise<void> {
  await db.transaction('rw', db.products, db.priceEntries, async () => {
    await db.priceEntries.where('barcode').equals(barcode).delete();
    await db.products.delete(barcode);
  });
}

export async function deletePriceEntry(id: string): Promise<void> {
  await db.priceEntries.delete(id);
}

export async function exportAllAsCSV(): Promise<string> {
  const products = await db.products.toArray();
  const entries = await db.priceEntries.toArray();

  const productMap = new Map(products.map((p) => [p.barcode, p]));

  const rows = entries.map((e) => {
    const name = productMap.get(e.barcode)?.name ?? '';
    const price = (e.pricePence / 100).toFixed(2);
    return [e.barcode, name, e.store, `£${price}`, e.recordedAt, e.source].join(',');
  });

  return ['barcode,name,store,price,recorded_at,source', ...rows].join('\n');
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.products, db.priceEntries, async () => {
    await db.priceEntries.clear();
    await db.products.clear();
  });
}

/** Returns the unique list of stores seen so far, most recently used first. */
export async function getKnownStores(): Promise<string[]> {
  const entries = await db.priceEntries.orderBy('recordedAt').reverse().toArray();
  const seen = new Set<string>();
  for (const e of entries) seen.add(e.store);
  return [...seen];
}
