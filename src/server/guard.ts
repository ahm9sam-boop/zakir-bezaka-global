import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// ---------- 1) Per-IP rate limit (sliding window, in memory) ----------
const hits = new Map<string, number[]>();
setInterval(() => {
  const cut = Date.now() - 10 * 60e3;
  for (const [k, v] of hits) {
    const f = v.filter((t) => t > cut);
    if (f.length) hits.set(k, f); else hits.delete(k);
  }
}, 60e3).unref();

export function ipLimit(name: string, max: number, windowMs: number, msg: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = name + '|' + (req.ip || req.socket.remoteAddress || 'x');
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => t > now - windowMs);
    if (arr.length >= max) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: msg });
    }
    arr.push(now);
    hits.set(key, arr);
    next();
  };
}

// ---------- 2) Per-student daily quota (saved with the student record) ----------
export const DAILY_LIMITS: Record<string, number> = {
  chat: 80,
  summarize: 40,
  quiz: 40,
  flashcards: 40,
  mindmap: 30,
  transcribe: 6,
  youtube: 10,
};

const today = () => new Date().toISOString().slice(0, 10);

export function quota(kind: keyof typeof DAILY_LIMITS | string, getStudent: (req: Request) => any, mark: (s: any) => void) {
  const limit = DAILY_LIMITS[kind] ?? 40;
  return (req: Request, res: Response, next: NextFunction) => {
    const st = getStudent(req);
    if (!st) return next(); // admin or unknown: no student quota
    const u = (st.usage = st.usage && st.usage.day === today() ? st.usage : { day: today(), counts: {} });
    const used = u.counts[kind] || 0;
    if (used >= limit) {
      return res.status(429).json({
        error: `وصلت للحد اليومي المجاني من هذه الأداة (${limit} مرة في اليوم) علشان الخدمة تفضل مجانية للجميع. جرب تاني بكرة.`,
        quota: { kind, limit, used },
      });
    }
    u.counts[kind] = used + 1;
    mark(st);
    // Give the unit back if the request failed on our side (not the student's fault).
    res.on('finish', () => {
      if (res.statusCode >= 500 || res.statusCode === 429) {
        const cur = st.usage;
        if (cur && cur.day === today() && cur.counts[kind] > 0) { cur.counts[kind]--; mark(st); }
      }
    });
    next();
  };
}

// ---------- 3) Queue: limit how many AI jobs run at once ----------
const MAX_RUNNING = parseInt(process.env.AI_MAX_CONCURRENT || '6', 10);
const MAX_WAITING = parseInt(process.env.AI_MAX_QUEUE || '150', 10);
let running = 0;
const waiting: Array<() => void> = [];

export function queueStats() { return { running, waiting: waiting.length, max: MAX_RUNNING }; }

export function aiQueue() {
  return (req: Request, res: Response, next: NextFunction) => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      running--;
      const n = waiting.shift();
      if (n) n();
    };
    const go = () => {
      running++;
      res.on('finish', release);
      res.on('close', release);
      next();
    };
    if (running < MAX_RUNNING) return go();
    if (waiting.length >= MAX_WAITING) {
      res.setHeader('Retry-After', '20');
      return res.status(503).json({ error: 'الخدمة عليها ضغط كبير دلوقتي. جرب بعد دقيقة.' });
    }
    // If the client gives up while waiting, drop it from the queue.
    const entry = () => { if (!res.writableEnded && !res.destroyed) go(); else { /* gone */ const n = waiting.shift(); if (n) n(); } };
    waiting.push(entry);
    res.on('close', () => { const i = waiting.indexOf(entry); if (i >= 0) waiting.splice(i, 1); });
  };
}

// ---------- 4) Response cache: identical requests share one AI answer ----------
type Entry = { t: number; body: any };
const cache = new Map<string, Entry>();
const CACHE_TTL = 6 * 3600e3;
const CACHE_MAX = 400;

export function aiCache(kind: string, onHit?: (req: Request) => void) {
  return (req: Request, res: Response, next: NextFunction) => {
    const b: any = req.body || {};
    // Only cache content generation that does not depend on the student.
    const { studentPhone: _p, ...rest } = b;
    let key = '';
    try { key = kind + '|' + crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex'); } catch { return next(); }
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_TTL) {
      cache.delete(key); cache.set(key, hit); // LRU touch
      if (onHit) { try { onHit(req); } catch {} }
      res.setHeader('X-Cache', 'HIT');
      return res.json(hit.body);
    }
    const orig = res.json.bind(res);
    (res as any).json = (body: any) => {
      if (res.statusCode === 200 && body && !body.error) {
        cache.set(key, { t: Date.now(), body });
        while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
      }
      return orig(body);
    };
    next();
  };
}
