import express from 'express';
import { createServer as createViteServer } from 'vite';
import { getAi } from './ai';
import { jobs, transcribeJob, Job } from './src/server/transcribe';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import crypto from 'crypto';
import { studentStore } from './src/server/studentStore';
import { addContact, listContacts, markContactRead, deleteContact } from './src/server/contacts';
import { ipLimit, quota, aiQueue, aiCache, queueStats } from './src/server/guard';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '120mb' }));
app.use(express.urlencoded({ extended: true, limit: '120mb' }));

const TEXT_MODEL = 'gemini-4-hydrogen';
const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe';

const SUPPORTED_LANGUAGES: Record<string, { name: string; trueLabel: string; falseLabel: string }> = {
  ar: { name: 'Arabic (العربية الفصحى)', trueLabel: 'صحيح', falseLabel: 'خطأ' },
  en: { name: 'English', trueLabel: 'True', falseLabel: 'False' },
  fr: { name: 'French (Français)', trueLabel: 'Vrai', falseLabel: 'Faux' },
  es: { name: 'Spanish (Español)', trueLabel: 'Verdadero', falseLabel: 'Falso' },
  de: { name: 'German (Deutsch)', trueLabel: 'Wahr', falseLabel: 'Falsch' },
  tr: { name: 'Turkish (Türkçe)', trueLabel: 'Doğru', falseLabel: 'Yanlış' },
  pt: { name: 'Portuguese (Português)', trueLabel: 'Verdadeiro', falseLabel: 'Falso' },
  id: { name: 'Indonesian (Bahasa Indonesia)', trueLabel: 'Benar', falseLabel: 'Salah' },
  hi: { name: 'Hindi (हिन्दी)', trueLabel: 'सही', falseLabel: 'गलत' },
  ru: { name: 'Russian (Русский)', trueLabel: 'Верно', falseLabel: 'Неверно' },
};

function resolveLang(lang?: string) {
  const code = (lang || 'en').toLowerCase().slice(0, 2);
  return {
    code: SUPPORTED_LANGUAGES[code] ? code : 'en',
    meta: SUPPORTED_LANGUAGES[code] || SUPPORTED_LANGUAGES.en,
  };
}

function getGeminiClient() {
  return getAi();
}

function extractJson(raw: string): any {
  const trimmed = (raw || '').trim();
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(fenced);
  } catch {
    const objMatch = fenced.match(/[\{\[][\s\S]*[\}\]]/);
    if (objMatch) {
      return JSON.parse(objMatch[0]);
    }
    throw new Error('Failed to parse JSON response from AI');
  }
}

function getErrorMessage(langCode: string, type: 'no_key' | 'ai_failed' | 'bad_input'): string {
  const msgs: Record<string, Record<string, string>> = {
    ar: {
      no_key: 'خدمة الذكاء الاصطناعي غير مهيأة حالياً. يرجى المحاولة لاحقاً.',
      ai_failed: 'تعذر إتمام الطلب عبر الذكاء الاصطناعي حالياً. يرجى المحاولة مرة أخرى.',
      bad_input: 'يرجى التحقق من المدخلات المطلوبة والمحاولة ثانية.',
    },
    en: {
      no_key: 'AI service is not configured on the server.',
      ai_failed: 'The AI service failed to process your request. Please try again.',
      bad_input: 'Please provide valid input and try again.',
    },
    fr: {
      no_key: "Le service d'IA n'est pas configuré sur le serveur.",
      ai_failed: "Échec du traitement par l'IA. Veuillez réessayer.",
      bad_input: 'Veuillez saisir des données valides.',
    },
    es: {
      no_key: 'El servicio de IA no está configurado en el servidor.',
      ai_failed: 'No se pudo procesar la solicitud con IA. Inténtalo de nuevo.',
      bad_input: 'Por favor, introduce datos válidos.',
    },
    de: {
      no_key: 'Der KI-Dienst ist auf dem Server nicht konfiguriert.',
      ai_failed: 'KI-Anfrage fehlgeschlagen. Bitte versuchen Sie es erneut.',
      bad_input: 'Bitte geben Sie gültige Daten ein.',
    },
    tr: {
      no_key: 'Yapay zeka servisi sunucuda yapılandırılmamış.',
      ai_failed: 'Yapay zeka isteği işlenemedi. Lütfen tekrar deneyin.',
      bad_input: 'Lütfen geçerli bir giriş yapın.',
    },
    pt: {
      no_key: 'O serviço de IA não está configurado no servidor.',
      ai_failed: 'Falha ao processar com IA. Tente novamente.',
      bad_input: 'Por favor, insira dados válidos.',
    },
    id: {
      no_key: 'Layanan AI belum dikonfigurasi di server.',
      ai_failed: 'Permintaan AI gagal diproses. Silakan coba lagi.',
      bad_input: 'Harap masukkan data yang valid.',
    },
    hi: {
      no_key: 'सर्वर पर AI सेवा कॉन्फ़िगर नहीं है।',
      ai_failed: 'AI अनुरोध संसाधित करने में विफल। कृपया पुनः प्रयास करें।',
      bad_input: 'कृपया मान्य जानकारी दर्ज करें।',
    },
    ru: {
      no_key: 'Сервис ИИ не настроен на сервере.',
      ai_failed: 'Не удалось обработать запрос ИИ. Попробуйте снова.',
      bad_input: 'Пожалуйста, введите корректные данные.',
    },
  };
  return (msgs[langCode] || msgs.en)[type];
}

// 1. Status API

