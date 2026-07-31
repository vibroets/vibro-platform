export function parseDraftId(raw: any): number | undefined {
  if (raw == null || raw === '') return undefined;
  const d = String(raw);

  // If it's a plain numeric string like '123' or number 123
  if (!d.startsWith('db_draft_')) {
    const n = Number(d);
    if (Number.isFinite(n)) return n;
  }

  // Handle frontend ids that start with 'db_draft_' and may include multiple parts
  if (d.startsWith('db_draft_')) {
    const parts = d.split('_').filter(Boolean);
    // Search from the end for the first numeric token
    for (let i = parts.length - 1; i >= 0; i--) {
      const maybe = Number(parts[i]);
      if (Number.isFinite(maybe)) return maybe;
    }
  }

  // Fallback: try extracting the first numeric substring
  const m = d.match(/(\d+)/);
  if (m) {
    const num = Number(m[1]);
    if (Number.isFinite(num)) return num;
  }

  return undefined;
}
