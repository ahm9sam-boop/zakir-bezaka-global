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


// Google retires Gemini model names often: ask Google which flash models this key can use now, newest first.
let gmCache: { t: number; key: string; list: string[] } | null = null;
async function geminiModels(key: string): Promise<string[]> {
  if (gmCache && gmCache.key === key && Date.now() - gmCache.t < 3600e3) return gmCache.list;
  let list: string[] = [];
  try {
    const r = await timed(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${key}`, {}, 10000);
    if (r.ok) {
      const j: any = await r.json();
      const ver = (n: string) => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || '0');
      list = (j.models || [])
        .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m: any) => String(m.name || '').replace('models/', ''))
        .filter((n: string) => /^gemini-[\d.]+-flash/.test(n) && !/(image|tts|live|audio|embedding|exp|thinking|robotics|computer)/.test(n))
        .sort((a: string, b: string) => (ver(b) - ver(a)) || (/lite/.test(a) ? 1 : 0) - (/lite/.test(b) ? 1 : 0) || (/preview/.test(a) ? 1 : 0) - (/preview/.test(b) ? 1 : 0));
      list = list.slice(0, 4);
      console.log('gemini models:', list.join(','));
    }
  } catch (e: any) { console.warn('gemini model list failed', e?.message); }
  if (!list.length) list = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  gmCache = { t: Date.now(), key, list };
  return list;
}

async function viaGemini(req: any, key: string, model: string, ms = 40000): Promise<string> {
  const { contents, config = {} } = req;
  const list = typeof contents === 'string'
    ? [{ role: 'user', parts: [{ text: contents }] }]
    : Array.isArray(contents) ? contents : [{ role: 'user', parts: contents.parts }];
  const body: any = { contents: list, generationConfig: {} };
  if (config.systemInstruction) body.systemInstruction = { parts: [{ text: config.systemInstruction }] };
  if (config.responseMimeType) body.generationConfig.responseMimeType = config.responseMimeType;
  const r = await timed(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, ms);
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
  let r = await timed(url, { method: 'POST', headers, body: JSON.stringify(body) }, ms);
  if (!r.ok && json && r.status === 400) {
    // json_object mode rejects prompts that ask for a JSON array: retry as plain text, the server extracts the JSON.
    delete body.response_format;
    r = await timed(url, { method: 'POST', headers, body: JSON.stringify(body) }, ms);
  }
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


// Groq retires models often: ask Groq which chat models exist now and try the best ones first.
let groqCache: { t: number; list: string[] } | null = null;
async function groqModels(key: string): Promise<string[]> {
  if (groqCache && Date.now() - groqCache.t < 3600e3) return groqCache.list;
  const fallback = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
  try {
    const r = await timed('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` } }, 10000);
    if (!r.ok) throw new Error('models ' + r.status);
    const j: any = await r.json();
    const ids: string[] = (j.data || []).filter((m: any) => m.active !== false).map((m: any) => m.id as string)
      .filter((id: string) => !/whisper|tts|guard|distil|playai|orpheus|embed|safeguard|compound/i.test(id));
    const rank = (id: string) => {
      const order = [/llama-3\.3-70b/, /gpt-oss-120b/, /llama-4-maverick/, /qwen.*(32b|3)/, /llama-4-scout/, /gpt-oss-20b/, /llama-3\.1-8b/];
      const i = order.findIndex((re) => re.test(id)); return i < 0 ? 99 : i;
    };
    const list = ids.sort((a, b) => rank(a) - rank(b)).slice(0, 4);
    if (!list.length) throw new Error('no models');
    groqCache = { t: Date.now(), list };
    console.log('groq models:', list.join(','));
    return list;
  } catch (e: any) {
    console.warn('groq model list failed', e?.message);
    return fallback;
  }
}

let geminiDownUntil = 0;
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
  if (Date.now() > geminiDownUntil) {
    for (const key of geminiKeys()) {
      const ms = (await geminiModels(key)).slice(0, 2);
      for (const model of ms) {
        text = await attempt(() => viaGemini(req, key, model, 12000));
        if (text) break;
      }
      if (text) break;
    }
    // Gemini failed: skip it for 3 minutes so answers come fast from Groq, then try Gemini again
    if (!text && geminiKeys().length) geminiDownUntil = Date.now() + 3 * 60e3;
  }
  if (!text && !hasAudio) {
    for (const groq of (process.env.GROQ_API_KEY || '').split(',').map((x) => x.trim()).filter(Boolean)) {
      for (const gm of await groqModels(groq)) {
        text = await attempt(() => viaOpenAI('https://api.groq.com/openai/v1/chat/completions', groq, gm, full, json));
        if (text) break;
      }
      if (text) break;
    }
    const keys = (n: string) => (process.env[n] || '').split(',').map((x) => x.trim()).filter(Boolean);
    const extra: [string, string[], string[]][] = [
      ['https://api.cerebras.ai/v1/chat/completions', keys('CEREBRAS_API_KEY'), ['llama-3.3-70b', 'llama3.1-8b']],
      ['https://api.mistral.ai/v1/chat/completions', keys('MISTRAL_API_KEY'), ['mistral-small-latest', 'open-mistral-nemo']],
      ['https://router.huggingface.co/v1/chat/completions', keys('HF_API_KEY'), ['meta-llama/Llama-3.3-70B-Instruct', 'Qwen/Qwen2.5-72B-Instruct']],
      ['https://openrouter.ai/api/v1/chat/completions', keys('OPENROUTER_API_KEY'), ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free', 'mistralai/mistral-small-3.2-24b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free']],
    ];
    for (const [url, ks, models] of extra) {
      for (const k of ks) {
        for (const m of models) {
          if (text) break;
          text = await attempt(() => viaOpenAI(url, k, m, full, json, 30000));
        }
        if (text) break;
      }
      if (text) break;
    }
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

// Live check of the Gemini key (status code only, never the key). Cached for 5 minutes.
let gh: { t: number; v: string } | null = null;
export async function geminiHealth(): Promise<string> {
  const keys = geminiKeys();
  if (!keys.length) return 'no key';
  if (gh && Date.now() - gh.t < 2 * 60e3) return gh.v;
  const models = await geminiModels(keys[0]);
  const res = await Promise.all(models.map(async (m) => {
    const t0 = Date.now();
    try {
      const r = await timed(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${keys[0]}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }) }, 20000);
      if (r.ok) return `${m}: ok ${Date.now() - t0}ms`;
      const j: any = await r.json().catch(() => ({}));
      return `${m}: http ${r.status} ${String(j?.error?.status || '')}`;
    } catch (e: any) { return `${m}: ${e?.message || 'error'} ${Date.now() - t0}ms`; }
  }));
  const v = res.join(' | ');
  gh = { t: Date.now(), v };
  return v;
}
