import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { geminiKeys, geminiModels } from '../../ai';

export type Job = { id: string; status: 'processing' | 'done' | 'error'; progress: number; stage: string; result?: any; error?: string; created: number; note?: string };
export const jobs = new Map<string, Job>();

setInterval(() => { const now = Date.now(); for (const [k, j] of jobs) if (now - j.created > 3 * 3600e3) jobs.delete(k); }, 600e3).unref();

const run = (args: string[]) => new Promise<void>((resolve, reject) => {
  const p = spawn(ffmpegPath as string, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; p.stderr.on('data', d => { err = (err + d).slice(-600); });
  p.on('error', reject);
  p.on('close', c => (c === 0 ? resolve() : reject(new Error('ffmpeg failed: ' + err))));
});

export async function toChunks(input: string, dir: string, segSec = 600): Promise<string[]> {
  await run(['-y', '-i', input, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '32k', '-f', 'segment', '-segment_time', String(segSec), '-reset_timestamps', '1', path.join(dir, 'c%04d.mp3')]);
  return fs.readdirSync(dir).filter(f => /^c\d+\.mp3$/.test(f)).sort().map(f => path.join(dir, f));
}


// Gemini first (best quality), Groq Whisper stays as the fallback.
let geminiSkipUntil = 0;
async function geminiTranscribe(file: string, lang: string | undefined, prev: string | undefined): Promise<string> {
  if (Date.now() < geminiSkipUntil) throw new Error('gemini paused');
  const keys = geminiKeys();
  if (!keys.length) throw new Error('no gemini key');
  const b64 = fs.readFileSync(file).toString('base64');
  const prompt = `Transcribe this lecture audio word for word in the language that is spoken${lang ? ` (expected language code: ${lang})` : ''}. Keep Arabic dialect words as spoken. Output only the transcript text, no comments, no timestamps.${prev ? ' The previous part ended with: ' + prev.slice(-150) : ''}`;
  let last = '';
  for (const key of keys) {
    for (const model of (await geminiModels(key)).slice(0, 2)) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: 'audio/mp3', data: b64 } }] }], generationConfig: { temperature: 0 } }),
          signal: AbortSignal.timeout(90000),
        });
        if (!r.ok) { last = `gemini ${model} ${r.status}`; continue; }
        const j: any = await r.json();
        const t = (j?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').trim();
        if (t) return t;
        last = 'gemini empty';
      } catch (e: any) { last = 'gemini ' + (e?.message || 'error'); }
    }
  }
  geminiSkipUntil = Date.now() + 3 * 60e3;
  throw new Error(last || 'gemini failed');
}

async function whisper(file: string, key: string, lang: string | undefined, prompt: string | undefined, job?: Job): Promise<string> {
  const started = Date.now();
  for (let attempt = 0; attempt < 12; attempt++) {
    const fd = new FormData();
    fd.append('file', new Blob([fs.readFileSync(file)], { type: 'audio/mpeg' }), 'audio.mp3');
    fd.append('model', 'whisper-large-v3-turbo');
    fd.append('response_format', 'json');
    fd.append('temperature', '0');
    if (lang) fd.append('language', lang);
    if (prompt) fd.append('prompt', prompt.slice(-200));
    let r: Response | null = null;
    try { r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd, signal: AbortSignal.timeout(120000) }); } catch { r = null; }
    if (r && r.ok) { if (job) job.note = ''; return ((await r.json()) as any).text || ''; }
    if (!r || r.status === 429 || r.status >= 500) {
      // Free-tier limits: wait as long as the server asks (up to 15 min), keeping the user informed.
      const ra = r ? Number(r.headers.get('retry-after')) : 0;
      const wait = Math.min(Math.max(ra || 15 * (attempt + 1), 5), 900);
      if (Date.now() - started + wait * 1000 > 40 * 60 * 1000) throw new Error('whisper rate limit');
      if (job) { job.stage = 'wait'; job.note = `free limit, resuming in ~${Math.ceil(wait / 60)} min`; }
      await new Promise((s) => setTimeout(s, wait * 1000));
      if (job) job.stage = 'transcribe';
      continue;
    }
    throw new Error('whisper ' + r.status + ' ' + (await r.text()).slice(0, 200));
  }
  throw new Error('whisper rate limit');
}

export async function transcribeJob(job: Job, buf: Buffer | string, ext: string, opts: { lang?: string; key: string; summarize: (text: string) => Promise<{ summary: string; keyPoints: string[] }>; title: string }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr-'));
  try {
    let input: string;
    if (typeof buf === 'string') input = buf;
    else { input = path.join(dir, 'in.' + (ext || 'bin')); fs.writeFileSync(input, buf); }
    job.stage = 'convert'; job.progress = 5;
    const out = path.join(dir, 'out'); fs.mkdirSync(out);
    const chunks = await toChunks(input, out);
    if (!chunks.length) throw new Error('No audio track found');
    const parts: string[] = [];
    let usedGemini = 0, usedWhisper = 0;
    for (let i = 0; i < chunks.length; i++) {
      job.stage = 'transcribe'; job.progress = 10 + Math.round((i / chunks.length) * 75);
      let piece = '';
      try { piece = (await geminiTranscribe(chunks[i], opts.lang, parts[parts.length - 1])).trim(); usedGemini++; }
      catch (e: any) { console.warn('gemini transcribe fallback:', e?.message); piece = (await whisper(chunks[i], opts.key, opts.lang, parts[parts.length - 1], job)).trim(); usedWhisper++; }
      parts.push(piece);
    }
    const transcription = parts.filter(Boolean).join('\n\n');
    if (transcription.length < 5) throw new Error('No speech recognized in audio');
    job.stage = 'summarize'; job.progress = 90;
    let s = { summary: '', keyPoints: [] as string[] };
    try { s = await opts.summarize(transcription); } catch (e) { console.warn('summary failed', (e as any)?.message); }
    job.result = { title: opts.title, transcription, summary: s.summary, keyPoints: s.keyPoints, isAiGenerated: true, engine: usedGemini && usedWhisper ? 'Gemini + Whisper' : usedGemini ? 'Gemini' : 'Whisper large-v3-turbo', durationEstimate: `${chunks.length * 10} min max` };
    job.status = 'done'; job.progress = 100;
  } catch (e: any) {
    job.status = 'error'; job.error = String(e?.message || e).slice(0, 300);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    if (typeof buf === 'string') { try { fs.rmSync(path.dirname(buf), { recursive: true, force: true }); } catch {} }
  }
}