// ---- API access control: signed tokens (students and admin). AI, upload and admin routes need one.
const TOKEN_SECRET = crypto.createHash('sha256').update('zk-v1|' + (process.env.TOKEN_SECRET || '') + '|' + (process.env.GROQ_API_KEY || '') + '|' + (process.env.GEMINI_API_KEY || '')).digest('hex');
const sig = (v: string) => crypto.createHmac('sha256', TOKEN_SECRET).update(v).digest('hex').slice(0, 40);
const studentToken = (phone: string) => 's.' + Buffer.from(phone).toString('base64url') + '.' + sig('s|' + phone);
const adminToken = () => 'a.' + sig('admin|' + studentStore.adminSeal());
const pubStudent = (x: any) => { if (!x) return x; const { passcode: _a, passhash: _b, ...r } = x; return r; };
const withToken = (st: any) => { if (!(st && st.phone)) return st; const { passcode: _pc, passhash: _ph, ...rest } = st; return { ...rest, token: studentToken(String(st.phone)) }; };
const safeEq = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
function authLevel(req: express.Request): 'admin' | 'student' | null {
  const h = String(req.headers.authorization || '');
  const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!t) return null;
  if (t.startsWith('a.')) return safeEq(t, adminToken()) ? 'admin' : null;
  const m = t.match(/^s\.([A-Za-z0-9_-]+)\.([a-f0-9]{40})$/);
  if (!m) return null;
  let phone = '';
  try { phone = Buffer.from(m[1], 'base64url').toString(); } catch { return null; }
  if (!safeEq(m[2], sig('s|' + phone))) return null;
  const st: any = studentStore.findStudentByPhone(phone);
  if (!st || st.status === 'blocked') return null;
  return 'student';
}
app.use('/api', (req, res, next) => {
  const p = req.path;
  if (p === '/status' || p === '/ads-config' || p === '/contact' || p.startsWith('/auth/')) return next();
  const lvl = authLevel(req);
  if (p.startsWith('/admin/')) return lvl === 'admin' ? next() : res.status(401).json({ error: 'Admin sign-in required.' });
  if (lvl) return next();
  return res.status(401).json({ error: 'Please sign in first.' });
});

// ---- Load protection: login throttling, per-student daily quotas, queue and cache for AI routes.
const phoneOf = (req: express.Request): any => {
  const h = String(req.headers.authorization || '');
  const m = h.startsWith('Bearer s.') ? h.slice(9).match(/^([A-Za-z0-9_-]+)\./) : null;
  if (!m) return null;
  try { return studentStore.findStudentByPhone(Buffer.from(m[1], 'base64url').toString()) || null; } catch { return null; }
};
const mark = (st: any) => studentStore.markDirty(st);
const statKey: Record<string, any> = { summarize: 'summaries', quiz: 'quizzes', flashcards: 'flashcards' };
app.use('/api/auth/student-login', ipLimit('login', 12, 60e3, 'محاولات كتير. استنى دقيقة وجرب تاني.'));
app.use('/api/auth/student-register', ipLimit('register', 10, 10 * 60e3, 'محاولات تسجيل كتير. استنى شوية وجرب تاني.'));
app.use('/api/auth/admin-login', ipLimit('admin', 8, 10 * 60e3, 'Too many attempts.'));
for (const k of ['chat', 'summarize', 'quiz', 'flashcards', 'mindmap']) {
  const mw: any[] = [ipLimit('ai', 90, 60e3, 'طلبات كتير في وقت قصير. استنى شوية.')];
  if (k !== 'chat') mw.push(aiCache(k, (req) => { const st = phoneOf(req); if (st && statKey[k]) studentStore.incrementStat(st.phone, statKey[k]); }));
  mw.push(quota(k, phoneOf, mark), aiQueue());
  app.post('/api/' + k, ...mw);
}
app.post('/api/transcribe-start', ipLimit('ai', 90, 60e3, 'طلبات كتير في وقت قصير.'), quota('transcribe', phoneOf, mark));
app.post('/api/transcribe', ipLimit('ai', 90, 60e3, 'طلبات كتير في وقت قصير.'), quota('transcribe', phoneOf, mark), aiQueue());
app.post('/api/transcribe-file', ipLimit('ai', 90, 60e3, 'طلبات كتير في وقت قصير.'), quota('transcribe', phoneOf, mark));
app.post('/api/youtube', ipLimit('ai', 90, 60e3, 'طلبات كتير في وقت قصير.'), quota('youtube', phoneOf, mark));

app.get('/api/status', (_req, res) => {
  const providers = { gemini: !!process.env.GEMINI_API_KEY, groq: !!process.env.GROQ_API_KEY, huggingface: !!process.env.HF_API_KEY, openrouter: !!process.env.OPENROUTER_API_KEY, fallback: 'pollinations' };
  const isKeyConfigured = true; // AI answers always have at least the free fallback
  res.json({
    status: 'online',
    appName: 'Zakir Smart / ذاكر بذكاء',
    hasGeminiKey: isKeyConfigured,
    providers,
    model: isKeyConfigured ? 'ai' : 'unavailable',
    transcribeModel: isKeyConfigured ? 'ai' : 'unavailable',
    version: '2.0.0',
    supportedLanguages: Object.keys(SUPPORTED_LANGUAGES),
    load: queueStats(),
  });
});

// 2. Chat API

// Speaker labels: estimated from the wording of the transcript (Whisper does not separate voices).
app.post('/api/speakers', ipLimit('ai', 30, 60e3, 'طلبات كتير. استنى شوية.'), aiQueue(), async (req, res) => {
  const text = String((req.body || {}).text || '');
  if (text.trim().length < 20) return res.status(400).json({ error: 'No text.' });
  if (text.length > 48000) return res.status(413).json({ error: 'Text is too long to label (max 48000 characters).' });
  const ai = getGeminiClient();
  if (!ai) return res.status(503).json({ error: 'AI unavailable' });
  try {
    const chunks: string[] = [];
    let rest = text;
    while (rest.length > 0) {
      if (rest.length <= 6000) { chunks.push(rest); break; }
      let cut = Math.max(rest.lastIndexOf('\n', 6000), rest.lastIndexOf('. ', 6000), rest.lastIndexOf('؟ ', 6000));
      if (cut < 2000) cut = 6000;
      chunks.push(rest.slice(0, cut + 1)); rest = rest.slice(cut + 1);
    }
    const outs: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const prompt = `Below is part ${i + 1} of ${chunks.length} of a speech-to-text transcript. Split it into turns and put a speaker label at the start of each turn, like "المتحدث 1:" / "المتحدث 2:" (use the transcript's language; if only one person seems to talk, use a single label). Decide changes of speaker only from the wording (questions and answers, greetings, thanks, direct address). Keep speaker numbering consistent with the previous part. Do NOT change, add, remove or fix any words. Output only the labeled transcript.${i > 0 ? '\nLast labeled text so far: ' + outs[i - 1].slice(-300) : ''}\n\nTranscript part:\n"""${chunks[i]}"""`;
      const response: any = await ai.models.generateContent({ model: TEXT_MODEL, contents: prompt });
      const out = String(response?.text || '').trim();
      if (!out) throw new Error('empty');
      outs.push(out);
    }
    return res.json({ text: outs.join('\n\n') });
  } catch (e: any) {
    console.error('speakers error:', e?.message || e);
    return res.status(502).json({ error: 'AI failed' });
  }
});

