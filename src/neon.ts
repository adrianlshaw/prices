import { NeonPostgrestClient } from '@neondatabase/postgrest-js';

const NEON_URL_KEY = 'neon_api_url';
const NEON_KEY_KEY = 'neon_api_key';
const MIGRATED_KEY = 'neon_migrated';
const LAST_SYNC_KEY = 'neon_last_sync';

export function getNeonApiUrl(): string {
  return localStorage.getItem(NEON_URL_KEY) ?? '';
}

export function getNeonApiKey(): string {
  return localStorage.getItem(NEON_KEY_KEY) ?? '';
}

export function setNeonConfig(apiUrl: string, apiKey: string): void {
  const changed = apiUrl !== getNeonApiUrl() || apiKey !== getNeonApiKey();
  localStorage.setItem(NEON_URL_KEY, apiUrl);
  localStorage.setItem(NEON_KEY_KEY, apiKey);
  if (changed) {
    // Reset sync state so a fresh migration runs on the new endpoint
    localStorage.removeItem(MIGRATED_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
  }
}

export function clearNeonConfig(): void {
  localStorage.removeItem(NEON_URL_KEY);
  localStorage.removeItem(NEON_KEY_KEY);
  localStorage.removeItem(MIGRATED_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
}

export function isNeonConfigured(): boolean {
  return !!(getNeonApiUrl() && getNeonApiKey());
}

export function wasNeonMigrated(): boolean {
  return localStorage.getItem(MIGRATED_KEY) === 'true';
}

export function markNeonMigrated(): void {
  localStorage.setItem(MIGRATED_KEY, 'true');
}

export function getLastSyncTime(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

export function setLastSyncTime(iso: string): void {
  localStorage.setItem(LAST_SYNC_KEY, iso);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getNeonClient(): NeonPostgrestClient<any, any> | null {
  const apiUrl = getNeonApiUrl();
  const apiKey = getNeonApiKey();
  if (!apiUrl || !apiKey) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NeonPostgrestClient<any, any>({
    dataApiUrl: apiUrl,
    options: {
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, {
            ...init,
            headers: { ...(init?.headers as Record<string, string>), Authorization: `Bearer ${apiKey}` },
          }),
      },
    },
  });
}
