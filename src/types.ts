export interface Product {
  barcode: string; // PK
  name?: string;
  createdAt: string; // ISO datetime
}

export interface PriceEntry {
  id: string; // uuid PK
  barcode: string;
  store: string;
  /** Stored in pence (integer). Display as £X.XX */
  pricePence: number;
  recordedAt: string; // ISO datetime
  source: 'ocr' | 'manual';
}

/** Convenience type returned from DB queries */
export interface CheapestResult {
  product: Product;
  cheapest: PriceEntry;
  allEntries: PriceEntry[];
}