app.get('/ads.txt', (_req, res) => {
  const pub = String(process.env.ADSENSE_CLIENT || '').replace(/^ca-/, '');
  res.type('text/plain').send(/^pub-\d+$/.test(pub) ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : '');
});
app.get('/api/ads-config', (_req, res) => res.json({ client: process.env.ADSENSE_CLIENT || '', slot: process.env.ADSENSE_SLOT || '' }));

app.post('/api/youtube', async (req, res) => {
  try {
    const url = String(req.body?.url || '');
    const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
    if (!m) return res.status(400).json({ error: 'Invalid YouTube link' });
    const page = await (await fetch(`https://www.youtube.com/watch?v=${m[1]}&hl=en`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+1' } })).text();
    const mm = page.match(/"captionTracks":(\[.*?\])/);
    if (!mm) return res.status(404).json({ error: 'YouTube blocks automatic import from our servers for this video. Open the video, tap Show transcript, copy it and paste it here, or upload the audio file for transcription.' });
    const tracks = JSON.parse(mm[1]);
    const want = String(req.body?.language || 'en');
    const tr = tracks.find((t: any) => t.languageCode?.startsWith(want)) || tracks.find((t: any) => t.languageCode?.startsWith('en')) || tracks[0];
    const j: any = await (await fetch(tr.baseUrl + '&fmt=json3')).json();
    const text = (j.events || []).map((e: any) => (e.segs || []).map((s: any) => s.utf8).join('')).join(' ').replace(/\s+/g, ' ').trim();
    if (!text) return res.status(404).json({ error: 'Empty transcript' });
    return res.json({ text: text.slice(0, 40000), lang: tr.languageCode });
  } catch (e: any) {
    return res.status(502).json({ error: 'YouTube blocks automatic import from our servers. Open the video, tap Show transcript, copy it and paste it here, or upload the audio file for transcription.' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { messages, studyContext, language, studentPhone, profile } = req.body || {};
  const { code: langCode, meta: langMeta } = resolveLang(language);

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: getErrorMessage(langCode, 'bad_input') });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: getErrorMessage(langCode, 'no_key') });
  }

  try {
    // Split the student's material into numbered passages so answers can cite real passages.
    const ctxText = studyContext ? String(studyContext).slice(0, 20000) : '';
    const passages: string[] = [];
    if (ctxText) {
      let cur = '';
      for (const para of ctxText.split(/\n{1,}/)) {
        if ((cur + ' ' + para).length > 700 && cur) { passages.push(cur.trim()); cur = para; } else cur += (cur ? ' ' : '') + para;
      }
      if (cur.trim()) passages.push(cur.trim());
    }
    const numbered = passages.slice(0, 40).map((p, i) => `[${i + 1}] ${p}`).join('\n\n');
    const prof = profile && typeof profile === 'object'
      ? `\nStudent profile: level = ${String(profile.level || '').slice(0, 40)}; subjects = ${String(profile.subjects || '').slice(0, 120)}. Adapt depth and examples to this level.` : '';
    const systemPrompt = `You are the smart academic tutor inside the "Zakir Smart" study platform.
CRITICAL REQUIREMENT: Respond in ${langMeta.name}, unless the student's latest message is clearly written in another language, in which case answer in the student's own language.
Rules:
- Explain complex concepts step by step with clear, practical examples.
- Use clean bullet points and numbered steps when helpful.
- Encourage active recall and critical thinking.${prof}
${numbered ? `\nStudent's study material, split into numbered passages:\n"""${numbered}"""\nGround your answers in these passages. Whenever a statement comes from a passage, add its number in square brackets like [2] right after the statement. Never invent a passage number. If the answer is not in the material, say so clearly and then answer from general knowledge without any bracket numbers.` : ''}`;

    // Ensure conversation starts with a user turn and alternates cleanly
    const rawMapped = messages
      .filter((m: any) => m && typeof m.content === 'string' && m.content.trim().length > 0)
      .map((m: any) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.content.trim() }],
      }));

    const firstUserIdx = rawMapped.findIndex((m: any) => m.role === 'user');
    const validTurns = firstUserIdx >= 0 ? rawMapped.slice(firstUserIdx) : [];

    // Merge consecutive turns of the same role to guarantee strict user/model alternation
    const normalizedContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const turn of validTurns) {
      const prev = normalizedContents[normalizedContents.length - 1];
      if (prev && prev.role === turn.role) {
        prev.parts.push({ text: turn.parts[0].text });
      } else {
        normalizedContents.push({
          role: turn.role as 'user' | 'model',
          parts: [{ text: turn.parts[0].text }],
        });
      }
    }

    if (normalizedContents.length === 0) {
      return res.status(400).json({ error: getErrorMessage(langCode, 'bad_input') });
    }

    const chatPromise = ai.models.generateContent({
      model: TEXT_MODEL,
      contents: normalizedContents,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Chat generation timeout')), 110000)
    );

    const response: any = await Promise.race([chatPromise, timeoutPromise]);
    const reply = response?.text?.trim();

    if (!reply) {
      throw new Error('Empty AI reply');
    }

    if (studentPhone) {
      studentStore.logStudentActivity(studentPhone, {
        type: 'action',
        tool: 'assistant',
        title: 'AI Tutor Q&A',
        details: normalizedContents[normalizedContents.length - 1]?.parts[0]?.text?.slice(0, 80),
      });
    }

    const cited = Array.from(new Set<number>((reply.match(/\[(\d{1,2})\]/g) || []).map((m: string) => Number(m.slice(1, -1)))))
      .filter((n: number) => n >= 1 && n <= passages.length)
      .slice(0, 6)
      .map((n: number) => ({ n, text: passages[n - 1].slice(0, 400) }));
    return res.json({
      reply,
      sources: cited,
      source: 'AI Tutor',
      isLiveAi: true,
    });
  } catch (err: any) {
    console.error('Gemini Chat error:', err?.message || err);
    return res.status(502).json({
      error: getErrorMessage(langCode, 'ai_failed'),
    });
  }
});

