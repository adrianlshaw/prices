import {
  getNeonSql,
  isNeonConfigured,
  wasNeonMigrated,
  markNeonMigrated,
  getLastSyncTime,
  setLastSyncTime,
} from './neon';
import { db } from './db';
import type { Product, PriceEntry } from './types';

interface NeonProduct { barcode: string; name: string | null; created_at: string; }
interface NeonEntry { id: string; barcode: string; store: string; price_pence: number; recorded_at: string; source: string; }

export async function pushProduct(product: Product): Promise<void> {
  const sql = getNeonSql();
  if (!sql) return;
  try {
    await sql`
      INSERT INTO products (barcode, name, created_at)
      VALUES (${product.barcode}, ${product.name ?? null}, ${product.createdAt})
      ON CONFLICT (barcode) DO UPDATE SET name = EXCLUDED.name
    `;
  } catch { /* best-effort */ }
}

export async function pushPriceEntry(entry: PriceEntry): Promise<void> {
  const sql = getNeonSql();
  if (!sql) return;
  try {
    await sql`
      INSERT INTO price_entries (id, barcode, store, price_pence, recorded_at, source)
      VALUES (${entry.id}, ${entry.barcode}, ${entry.store}, ${entry.pricePence}, ${entry.recordedAt}, ${entry.source})
      ON CONFLICT (id) DO NOTHING
    `;
  } catch { /* best-effort */ }
}

export async function migrateLocalToNeon(): Promise<void> {
  if (!isNeonConfigured() || wasNeonMigrated()) return;
  const sql = getNeonSql()!;
  const [products, entries] = await Promise.all([
    db.products.toArray(),
    db.priceEntries.toArray(),
  ]);
  for (const p of products) {
    await sql`
      INSERT INTO products (barcode, name, created_at)
      VALUES (${p.barcode}, ${p.name ?? null}, ${p.createdAt})
      ON CONFLICT (barcode) DO UPDATE SET name = EXCLUDED.name
    `;
  }
  for (const e of entries) {
    await sql`
      INSERT INTO price_entries (id, barcode, store, price_pence, recorded_at, source)
      VALUES (${e.id}, ${e.barcode}, ${e.store}, ${e.pricePence}, ${e.recordedAt}, ${e.source})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  markNeonMigrated();
}

export async function pullAndMerge(): Promise<void> {
  if (!isNeonConfigured()) return;
  const sql = getNeonSql()!;
  const since = getLastSyncTime();
  const syncStart = new Date().toISOString();

  const products = since
    ? (await sql`SELECT barcode, name, created_at FROM products WHERE created_at > ${since}`) as NeonProduct[]
    : (await sql`SELECT barcode, name, created_at FROM products`) as NeonProduct[];

  const entries = since
    ? (await sql`SELECT id, barcode, store, price_pence, recorded_at, source FROM price_entries WHERE recorded_at > ${since}`) as NeonEntry[]
    : (await sql`SELECT id, barcode, store, price_pence, recorded_at, source FROM price_entries`) as NeonEntry[];

  for (const p of products) {
    await db.products.put({ barcode: p.barcode, name: p.name ?? undefined, createdAt: p.created_at });
  }
  for (const e of entries) {
    await db.priceEntries.put({
      id: e.id, barcode: e.barcode, store: e.store,
      pricePence: e.price_pence, recordedAt: e.recorded_at,
      source: e.source as 'ocr' | 'manual',
    });
  }
  setLastSyncTime(syncStart);
}

export async function syncOnStartup(): Promise<void> {
  if (!isNeonConfigured() || !navigator.onLine) return;
  try {
    await migrateLocalToNeon();
    await pullAndMerge();
  } catch { /* best-effort */ }
}
