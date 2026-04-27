export function formatTime(iso: string): string {
  try {
    return new Date(iso)
      .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      .toLowerCase();
  } catch {
    return '';
  }
}

export function formatTokens(n: number): string {
  if (n < 1000) return `${n} tok`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

export function formatCost(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return `<$0.01`;
  if (usd < 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(2)}`;
}

export function hostnameOf(url: string): string | null {
  if (!url || url === 'forge://home') return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
