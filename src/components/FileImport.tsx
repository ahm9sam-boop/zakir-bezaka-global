import { uploadFile } from '../utils/uploadChunks';
import React, { useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const L: Record<string, { btn: string; busy: string; fail: string; big: string }> = {
  ar: { btn: 'رفع ملف (PDF / صورة / Word / نص / صوت / فيديو)', busy: 'جاري قراءة الملف...', fail: 'تعذّرت قراءة الملف', big: 'الملف كبير جداً (الحد 90 ميجا)' },
  en: { btn: 'Upload file (PDF / image / Word / text / audio / video)', busy: 'Reading file...', fail: 'Could not read the file', big: 'File too large (90 MB max)' },
};

async function readDocx(f: File): Promise<string> {
  const buf = new Uint8Array(await f.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let i = buf.length - 22;
  while (i > 0 && dv.getUint32(i, true) !== 0x06054b50) i--;
  let p = dv.getUint32(i + 16, true);
  const n = dv.getUint16(i + 10, true);
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.slice(p + 46, p + 46 + nl));
    if (name === 'word/document.xml') {
      const lnl = dv.getUint16(off + 26, true), lel = dv.getUint16(off + 28, true);
      const data = buf.slice(off + 30 + lnl + lel, off + 30 + lnl + lel + csize);
      let xml: string;
      if (method === 0) xml = new TextDecoder().decode(data);
      else { const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')); xml = await new Response(ds).text(); }
      return xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    }
    p += 46 + nl + el + cl;
  }
  throw new Error('docx');
}

async function readPdf(f: File): Promise<string> {
  const lib = (window as any).pdfjsLib; if (!lib) throw new Error('pdf');
  const doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
  let out = '';
  for (let i = 1; i <= Math.min(doc.numPages, 200); i++) { const pg = await doc.getPage(i); const c = await pg.getTextContent(); out += c.items.map((x: any) => x.str).join(' ') + '\n'; }
  return out;
}

async function readImage(f: File): Promise<string> {
  if (!(window as any).Tesseract) await new Promise<void>((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; s.onload = () => res(); s.onerror = () => rej(new Error('ocr')); document.head.appendChild(s); });
  return (await (window as any).Tesseract.recognize(f, 'ara+eng')).data.text;
}

async function readMedia(f: File, lang: string): Promise<string> {
  const post = async (u: string, body?: any) => { const r = await fetch(u, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined); return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) }; };
  const id = await uploadFile(f);
  const s = await post('/api/transcribe-file', { uploadId: id, title: f.name, language: lang });
  if (!s.ok) throw new Error(s.j.error || 'x');
  for (;;) {
    await new Promise(r => setTimeout(r, 3000));
    const st = await post('/api/transcribe-status/' + s.j.jobId);
    if (!st.ok || st.j.status === 'error') throw new Error(st.j.error || 'x');
    if (st.j.status === 'done') return st.j.result.transcription;
  }
}

export const FileImport: React.FC<{ onText: (t: string) => void; className?: string }> = ({ onText, className }) => {
  const { lang } = useLanguage() as any;
  const t = lang === 'ar' ? L.ar : L.en;
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const go = async (f?: File | null) => {
    if (!f) return; setErr('');
    if (f.size > 2 * 1024 * 1024 * 1024) { setErr(t.big); return; }
    setBusy(true);
    try {
      const n = f.name.toLowerCase(); let text = '';
      if (f.type.startsWith('audio/') || f.type.startsWith('video/') || /\.(mp3|m4a|wav|ogg|opus|aac|webm|mp4|mkv|mov)$/.test(n)) text = await readMedia(f, lang);
      else if (f.type.startsWith('image/')) text = await readImage(f);
      else if (n.endsWith('.pdf')) text = await readPdf(f);
      else if (n.endsWith('.docx')) text = await readDocx(f);
      else text = await f.text();
      if (!text.trim()) throw new Error('empty');
      onText(text.trim());
    } catch (e: any) { setErr(`${t.fail}${e?.message && e.message.length < 80 ? ': ' + e.message : ''}`); }
    finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  };
  return (
    <div className={className}>
      <input ref={ref} type="file" className="hidden" accept="audio/*,video/*,image/*,.pdf,.docx,.txt,.md,.csv" onChange={e => go(e.target.files?.[0])} />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50">
        {busy ? t.busy : '📎 ' + t.btn}
      </button>
      {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
    </div>
  );
};