// 3. Summarize API
app.post('/api/summarize', async (req, res) => {
  const { text, style = 'balanced', length = 'medium', language, studentPhone } = req.body || {};
  const { code: langCode, meta: langMeta } = resolveLang(language);

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: getErrorMessage(langCode, 'bad_input') });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: getErrorMessage(langCode, 'no_key') });
  }

  try {
    const prompt = `You are an expert academic summarizer.
CRITICAL REQUIREMENT: Write ALL JSON values strictly in ${langMeta.name}.
Style: ${style === 'bullets' ? 'concise focused bullet points' : style === 'comprehensive' ? 'comprehensive and thorough' : 'balanced and exam-ready'}.
Target length: ${length}.

Source study material:
"""${text.slice(0, 30000)}"""

Return ONLY valid JSON matching this schema:
{
  "title": "Clear descriptive title",
  "overview": "1-2 paragraph executive summary",
  "mainPoints": ["Key point 1", "Key point 2", "Key point 3", "Key point 4"],
  "definitions": [
    {"term": "Key Term 1", "definition": "Clear definition"},
    {"term": "Key Term 2", "definition": "Clear definition"}
  ],
  "examTips": ["High-yield exam tip 1", "High-yield exam tip 2"]
}`;

    const aiPromise = ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Summarize timeout')), 110000)
    );

    const response: any = await Promise.race([aiPromise, timeoutPromise]);
    const parsed = extractJson(response?.text || '');

    if (studentPhone) {
      studentStore.incrementStat(studentPhone, 'summaries');
    }

    return res.json({
      title: parsed.title || 'Study Summary',
      overview: parsed.overview || '',
      mainPoints: Array.isArray(parsed.mainPoints) ? parsed.mainPoints : [],
      definitions: Array.isArray(parsed.definitions) ? parsed.definitions : [],
      examTips: Array.isArray(parsed.examTips) ? parsed.examTips : [],
      isAiGenerated: true,
      engine: 'AI Tutor',
    });
  } catch (err: any) {
    console.error('Gemini Summarize error:', err?.message || err);
    return res.status(502).json({ error: getErrorMessage(langCode, 'ai_failed') });
  }
});

// OCR for images and scanned PDF pages (Groq vision, free tier)
app.post('/api/ocr', ipLimit('ocr', 40, 10 * 60e3, 'Too many requests.'), async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};
  const keys = (process.env.GROQ_API_KEY || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!imageBase64 || typeof imageBase64 !== 'string') return res.status(400).json({ error: 'No image' });
  if (!keys.length) return res.status(503).json({ error: 'OCR is not configured on the server.' });
  const models = ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'];
  let lastErr = '';
  for (const key of keys) for (const model of models) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0, max_tokens: 4000, messages: [{ role: 'user', content: [
          { type: 'text', text: 'Extract ALL the text in this image exactly as written (Arabic or English), keep the reading order. Output only the text, no comments. If there is no text, output nothing.' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } } ] }] }),
        signal: AbortSignal.timeout(60000),
      });
      const j: any = await r.json().catch(() => ({}));
      if (r.ok) return res.json({ text: String(j?.choices?.[0]?.message?.content || '').trim() });
      lastErr = j?.error?.message || 'status ' + r.status;
    } catch (e: any) { lastErr = e?.message || 'network'; }
  }
  console.error('ocr failed', lastErr);
  return res.status(502).json({ error: 'تعذر استخراج النص من الصورة دلوقتي.' });
});

// 4. Quiz Generator API
app.post('/api/quiz', async (req, res) => {
  const { topicOrText, count = 4, difficulty = 'medium', type = 'mixed', language, studentPhone } = req.body || {};
  const { code: langCode, meta: langMeta } = resolveLang(language);

  if (!topicOrText || typeof topicOrText !== 'string' || topicOrText.trim().length === 0) {
    return res.status(400).json({ error: getErrorMessage(langCode, 'bad_input') });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: getErrorMessage(langCode, 'no_key') });
  }

  try {
    const safeCount = Math.min(12, Math.max(2, Number(count) || 4));
    const typeRule =
      type === 'mcq'
        ? 'multiple choice questions ONLY ("type": "mcq" with 4 distinct options)'
        : type === 'true_false'
        ? `True/False questions ONLY ("type": "true_false" with options strictly ["${langMeta.trueLabel}", "${langMeta.falseLabel}"])`
        : `a mix of multiple choice ("type": "mcq") and true/false ("type": "true_false" with options ["${langMeta.trueLabel}", "${langMeta.falseLabel}"])`;

    const prompt = `You are an expert academic assessment creator.
CRITICAL REQUIREMENT: Write ALL questions, options, answers, and explanations strictly in ${langMeta.name}.
Study topic or text:
"""${topicOrText.slice(0, 110000)}"""

Requirements:
- Exact number of questions: ${safeCount}
- Difficulty: ${difficulty}
- Question format: ${typeRule}
- "correctAnswer" MUST match one element of "options" character-for-character.
- Provide a clear educational explanation for every question.

Return ONLY a valid JSON array:
[
  {
    "id": "q-1",
    "question": "Question text?",
    "type": "mcq",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "Why Option A is correct"
  }
]`;

    const aiPromise = ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Quiz timeout')), 110000)
    );

    const response: any = await Promise.race([aiPromise, timeoutPromise]);
    const parsed = extractJson(response?.text || '[]');
    const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);

    if (questions.length === 0) {
      throw new Error('No questions returned');
    }

    if (studentPhone) {
      studentStore.incrementStat(studentPhone, 'quizzes');
    }

    return res.json({
      questions: questions.map((q: any, idx: number) => ({
        id: q.id || `q-${Date.now()}-${idx}`,
        question: q.question || '',
        type: q.type === 'true_false' ? 'true_false' : 'mcq',
        options: Array.isArray(q.options) ? q.options : [langMeta.trueLabel, langMeta.falseLabel],
        correctAnswer: q.correctAnswer || (Array.isArray(q.options) ? q.options[0] : ''),
        explanation: q.explanation || '',
      })),
      isAiGenerated: true,
      engine: 'AI Tutor',
    });
  } catch (err: any) {
    console.error('Gemini Quiz error:', err?.message || err);
    return res.status(502).json({ error: getErrorMessage(langCode, 'ai_failed') });
  }
});

