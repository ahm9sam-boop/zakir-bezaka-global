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

async function ocrBlob(blob: Blob): Promise<string> {
  const b64: string = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(new Error('read')); fr.readAsDataURL(blob); });
  const r = await fetch('/api/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: b64, mimeType: blob.type || 'image/jpeg' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'تعذر قراءة النص من الصورة');
  return j.text || '';
}

async function shrinkImage(f: Blob, maxSide = 1800): Promise<Blob> {
  const bmp = await createImageBitmap(f);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('img'))), 'image/jpeg', 0.85));
}

async function readPdf(f: File): Promise<string> {
  const lib = (window as any).pdfjsLib; if (!lib) throw new Error('قارئ الـ PDF لسه بيتحمل. جرب تاني بعد ثواني.');
  const doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
  let out = '';
  for (let i = 1; i <= Math.min(doc.numPages, 200); i++) { const pg = await doc.getPage(i); const c = await pg.getTextContent(); out += c.items.map((x: any) => x.str).join(' ') + '\n'; }
  if (out.replace(/\s/g, '').length > 30) return out;
  // Scanned PDF: read the first pages as images
  let ocr = '';
  for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
    const pg = await doc.getPage(i); const vp = pg.getViewport({ scale: 1.6 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await pg.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise;
    const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('img'))), 'image/jpeg', 0.8));
    ocr += (await ocrBlob(blob)) + '\n';
  }
  return ocr;
}

async function readImage(f: File): Promise<string> {
  return await ocrBlob(await shrinkImage(f));
}

async function readMedia(f: File, lang: string): Promise<string> {
  const post = async (u: string, body?: any) => { const r = await fetch(u, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined); return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) }; };
  const id = await uploadFile(f);
  const s = await post('/api/transcribe-file', { uploadId: id, title: f.name, language: lang });
  if (!s.ok) throw new Error(s.j.error || 'x');
  for (;;) {
    await new Promise(r => setTimeout(r, 3000));
    const st = await post('/api/transcribe-status/' + s.j.jobId).catch(() => null);
    if (!st) continue;
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
      if (!text.trim()) throw new Error('مفيش نص واضح في الملف ده');
      onText(text.trim());
    } catch (e: any) { setErr(`${t.fail}${e?.message && e.message.length < 120 ? ': ' + e.message : ''}`); }
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
