import express from 'express';
import { createServer as createViteServer } from 'vite';
import { getAi } from './ai';
import { jobs, transcribeJob, Job } from './src/server/transcribe';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { studentStore } from './src/server/studentStore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
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
app.get('/api/status', (_req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const isKeyConfigured = true;
  res.json({
    status: 'online',
    appName: 'Zakir Smart / ذاكر بذكاء',
    hasGeminiKey: isKeyConfigured,
    model: isKeyConfigured ? TEXT_MODEL : 'unavailable',
    transcribeModel: isKeyConfigured ? TRANSCRIBE_MODEL : 'unavailable',
    version: '2.0.0',
    supportedLanguages: Object.keys(SUPPORTED_LANGUAGES),
  });
});

// 2. Chat API
app.post('/api/youtube', async (req, res) => {
  try {
    const url = String(req.body?.url || '');
    const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
    if (!m) return res.status(400).json({ error: 'Invalid YouTube link' });
    const page = await (await fetch(`https://www.youtube.com/watch?v=${m[1]}&hl=en`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+1' } })).text();
    const mm = page.match(/"captionTracks":(\[.*?\])/);
    if (!mm) return res.status(404).json({ error: 'No captions available for this video. Paste the text instead.' });
    const tracks = JSON.parse(mm[1]);
    const want = String(req.body?.language || 'en');
    const tr = tracks.find((t: any) => t.languageCode?.startsWith(want)) || tracks.find((t: any) => t.languageCode?.startsWith('en')) || tracks[0];
    const j: any = await (await fetch(tr.baseUrl + '&fmt=json3')).json();
    const text = (j.events || []).map((e: any) => (e.segs || []).map((s: any) => s.utf8).join('')).join(' ').replace(/\s+/g, ' ').trim();
    if (!text) return res.status(404).json({ error: 'Empty transcript' });
    return res.json({ text: text.slice(0, 40000), lang: tr.languageCode });
  } catch (e: any) {
    return res.status(502).json({ error: 'Could not fetch captions. Paste the text instead.' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { messages, studyContext, language, studentPhone } = req.body || {};
  const { code: langCode, meta: langMeta } = resolveLang(language);

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: getErrorMessage(langCode, 'bad_input') });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: getErrorMessage(langCode, 'no_key') });
  }

  try {
    const systemPrompt = `You are the smart academic tutor inside the "Zakir Smart" study platform.
CRITICAL REQUIREMENT: Always respond strictly and exclusively in ${langMeta.name}.
Rules:
- Explain complex concepts step by step with clear, practical examples.
- Use clean bullet points and numbered steps when helpful.
- Encourage active recall and critical thinking.
${studyContext ? `\nStudent's attached study material context:\n"""${String(studyContext).slice(0, 20000)}"""\nGround your answers in this context whenever relevant.` : ''}`;

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

    return res.json({
      reply,
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

app.get('/api/transcribe-status/:id', (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: 'Job not found (server restarted?). Try again.' });
  return res.json({ status: j.status, progress: j.progress, stage: j.stage, result: j.result, error: j.error });
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
app.post('/api/contact', (req, res) => {
  try {
    const { name, phone, subject, message } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const dataDir = path.resolve(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const contactsFile = path.join(dataDir, 'contacts.json');
    let existing: any[] = [];
    if (fs.existsSync(contactsFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(contactsFile, 'utf-8'));
      } catch {
        existing = [];
      }
    }
    existing.unshift({
      id: `msg_${Date.now()}`,
      name: (name || '').toString().trim(),
      phone: (phone || '').toString().trim(),
      subject: (subject || 'General').toString().trim(),
      message: message.trim(),
      createdAt: new Date().toISOString(),
    });
    fs.writeFileSync(contactsFile, JSON.stringify(existing.slice(0, 200), null, 2), 'utf-8');
    return res.json({ success: true });
  } catch (err) {
    console.error('Contact save error:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
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

    const { student, isNew } = studentStore.registerStudent(
      name,
      phone,
      passcode,
      googleAccount
    );

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
      student,
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
      student,
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
  const student = studentStore.findStudentByPhone(phone);
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }
  return res.json({ student, status: student.status });
});

app.post('/api/auth/admin-login', (req, res) => {
  const { passcode } = req.body || {};
  const settings = studentStore.getSettings();
  if (!passcode || String(passcode).trim() !== settings.adminPasscode) {
    return res.status(401).json({ error: 'Invalid admin passcode' });
  }
  return res.json({
    success: true,
    token: 'admin_token_' + Date.now(),
  });
});

app.get('/api/admin/overview', (_req, res) => {
  const students = studentStore.getStudents();
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
      hasCustomPasscode: settings.adminPasscode !== '1q1q',
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
  return res.json({ success: true, student: updated });
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
  return res.json({ success: true, student: updated });
});

app.post('/api/admin/student/create', (req, res) => {
  const { name, phone, passcode = '1234', status = 'active', notes } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }
  const student = studentStore.addStudentDirectly(name, phone, passcode, status, notes);
  return res.json({ success: true, student });
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
  if (newPasscode && typeof newPasscode === 'string' && newPasscode.trim().length >= 4) {
    updates.adminPasscode = newPasscode.trim();
  }
  const settings = studentStore.updateSettings(updates);
  return res.json({ success: true, settings });
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
  app.use(express.static(path.resolve(__dirname, 'public')));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
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