// 5. Flashcards API
app.post('/api/flashcards', async (req, res) => {
  const { topicOrText, count = 5, language, studentPhone } = req.body || {};
  const { code: langCode, meta: langMeta } = resolveLang(language);

  if (!topicOrText || typeof topicOrText !== 'string' || topicOrText.trim().length === 0) {
    return res.status(400).json({ error: getErrorMessage(langCode, 'bad_input') });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: getErrorMessage(langCode, 'no_key') });
  }

  try {
    const safeCount = Math.min(12, Math.max(3, Number(count) || 5));
    const prompt = `Create ${safeCount} high-yield active-recall flashcards strictly in ${langMeta.name} for the following material:
"""${topicOrText.slice(0, 20000)}"""

Return ONLY a valid JSON array:
[
  {
    "id": "fc-1",
    "front": "Prompt, term, or question",
    "back": "Concise, accurate answer",
    "category": "Subtopic name",
    "difficulty": "easy"
  }
]`;

    const aiPromise = ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Flashcards timeout')), 110000)
    );

    const response: any = await Promise.race([aiPromise, timeoutPromise]);
    const parsed = extractJson(response?.text || '[]');
    const cards = Array.isArray(parsed) ? parsed : (parsed.cards || []);

    if (studentPhone) {
      studentStore.incrementStat(studentPhone, 'flashcards');
    }

    return res.json({
      cards: cards.map((c: any, idx: number) => ({
        id: c.id || `fc-${Date.now()}-${idx}`,
        front: c.front || '',
        back: c.back || '',
        category: c.category || 'Study',
        difficulty: ['easy', 'medium', 'hard'].includes(c.difficulty) ? c.difficulty : 'medium',
        mastered: false,
      })),
      isAiGenerated: true,
      engine: 'AI Tutor',
    });
  } catch (err: any) {
    console.error('Gemini Flashcards error:', err?.message || err);
    return res.status(502).json({ error: getErrorMessage(langCode, 'ai_failed') });
  }
});

// 6. Mind Map API
app.post('/api/mindmap', async (req, res) => {
  const { topicOrText, language } = req.body || {};
  const { code: langCode, meta: langMeta } = resolveLang(language);

  if (!topicOrText || typeof topicOrText !== 'string' || topicOrText.trim().length === 0) {
    return res.status(400).json({ error: getErrorMessage(langCode, 'bad_input') });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: getErrorMessage(langCode, 'no_key') });
  }

  try {
    const prompt = `You are a knowledge architecture expert.
CRITICAL REQUIREMENT: Write ALL labels and descriptions strictly in ${langMeta.name}.
Build a structured hierarchical mind map for:
"""${topicOrText.slice(0, 15000)}"""

Requirements:
- 1 central root node
- 3 primary branches
- 2 to 3 sub-branches per primary branch

Return ONLY valid JSON:
{
  "id": "root",
  "label": "Main Topic",
  "description": "Concise overview of main topic",
  "children": [
    {
      "id": "node-1",
      "label": "Branch 1",
      "description": "Short explanation",
      "children": [
        {"id": "node-1-1", "label": "Subtopic 1", "description": "Short note"},
        {"id": "node-1-2", "label": "Subtopic 2", "description": "Short note"}
      ]
    }
  ]
}`;

    const aiPromise = ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('MindMap timeout')), 110000)
    );

    const response: any = await Promise.race([aiPromise, timeoutPromise]);
    const parsed = extractJson(response?.text || '{}');

    return res.json({
      tree: parsed,
      isAiGenerated: true,
      engine: 'AI Tutor',
    });
  } catch (err: any) {
    console.error('Gemini MindMap error:', err?.message || err);
    return res.status(502).json({ error: getErrorMessage(langCode, 'ai_failed') });
  }
});

