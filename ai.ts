// Multi-provider AI layer. Same call shape as the Gemini SDK: ai.models.generateContent({contents, config})
// Order: Gemini keys -> Groq -> OpenRouter -> Pollinations (keyless, slow but free). Identical prompts are cached.
import crypto from 'crypto';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

const geminiKeys = (): string[] =>
  [process.env.GEMINI_API_KEY, ...(process.env.GEMINI_API_KEYS || '').split(',')]
    .map((k) => (k || '').trim())
    .filter((k) => k && k !== 'MY_GEMINI_API_KEY');

const cache = new Map<string, { t: number; text: string }>();
const CACHE_MS = 30 * 60 * 1000;

function partsToText(parts: any[]): string {
  return parts.map((p) => (typeof p === 'string' ? p : p?.text || '')).filter(Boolean).join('\n\n');
}

function normalize(contents: any): { msgs: Msg[]; hasAudio: boolean } {
  const msgs: Msg[] = [];
  let hasAudio = false;
  if (typeof contents === 'string') return { msgs: [{ role: 'user', content: contents }], hasAudio };
  const list = Array.isArray(contents) ? contents : contents?.parts ? [{ role: 'user', parts: contents.parts }] : [];
  for (const c of list) {
    const parts = c.parts || [];
    if (parts.some((p: any) => p?.inlineData)) hasAudio = true;
    msgs.push({ role: c.role === 'model' ? 'assistant' : 'user', content: partsToText(parts) });
  }
  return { msgs, hasAudio };
}

async function timed(url: string, init: any, ms: number) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function viaGemini(req: any, key: string, model: string): Promise<string> {
  const { contents, config = {} } = req;
  const list = typeof contents === 'string'
    ? [{ role: 'user', parts: [{ text: contents }] }]
    : Array.isArray(contents) ? contents : [{ role: 'user', parts: contents.parts }];
  const body: any = { contents: list, generationConfig: {} };
  if (config.systemInstruction) body.systemInstruction = { parts: [{ text: config.systemInstruction }] };
  if (config.responseMimeType) body.generationConfig.responseMimeType = config.responseMimeType;
  const r = await timed(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 40000);
  if (!r.ok) throw new Error(`gemini ${model} ${r.status}`);
  const j: any = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  if (!text) throw new Error('gemini empty');
  return text;
}

async function viaOpenAI(url: string, key: string | null, model: string, msgs: Msg[], json: boolean, ms = 40000): Promise<string> {
  const body: any = { model, messages: msgs };
  if (json) body.response_format = { type: 'json_object' };
  const headers: any = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;
  const r = await timed(url, { method: 'POST', headers, body: JSON.stringify(body) }, ms);
  if (!r.ok) throw new Error(`${model} ${r.status}`);
  const j: any = await r.json();
  const text = j?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('empty');
  return text;
}

// Pollinations allows ~1 free reply / 45s / IP, so calls are queued one by one.
let pollQueue: Promise<any> = Promise.resolve();
function viaPollinations(msgs: Msg[], json: boolean): Promise<string> {
  const run = async () => {
    for (let i = 0; i < 3; i++) {
      try {
        return await viaOpenAI('https://text.pollinations.ai/openai', null, 'openai', msgs, json, 60000);
      } catch (e: any) {
        if (i === 2) throw e;
        await new Promise((r) => setTimeout(r, 46000));
      }
    }
    throw new Error('pollinations failed');
  };
  const p = pollQueue.then(run, run);
  pollQueue = p.catch(() => null);
  return p;
}

async function generate(req: any): Promise<string> {
  const { msgs, hasAudio } = normalize(req.contents);
  const json = req.config?.responseMimeType === 'application/json';
  const sys = req.config?.systemInstruction as string | undefined;
  const full: Msg[] = sys ? [{ role: 'system', content: sys }, ...msgs] : msgs;
  const hash = crypto.createHash('sha1').update(JSON.stringify(full) + json).digest('hex');
  const hit = cache.get(hash);
  if (!hasAudio && hit && Date.now() - hit.t < CACHE_MS) return hit.text;

  const errors: string[] = [];
  const attempt = async (fn: () => Promise<string>) => {
    try { return await fn(); } catch (e: any) { errors.push(e?.message || String(e)); return ''; }
  };
  let text = '';
  for (const key of geminiKeys()) {
    for (const model of ['gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
      text = await attempt(() => viaGemini(req, key, model));
      if (text) break;
    }
    if (text) break;
  }
  if (!text && !hasAudio) {
    const groq = process.env.GROQ_API_KEY;
    if (groq) text = await attempt(() => viaOpenAI('https://api.groq.com/openai/v1/chat/completions', groq, 'llama-3.3-70b-versatile', full, json));
    const or = process.env.OPENROUTER_API_KEY;
    if (!text && or) text = await attempt(() => viaOpenAI('https://openrouter.ai/api/v1/chat/completions', or, 'meta-llama/llama-3.3-70b-instruct:free', full, json));
    if (!text) text = await attempt(() => viaPollinations(full, json));
  }
  if (!text) throw new Error('All AI providers failed: ' + errors.join(' | '));
  if (!hasAudio) cache.set(hash, { t: Date.now(), text });
  return text;
}

export function aiAvailable() {
  return true;
}

export function getAi() {
  return { models: { generateContent: async (req: any) => ({ text: await generate(req) }) } };
}
