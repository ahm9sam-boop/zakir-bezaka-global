import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

export type Job = { id: string; status: 'processing' | 'done' | 'error'; progress: number; stage: string; result?: any; error?: string; created: number };
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

async function whisper(file: string, key: string, lang?: string, prompt?: string): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const fd = new FormData();
    fd.append('file', new Blob([fs.readFileSync(file)], { type: 'audio/mpeg' }), 'audio.mp3');
    fd.append('model', 'whisper-large-v3-turbo');
    fd.append('response_format', 'json');
    fd.append('temperature', '0');
    if (lang) fd.append('language', lang);
    if (prompt) fd.append('prompt', prompt.slice(-200));
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
    if (r.ok) return ((await r.json()) as any).text || '';
    if (r.status === 429 || r.status >= 500) { const wait = Number(r.headers.get('retry-after')) || 20 * (attempt + 1); await new Promise(s => setTimeout(s, Math.min(wait, 70) * 1000)); continue; }
    throw new Error('whisper ' + r.status + ' ' + (await r.text()).slice(0, 200));
  }
  throw new Error('whisper rate limit');
}

export async function transcribeJob(job: Job, buf: Buffer, ext: string, opts: { lang?: string; key: string; summarize: (text: string) => Promise<{ summary: string; keyPoints: string[] }>; title: string }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr-'));
  try {
    const input = path.join(dir, 'in.' + (ext || 'bin'));
    fs.writeFileSync(input, buf);
    job.stage = 'convert'; job.progress = 5;
    const out = path.join(dir, 'out'); fs.mkdirSync(out);
    const chunks = await toChunks(input, out);
    if (!chunks.length) throw new Error('No audio track found');
    const parts: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      job.stage = 'transcribe'; job.progress = 10 + Math.round((i / chunks.length) * 75);
      parts.push((await whisper(chunks[i], opts.key, opts.lang, parts[parts.length - 1])).trim());
    }
    const transcription = parts.filter(Boolean).join('\n\n');
    if (transcription.length < 5) throw new Error('No speech recognized in audio');
    job.stage = 'summarize'; job.progress = 90;
    let s = { summary: '', keyPoints: [] as string[] };
    try { s = await opts.summarize(transcription); } catch (e) { console.warn('summary failed', (e as any)?.message); }
    job.result = { title: opts.title, transcription, summary: s.summary, keyPoints: s.keyPoints, isAiGenerated: true, engine: 'Whisper large-v3-turbo', durationEstimate: `${chunks.length * 10} min max` };
    job.status = 'done'; job.progress = 100;
  } catch (e: any) {
    job.status = 'error'; job.error = String(e?.message || e).slice(0, 300);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