// 7. Audio / Lecture Transcription API
app.post('/api/transcribe-start', async (req, res) => {
  const { audioBase64, mimeType = '', title = 'Lecture Recording', language, fileName = '' } = req.body || {};
  const { code: langCode, meta: langMeta } = resolveLang(language);
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(501).json({ error: 'no-groq' });
  if (!audioBase64) return res.status(400).json({ error: getErrorMessage(langCode, 'bad_input') });
  const ext = (String(fileName).split('.').pop() || String(mimeType).split('/').pop() || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5);
  const job: Job = { id: 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), status: 'processing', progress: 1, stage: 'upload', created: Date.now() };
  jobs.set(job.id, job);
  const buf = Buffer.from(String(audioBase64), 'base64');
  const hint = req.body?.audioLang && req.body.audioLang !== 'auto' ? String(req.body.audioLang) : undefined;
  transcribeJob(job, buf, ext, {
    key, lang: hint, title,
    summarize: async (text: string) => {
      const ai = getGeminiClient(); if (!ai) throw new Error('no ai');
      const body = text.length > 30000 ? text.slice(0, 20000) + '\n...\n' + text.slice(-9000) : text;
      const r: any = await ai.models.generateContent({ model: TEXT_MODEL, contents: `Summarize this lecture transcript strictly in ${langMeta.name}. Respond ONLY with JSON {"summary":"concise academic summary","keyPoints":["5-8 key exam points"]}.\n"""${body}"""`, config: { responseMimeType: 'application/json' } });
      const j = extractJson(r?.text || '{}'); return { summary: j.summary || '', keyPoints: Array.isArray(j.keyPoints) ? j.keyPoints : [] };
    },
  });
  return res.json({ jobId: job.id });
});

// Chunked upload for long recordings (1-2 h): pieces are appended to a temp file, then transcribed as one job.
const UP_ROOT = path.join(os.tmpdir(), 'zk-uploads');
const MAX_UPLOAD = 2 * 1024 * 1024 * 1024;
const upState = new Map<string, { next: number; size: number; t: number }>();
setInterval(() => { const now = Date.now(); for (const [k, v] of upState) if (now - v.t > 3 * 3600e3) { upState.delete(k); try { fs.rmSync(path.join(UP_ROOT, k), { recursive: true, force: true }); } catch {} } }, 600e3).unref();
app.post('/api/upload/:id', express.raw({ type: '*/*', limit: '16mb' }), (req, res) => {
  const id = String(req.params.id);
  if (!/^u[a-z0-9]{8,40}$/.test(id)) return res.status(400).json({ error: 'bad id' });
  const i = Number(req.query.i);
  if (!Number.isInteger(i) || i < 0 || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'bad chunk' });
  const dir = path.join(UP_ROOT, id);
  const st = upState.get(id) || { next: 0, size: 0, t: Date.now() };
  if (i < st.next) return res.json({ ok: true, dup: true });
  if (i > st.next) return res.status(409).json({ error: 'out of order' });
  if (st.size + req.body.length > MAX_UPLOAD) return res.status(413).json({ error: 'File too large (max 2 GB).' });
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'data'), req.body);
  } catch { return res.status(500).json({ error: 'disk error' }); }
  st.next = i + 1; st.size += req.body.length; st.t = Date.now(); upState.set(id, st);
  return res.json({ ok: true });
});

app.post('/api/transcribe-file', async (req, res) => {
  const { uploadId, title = 'Lecture Recording', language, audioLang } = req.body || {};
  const { code: langCode, meta: langMeta } = resolveLang(language);
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(501).json({ error: 'no-groq' });
  if (!/^u[a-z0-9]{8,40}$/.test(String(uploadId))) return res.status(400).json({ error: getErrorMessage(langCode, 'bad_input') });
  const file = path.join(UP_ROOT, String(uploadId), 'data');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Upload not found. Please upload again.' });
  upState.delete(String(uploadId));
  const job: Job = { id: 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), status: 'processing', progress: 1, stage: 'convert', created: Date.now() };
  jobs.set(job.id, job);
  const hint = audioLang && audioLang !== 'auto' ? String(audioLang) : undefined;
  transcribeJob(job, file, 'bin', {
    key, lang: hint, title: String(title).slice(0, 200),
    summarize: async (text: string) => {
      const ai = getGeminiClient(); if (!ai) throw new Error('no ai');
      const body = text.length > 30000 ? text.slice(0, 20000) + '\n...\n' + text.slice(-9000) : text;
      const r: any = await ai.models.generateContent({ model: TEXT_MODEL, contents: `Summarize this lecture transcript strictly in ${langMeta.name}. Respond ONLY with JSON {"summary":"concise academic summary","keyPoints":["5-8 key exam points"]}.\n"""${body}"""`, config: { responseMimeType: 'application/json' } });
      const j = extractJson(r?.text || '{}'); return { summary: j.summary || '', keyPoints: Array.isArray(j.keyPoints) ? j.keyPoints : [] };
    },
  });
  return res.json({ jobId: job.id });
});

app.get('/api/transcribe-status/:id', (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: 'Job not found (server restarted?). Try again.' });
  return res.json({ status: j.status, progress: j.progress, stage: j.stage, note: j.note, result: j.result, error: j.error });
});

