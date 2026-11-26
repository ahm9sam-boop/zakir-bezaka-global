// Uploads a big file in small pieces (default 6 MB) so 1-2 hour recordings work on slow or unstable connections.
export async function uploadFile(file: File, onPct?: (pct: number) => void, chunk = 6 * 1024 * 1024): Promise<string> {
  const id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const total = Math.max(1, Math.ceil(file.size / chunk));
  for (let i = 0; i < total; i++) {
    const blob = file.slice(i * chunk, Math.min(file.size, (i + 1) * chunk));
    let ok = false, lastErr = '';
    for (let a = 0; a < 6 && !ok; a++) {
      try {
        const r = await fetch(`/api/upload/${id}?i=${i}&n=${total}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob });
        if (r.ok) ok = true;
        else { const j = await r.json().catch(() => ({})); lastErr = j.error || 'upload ' + r.status; if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) break; }
      } catch (e: any) { lastErr = e?.message || 'network'; }
      if (!ok) await new Promise((res) => setTimeout(res, 1500 * (a + 1)));
    }
    if (!ok) throw new Error(lastErr || 'upload failed');
    onPct?.(Math.round(((i + 1) / total) * 100));
  }
  return id;
}
