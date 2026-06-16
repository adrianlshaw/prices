export function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