app.post('/api/transcribe', async (req, res) => {
  const { audioBase64, mimeType = 'audio/mp3', title = 'Lecture Recording', studentPhone, language } = req.body || {};
  const { code: langCode, meta: langMeta } = resolveLang(language);

  if (!audioBase64) {
    return res.status(400).json({ error: getErrorMessage(langCode, 'bad_input') });
  }

  if (studentPhone) {
    const activeStudent = studentStore.findStudentByPhone(studentPhone);
    if (activeStudent && activeStudent.status !== 'active') {
      return res.status(403).json({
        error: 'Account is suspended or pending approval.',
      });
    }
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: getErrorMessage(langCode, 'no_key') });
  }

  let resolvedMime = (mimeType || 'audio/mp3').toLowerCase();
  if (resolvedMime.includes('mp3') || resolvedMime.includes('mpeg')) resolvedMime = 'audio/mp3';
  else if (resolvedMime.includes('wav')) resolvedMime = 'audio/wav';
  else if (resolvedMime.includes('m4a') || resolvedMime.includes('x-m4a')) resolvedMime = 'audio/aac';
  else if (resolvedMime.includes('mp4')) resolvedMime = 'audio/mp4';
  else if (resolvedMime.includes('ogg')) resolvedMime = 'audio/ogg';
  else if (resolvedMime.includes('aac')) resolvedMime = 'audio/aac';
  else if (resolvedMime.includes('webm')) resolvedMime = 'audio/webm';
  else if (resolvedMime.includes('flac')) resolvedMime = 'audio/flac';
  else resolvedMime = 'audio/mp3';

  const audioPart = {
    inlineData: {
      mimeType: resolvedMime,
      data: audioBase64,
    },
  };

  const promptText = `You are an expert academic transcription and lecture summarization assistant.
Listen carefully to the audio recording.
1. Transcribe the spoken lecture cleanly into well-structured paragraphs.
2. Provide a concise academic summary and 3-5 key exam points strictly in ${langMeta.name}.
Respond ONLY with valid JSON:
{
  "transcription": "Full accurate transcript",
  "summary": "Concise summary in ${langMeta.name}",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
}`;

  try {
    let fullText = '';
    let summaryText = '';
    let keyPoints: string[] = [];
    let usedEngine = 'AI Transcribe';

    try {
      const transcribePromise = ai.models.generateContent({
        model: TRANSCRIBE_MODEL,
        contents: {
          parts: [audioPart, { text: promptText }],
        },
        config: {
          responseMimeType: 'application/json',
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Transcription timeout')), 110000)
      );

      const response: any = await Promise.race([transcribePromise, timeoutPromise]);
      const textOut = response?.text?.trim() || '';
      try {
        const parsed = extractJson(textOut);
        fullText = parsed.transcription || textOut;
        summaryText = parsed.summary || '';
        keyPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [];
      } catch {
        fullText = textOut;
      }
    } catch (err1: any) {
      console.warn('Gemini 3.5 Transcribe fallback to gemini-4-hydrogen:', err1?.message || err1);
      usedEngine = 'AI Tutor';
      const flashPromise = ai.models.generateContent({
        model: TEXT_MODEL,
        contents: {
          parts: [audioPart, { text: promptText }],
        },
        config: {
          responseMimeType: 'application/json',
        },
      });
      const flashTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Flash transcribe timeout')), 30000)
      );
      const flashRes: any = await Promise.race([flashPromise, flashTimeout]);
      const rawOut = flashRes?.text?.trim() || '';
      try {
        const parsed = extractJson(rawOut);
        fullText = parsed.transcription || rawOut;
        summaryText = parsed.summary || '';
        keyPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [];
      } catch {
        fullText = rawOut;
      }
    }

    if (!fullText || fullText.trim().length < 5) {
      throw new Error('No speech recognized in audio');
    }

    if (studentPhone) {
      studentStore.incrementStat(studentPhone, 'transcriptions');
    }

    return res.json({
      title: title || 'Lecture Transcription',
      transcription: fullText,
      summary: summaryText,
      keyPoints,
      isAiGenerated: true,
      engine: usedEngine,
      durationEstimate: 'OK',
    });
  } catch (err: any) {
    console.error('Transcribe error:', err?.message || err);
    return res.status(502).json({ error: getErrorMessage(langCode, 'ai_failed') });
  }
});

