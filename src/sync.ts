import {
  getNeonClient,
  isNeonConfigured,
  wasNeonMigrated,
  markNeonMigrated,
  getLastSyncTime,
  setLastSyncTime,
} from './neon';
import { db } from './db';
import type { Product, PriceEntry } from './types';

// ── Neon row shapes (snake_case, matches DB columns) ────────────────────────

interface NeonProduct {
  barcode: string;
  name: string | null;
  created_at: string;
}

interface NeonPriceEntry {
  id: string;
  barcode: string;
  store: string;
  price_pence: number;
  recorded_at: string;
  source: string;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function toNeonProduct(p: Product): NeonProduct {
  return { barcode: p.barcode, name: p.name ?? null, created_at: p.createdAt };
}

function fromNeonProduct(p: NeonProduct): Product {
  return { barcode: p.barcode, name: p.name ?? undefined, createdAt: p.created_at };
}

function toNeonEntry(e: PriceEntry): NeonPriceEntry {
  return {
    id: e.id,
    barcode: e.barcode,
    store: e.store,
    price_pence: e.pricePence,
    recorded_at: e.recordedAt,
    source: e.source,
  };
}

function fromNeonEntry(e: NeonPriceEntry): PriceEntry {
  return {
    id: e.id,
    barcode: e.barcode,
    store: e.store,
    pricePence: e.price_pence,
    recordedAt: e.recorded_at,
    source: e.source as 'ocr' | 'manual',
  };
}

// ── Single-item push (fire-and-forget after local save) ─────────────────────

/** Upsert one product to Neon. Safe to call without awaiting. */
export async function pushProduct(product: Product): Promise<void> {
  const client = getNeonClient();
  if (!client) return;
  try {
    await client
      .from('products')
      .upsert(toNeonProduct(product) as never, { onConflict: 'barcode' });
  } catch {
    // best-effort — offline or misconfigured, ignore
  }
}

/** Upsert one price entry to Neon. Safe to call without awaiting. */
export async function pushPriceEntry(entry: PriceEntry): Promise<void> {
  const client = getNeonClient();
  if (!client) return;
  try {
    await client
      .from('price_entries')
      .upsert(toNeonEntry(entry) as never, { onConflict: 'id' });
  } catch {
    // best-effort — offline or misconfigured, ignore
  }
}

// ── One-time migration: push all local data to Neon ─────────────────────────

/** Push all IndexedDB rows to Neon. Runs once per Neon endpoint. */
export async function migrateLocalToNeon(): Promise<void> {
  if (!isNeonConfigured() || wasNeonMigrated()) return;
  const client = getNeonClient()!;

  const [products, entries] = await Promise.all([
    db.products.toArray(),
    db.priceEntries.toArray(),
  ]);

  const BATCH = 50;
  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH).map(toNeonProduct);
    await client.from('products').upsert(batch as never, { onConflict: 'barcode' });
  }
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH).map(toNeonEntry);
    await client.from('price_entries').upsert(batch as never, { onConflict: 'id' });
  }

  markNeonMigrated();
}

// ── Pull Neon → merge into IndexedDB ────────────────────────────────────────

/** Pull remote rows newer than last sync and upsert into local IndexedDB. */
export async function pullAndMerge(): Promise<void> {
  if (!isNeonConfigured()) return;
  const client = getNeonClient()!;
  const since = getLastSyncTime();
  const syncStart = new Date().toISOString();

  const prodReq = since
    ? client.from('products').select('*').gt('created_at', since)
    : client.from('products').select('*');
  const { data: rawProducts, error: prodErr } = await prodReq;
  if (prodErr) throw prodErr;

  const entryReq = since
    ? client.from('price_entries').select('*').gt('recorded_at', since)
    : client.from('price_entries').select('*');
  const { data: rawEntries, error: entryErr } = await entryReq;
  if (entryErr) throw entryErr;

  const remoteProducts = (rawProducts ?? []) as NeonProduct[];
  const remoteEntries = (rawEntries ?? []) as NeonPriceEntry[];

  // Write directly to IndexedDB — do NOT call pushProduct/pushPriceEntry
  // here to avoid a sync loop
  for (const p of remoteProducts) {
    await db.products.put(fromNeonProduct(p));
  }
  for (const e of remoteEntries) {
    await db.priceEntries.put(fromNeonEntry(e));
  }

  setLastSyncTime(syncStart);
}

// ── Startup sync ─────────────────────────────────────────────────────────────

/** Called once on app mount. Migrates local data then pulls remote changes. */
export async function syncOnStartup(): Promise<void> {
  if (!isNeonConfigured() || !navigator.onLine) return;
  try {
    await migrateLocalToNeon();
    await pullAndMerge();
  } catch {
    // best-effort — don't block the app
  }
}
