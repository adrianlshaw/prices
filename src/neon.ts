import { neon } from '@neondatabase/serverless';

// Fixed for this project — only the password changes
const NEON_HOST = 'ep-flat-surf-abxdgt89.eu-west-2.aws.neon.tech';
const NEON_USER = 'neondb_owner';
const NEON_DB = 'neondb';

const NEON_PASSWORD_KEY = 'neon_password';
const MIGRATED_KEY = 'neon_migrated';
const LAST_SYNC_KEY = 'neon_last_sync';

export function getNeonPassword(): string {
  return localStorage.getItem(NEON_PASSWORD_KEY) ?? '';
}

export function setNeonPassword(password: string): void {
  const changed = password !== getNeonPassword();
  localStorage.setItem(NEON_PASSWORD_KEY, password);
  if (changed) {
    localStorage.removeItem(MIGRATED_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
  }
}

export function clearNeonConfig(): void {
  localStorage.removeItem(NEON_PASSWORD_KEY);
  localStorage.removeItem(MIGRATED_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
}

export function isNeonConfigured(): boolean {
  return !!getNeonPassword();
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

export function getNeonSql(): ReturnType<typeof neon> | null {
  const password = getNeonPassword();
  if (!password) return null;
  const connStr = `postgresql://${NEON_USER}:${encodeURIComponent(password)}@${NEON_HOST}/${NEON_DB}?sslmode=require`;
  return neon(connStr);
}