// ==========================================
// 8. Contact Feedback Endpoint
// ==========================================
app.post('/api/contact', ipLimit('contact', 6, 10 * 60e3, 'رسائل كتير. استنى شوية وابعت تاني.'), async (req, res) => {
  try {
    const { name, phone, subject, message } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const st: any = phoneOf(req);
    await addContact({
      name: String(name || st?.name || '').trim().slice(0, 120),
      phone: String(phone || st?.phone || '').trim().slice(0, 40),
      subject: String(subject || 'General').trim().slice(0, 120),
      message: message.trim().slice(0, 4000),
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('Contact save error:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

app.get('/api/admin/messages', async (_req, res) => {
  try { return res.json({ messages: await listContacts() }); } catch (e: any) { return res.status(500).json({ error: 'Could not load messages' }); }
});
app.post('/api/admin/messages/:id/read', async (req, res) => {
  try { await markContactRead(String(req.params.id)); return res.json({ success: true }); } catch { return res.status(500).json({ error: 'failed' }); }
});
app.delete('/api/admin/messages/:id', async (req, res) => {
  try { await deleteContact(String(req.params.id)); return res.json({ success: true }); } catch { return res.status(500).json({ error: 'failed' }); }
});

// ==========================================
// 9. Student & Admin Access Management APIs
// ==========================================

app.post('/api/auth/student-register', (req, res) => {
  try {
    const { name, phone, passcode, googleAccount } = req.body || {};
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Invalid student name (minimum 2 characters).' });
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length < 6) {
      return res.status(400).json({ error: 'Invalid phone number (minimum 6 digits).' });
    }
    if (!passcode || typeof passcode !== 'string' || passcode.trim().length < 3) {
      return res.status(400).json({ error: 'Passcode must be at least 3 characters.' });
    }

    const { student, isNew, conflict } = studentStore.registerStudent(
      name,
      phone,
      passcode,
      googleAccount
    );

    if (conflict) {
      return res.status(409).json({
        success: false,
        error: 'رقم الهاتف ده مسجل قبل كده. سجّل دخول بالرقم السري بتاعك بدل إنشاء حساب جديد.',
      });
    }
    if (student.status === 'blocked') {
      return res.status(403).json({
        success: false,
        status: 'blocked',
        error: 'This account has been suspended by an administrator.',
      });
    }

    return res.json({
      success: true,
      status: student.status,
      student: withToken(student),
      isNew,
    });
  } catch (err: any) {
    console.error('Student register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/student-login', (req, res) => {
  try {
    const { identifier, name, phone, passcode } = req.body || {};
    const loginIdentifier = (identifier || phone || name || '').toString().trim();
    const loginPasscode = (passcode || '').toString().trim();

    if (!loginIdentifier || loginIdentifier.length < 2) {
      return res.status(400).json({ error: 'Name or phone number is required.' });
    }
    if (!loginPasscode) {
      return res.status(400).json({ error: 'Passcode is required.' });
    }

    const result = studentStore.loginStudent(loginIdentifier, loginPasscode);

    if (!result.success || !result.student) {
      return res.status(401).json({
        success: false,
        error: result.error || 'Invalid credentials',
      });
    }

    const student = result.student;

    if (student.status === 'blocked') {
      return res.status(403).json({
        success: false,
        status: 'blocked',
        error: 'This account has been suspended by an administrator.',
      });
    }

    return res.json({
      success: true,
      status: student.status,
      student: withToken(student),
    });
  } catch (err: any) {
    console.error('Student login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/student-check', (req, res) => {
  const phone = (req.query.phone as string) || '';
  if (!phone) {
    return res.status(400).json({ error: 'Phone required' });
  }
  const hdr = String(req.headers.authorization || '');
  const tok = hdr.startsWith('Bearer ') ? hdr.slice(7).trim() : '';
  const student = studentStore.findStudentByPhone(phone);
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }
  if (!tok || !safeEq(tok, studentToken(String(student.phone)))) {
    return res.status(401).json({ error: 'Sign in again.' });
  }
  return res.json({ student: withToken(student), status: student.status });
});

app.post('/api/auth/admin-login', (req, res) => {
  const { passcode } = req.body || {};
  if (!passcode || typeof passcode !== 'string' || !studentStore.verifyAdmin(passcode.trim())) {
    return res.status(401).json({ error: 'Invalid admin passcode' });
  }
  return res.json({
    success: true,
    token: adminToken(),
  });
});

app.get('/api/admin/overview', (_req, res) => {
  const students = studentStore.getStudents().map((x: any) => { const { passcode: _a, passhash: _b, ...r } = x; return r; });
  const settings = studentStore.getSettings();

  const total = students.length;
  const active = students.filter((s) => s.status === 'active').length;
  const pending = students.filter((s) => s.status === 'pending').length;
  const blocked = students.filter((s) => s.status === 'blocked').length;

  return res.json({
    students,
    summary: { total, active, pending, blocked },
    settings: {
      autoApprove: settings.autoApprove,
      requirePhoneVerification: settings.requirePhoneVerification,
      hasCustomPasscode: studentStore.hasAdminPasscode(),
    },
  });
});

app.post('/api/admin/student/status', (req, res) => {
  const { studentId, status, notes } = req.body || {};
  if (!studentId || !['active', 'pending', 'blocked'].includes(status)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const updated = studentStore.updateStudentStatus(studentId, status, notes);
  if (!updated) {
    return res.status(404).json({ error: 'Student not found' });
  }
  return res.json({ success: true, student: pubStudent(updated) });
});

app.post('/api/admin/student/:id/passcode', (req, res) => {
  const { id } = req.params;
  const { passcode } = req.body || {};
  if (!passcode || typeof passcode !== 'string' || passcode.trim().length < 3) {
    return res.status(400).json({ error: 'Passcode must be at least 3 characters' });
  }
  const updated = studentStore.updateStudentPasscode(id, passcode.trim());
  if (!updated) {
    return res.status(404).json({ error: 'Student not found' });
  }
  return res.json({ success: true, student: pubStudent(updated) });
});

app.post('/api/admin/student/create', (req, res) => {
  const { name, phone, passcode = '1234', status = 'active', notes } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }
  const student = studentStore.addStudentDirectly(name, phone, passcode, status, notes);
  return res.json({ success: true, student: pubStudent(student) });
});

app.delete('/api/admin/student/:id', (req, res) => {
  const { id } = req.params;
  const deleted = studentStore.deleteStudent(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Student not found' });
  }
  return res.json({ success: true });
});

app.post('/api/admin/settings', (req, res) => {
  const { autoApprove, newPasscode } = req.body || {};
  const updates: any = {};
  if (typeof autoApprove === 'boolean') {
    updates.autoApprove = autoApprove;
  }
  if (newPasscode !== undefined) {
    if (typeof newPasscode !== 'string' || newPasscode.trim().length < 4) {
      return res.status(400).json({ error: 'Admin code must be at least 4 characters.' });
    }
    studentStore.setAdminPasscode(newPasscode.trim());
  }
  const settings = studentStore.updateSettings(updates);
  return res.json({ success: true, passcodeChanged: newPasscode !== undefined, token: newPasscode !== undefined ? adminToken() : undefined, settings: { autoApprove: settings.autoApprove } });
});

app.post('/api/student/activity', (req, res) => {
  const { phone, type } = req.body || {};
  if (phone && ['transcriptions', 'summaries', 'quizzes', 'flashcards'].includes(type)) {
    studentStore.incrementStat(phone, type as any);
  }
  res.json({ success: true });
});

app.post('/api/student/activity-log', (req, res) => {
  try {
    const { phone, type = 'navigation', title, details, tool } = req.body || {};
    if (!phone || !title) {
      return res.status(400).json({ error: 'Phone and title are required' });
    }
    studentStore.logStudentActivity(phone, {
      type,
      title,
      details,
      tool,
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

app.post('/api/student/heartbeat', (req, res) => {
  try {
    const { phone, deltaMinutes = 1 } = req.body || {};
    if (phone) {
      const total = studentStore.incrementStudentTime(phone, Number(deltaMinutes) || 1);
      return res.json({ success: true, totalTimeMinutes: total });
    }
    res.json({ success: false });
  } catch {
    res.status(500).json({ error: 'Failed to update study time' });
  }
});

app.get('/api/admin/student/:id/activities', (req, res) => {
  const { id } = req.params;
  const student = studentStore.findStudentById(id);
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }
  res.json({
    studentId: student.id,
    name: student.name,
    phone: student.phone,
    totalTimeMinutes: student.totalTimeMinutes || 0,
    activityLog: student.activityLog || [],
  });
});

// Setup Vite middleware or static serving
async function setupServer() {
  await studentStore.ready;
  app.use(express.static(path.resolve(__dirname, 'public')));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Hashed build files never change, so browsers and the free Cloudflare edge in front of Render can keep them for a year.
    app.use('/assets', express.static(path.resolve(__dirname, 'dist', 'assets'), { maxAge: '365d', immutable: true }));
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

setupServer();

const shutdown = async () => { try { await studentStore.flush(); } catch {} process.exit(0); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
