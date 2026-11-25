import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

type Card = { id: string; front: string; back: string; category?: string; ease: number; interval: number; reps: number; due: number };
type Q = { id: string; question: string; options: string[]; correctAnswer: string; explanation: string };
type Stats = { weekBase?: number; weekId?: string; xp: number; streak: number; lastDay: string; today: string; todayCount: number; best: number };

const S = {
  ar: { title: 'المعمل الذكي', sub: 'مراجعة متباعدة، امتحان تجريبي، نقاط وسلاسل، قراءة صوتية، تصدير Anki', review: 'مراجعة ذكية', exam: 'امتحان', deck: 'المجموعة', due: 'مستحق اليوم', total: 'الكل', paste: 'ألصق ملخصك أو موضوعك هنا', gen: 'ولّد كروت بالذكاء الاصطناعي', loading: 'جاري التوليد... (ممكن ياخد لحد دقيقة)', show: 'اظهر الإجابة', again: 'نسيت', hard: 'صعب', good: 'كويس', easy: 'سهل', done: 'خلصت مراجعة النهاردة', empty: 'مفيش كروت لسه. ولّد كروت من نص.', front: 'السؤال', back: 'الإجابة', add: 'إضافة', exportAnki: 'تصدير Anki', exportCsv: 'تصدير CSV', clear: 'مسح المجموعة', start: 'ابدأ الامتحان', submit: 'سلّم', score: 'درجتك', weak: 'راجع الأسئلة دي', min: 'دقيقة', time: 'الوقت', xp: 'نقطة', streak: 'يوم متتالي', goal: 'هدف اليوم', listen: 'اسمع', err: 'حصل خطأ، جرّب تاني', level: 'مستوى', q: 'عدد الأسئلة', tutor: 'المدرّس', league: 'الدوري', img: 'صورة', yt: 'يوتيوب', ytAsk: 'الصق لينك فيديو يوتيوب (لازم يكون فيه ترجمة)', reading: 'جاري قراءة الصورة...', ytLoad: 'جاري جلب النص...', feynman: 'فاينمان: أنا أشرح وإنت صحّحلي', eli12: 'اشرحلي كأني 12 سنة', normal: 'شرح عادي', send: 'ابعت', ask: 'اسأل أو اشرح...', needText: 'ألصق نص المادة فوق الأول', week: 'ترتيبك الأسبوع ده', rank: 'المركز', sim: 'منافسين افتراضيين بيتجددوا كل أسبوع', you: 'إنت' },
  en: { title: 'Study Lab', sub: 'Spaced repetition, mock exams, XP & streaks, read-aloud, Anki export', review: 'Smart review', exam: 'Exam', deck: 'Deck', due: 'Due today', total: 'Total', paste: 'Paste your notes or a topic here', gen: 'Generate cards with AI', loading: 'Generating... (can take up to a minute)', show: 'Show answer', again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy', done: 'All done for today', empty: 'No cards yet. Generate some from text.', front: 'Question', back: 'Answer', add: 'Add', exportAnki: 'Export Anki', exportCsv: 'Export CSV', clear: 'Clear deck', start: 'Start exam', submit: 'Submit', score: 'Your score', weak: 'Review these', min: 'min', time: 'Time', xp: 'XP', streak: 'day streak', goal: 'Daily goal', listen: 'Listen', err: 'Something went wrong, try again', level: 'Level', q: 'Questions', tutor: 'Tutor', league: 'League', img: 'Image', yt: 'YouTube', ytAsk: 'Paste a YouTube link (needs captions)', reading: 'Reading image...', ytLoad: 'Fetching transcript...', feynman: 'Feynman: I explain, you correct me', eli12: 'Explain like I am 12', normal: 'Normal', send: 'Send', ask: 'Ask or explain...', needText: 'Paste your study text above first', week: 'Your rank this week', rank: 'Rank', sim: 'Simulated rivals, refreshed weekly', you: 'You' },
} as const;

const DECK_KEY = 'zk_lab_deck_v1';
const STAT_KEY = 'zk_lab_stats_v1';
const day = (d = new Date()) => d.toISOString().slice(0, 10);
const load = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } };

export const StudyLab: React.FC = () => {
  const { lang, isRtl } = useLanguage() as any;
  const t = (lang === 'ar' ? S.ar : S.en) as typeof S.ar;
  const [mode, setMode] = useState<'review' | 'exam' | 'tutor' | 'league'>('review');
  const [deck, setDeck] = useState<Card[]>(() => load(DECK_KEY, []));
  const [stats, setStats] = useState<Stats>(() => {
    const s = load<Stats>(STAT_KEY, { xp: 0, streak: 0, lastDay: '', today: day(), todayCount: 0, best: 0 });
    const wk = String(Math.floor(Date.now() / 6048e5));
    const s2 = s.weekId === wk ? s : { ...s, weekId: wk, weekBase: s.xp };
    return s2.today === day() ? s2 : { ...s2, today: day(), todayCount: 0 };
  });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [flip, setFlip] = useState(false);
  const [nf, setNf] = useState(''); const [nb, setNb] = useState('');
  const [qs, setQs] = useState<Q[]>([]); const [ans, setAns] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false); const [left, setLeft] = useState(0); const [qn, setQn] = useState(8);
  const timer = useRef<any>(null);
  const [chat, setChat] = useState<{ role: 'u' | 'a'; text: string }[]>([]);
  const [msg, setMsg] = useState(''); const [style, setStyle] = useState<'normal' | 'eli12' | 'feynman'>('feynman');
  const [info, setInfo] = useState('');
  const sendMsg = async () => {
    if (!msg.trim()) return; if (!text.trim()) { setErr(t.needText); return; }
    const pre = style === 'feynman' ? 'Feynman technique: the student is explaining the topic to you as if teaching a beginner. Find gaps or mistakes, praise what is right, then ask one probing follow-up question. Student says: ' : style === 'eli12' ? 'Explain simply like I am 12 years old, with a short everyday example. Question: ' : '';
    const next = [...chat, { role: 'u' as const, text: msg }]; setChat(next); setMsg(''); setBusy(true); setErr('');
    try {
      const msgs = next.map((m, i) => ({ id: String(i), sender: m.role === 'u' ? 'user' : 'assistant', content: i === next.length - 1 ? pre + m.text : m.text, timestamp: '' }));
      const j = await post('/api/chat', { messages: msgs, studyContext: text });
      setChat(c => [...c, { role: 'a', text: j.reply }]); award(4);
    } catch (e: any) { setErr(e.message || t.err); } finally { setBusy(false); }
  };
  const importImage = async (f?: File | null) => {
    if (!f) return; setInfo(t.reading); setErr('');
    try {
      if (!(window as any).Tesseract) await new Promise<void>((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; sc.onload = () => res(); sc.onerror = () => rej(new Error('ocr')); document.head.appendChild(sc); });
      const r = await (window as any).Tesseract.recognize(f, 'ara+eng');
      setText(x => (x ? x + '\n' : '') + r.data.text); award(5);
    } catch { setErr(t.err); } finally { setInfo(''); }
  };
  const importYt = async () => {
    const url = prompt(t.ytAsk); if (!url) return; setInfo(t.ytLoad); setErr('');
    try { const j = await post('/api/youtube', { url }); setText(x => (x ? x + '\n' : '') + j.text); award(5); } catch (e: any) { setErr(e.message || t.err); } finally { setInfo(''); }
  };
  const importFile = async (f?: File | null) => { if (!f) return; const tx = await f.text(); setText(x => (x ? x + '\n' : '') + tx); };
  const weekXp = stats.xp - (stats.weekBase ?? stats.xp);
  const league = useMemo(() => {
    const names = ['Layla', 'Omar', 'Mei', 'Carlos', 'Aisha', 'Lukas', 'Priya', 'Yusuf', 'Sofia', 'Kenji', 'Nour', 'Ivan'];
    const wk = Math.floor(Date.now() / 6048e5); const frac = Math.min(1, ((Date.now() / 864e5 + 4) % 7) / 7 + 0.1);
    const rows = names.map((n, i) => { const seed = Math.abs(Math.sin(wk * 31 + i * 17) * 10000) % 1; return { n, xp: Math.round((40 + seed * 360) * frac) }; });
    rows.push({ n: t.you, xp: weekXp }); rows.sort((a, b) => b.xp - a.xp); return rows;
  }, [weekXp, t.you]);
  const myRank = league.findIndex(r => r.n === t.you) + 1;
  const tier = myRank <= 3 ? '🥇' : myRank <= 7 ? '🥈' : '🥉';

  useEffect(() => { localStorage.setItem(DECK_KEY, JSON.stringify(deck)); }, [deck]);
  useEffect(() => { localStorage.setItem(STAT_KEY, JSON.stringify(stats)); }, [stats]);

  const due = useMemo(() => deck.filter(c => c.due <= Date.now()).sort((a, b) => a.due - b.due), [deck]);
  const cur = due[0];
  const level = Math.floor(Math.sqrt(stats.xp / 50)) + 1;

  const award = (xp: number, reviewed = 0) => setStats(s => {
    const t0 = day(); let streak = s.streak; let lastDay = s.lastDay;
    if (lastDay !== t0) { const y = day(new Date(Date.now() - 864e5)); streak = lastDay === y ? streak + 1 : 1; lastDay = t0; }
    return { ...s, xp: s.xp + xp, streak, best: Math.max(s.best, streak), lastDay, today: t0, todayCount: (s.today === t0 ? s.todayCount : 0) + reviewed };
  });

  const speak = (txt: string) => {
    try { const u = new SpeechSynthesisUtterance(txt); u.lang = lang === 'ar' ? 'ar-SA' : lang; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {}
  };

  const post = async (url: string, body: any) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, language: lang }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || 'x'); return j;
  };

  const generate = async () => {
    if (!text.trim()) return; setBusy(true); setErr('');
    try {
      const j = await post('/api/flashcards', { topicOrText: text, count: 10 });
      const add: Card[] = (j.cards || []).map((c: any, i: number) => ({ id: `${Date.now()}-${i}`, front: c.front, back: c.back, category: c.category, ease: 2.5, interval: 0, reps: 0, due: Date.now() }));
      setDeck(d => [...d, ...add]); award(5 * add.length);
    } catch (e: any) { setErr(e.message || t.err); } finally { setBusy(false); }
  };

  const rate = (g: 0 | 1 | 2 | 3) => {
    if (!cur) return;
    setDeck(d => d.map(c => {
      if (c.id !== cur.id) return c;
      let { ease, interval, reps } = c;
      if (g === 0) { reps = 0; interval = 0; ease = Math.max(1.3, ease - 0.2); }
      else {
        reps += 1;
        interval = reps === 1 ? (g === 3 ? 4 : 1) : reps === 2 ? (g === 3 ? 8 : 3) : Math.round(interval * ease * (g === 1 ? 0.8 : g === 3 ? 1.3 : 1));
        ease = Math.max(1.3, ease + (g === 3 ? 0.15 : g === 1 ? -0.15 : 0));
      }
      return { ...c, ease, interval, reps, due: g === 0 ? Date.now() + 6e4 * 5 : Date.now() + interval * 864e5 };
    }));
    award(g === 0 ? 1 : 3 + g * 2, 1); setFlip(false);
  };

  const addManual = () => { if (!nf.trim() || !nb.trim()) return; setDeck(d => [...d, { id: `${Date.now()}`, front: nf, back: nb, ease: 2.5, interval: 0, reps: 0, due: Date.now() }]); setNf(''); setNb(''); };

  const download = (name: string, content: string, mime: string) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + content], { type: mime })); a.download = name; a.click();
  };
  const esc = (s: string) => s.replace(/[\t\r\n]+/g, ' ');
  const exportAnki = () => download('zakir-deck-anki.txt', deck.map(c => `${esc(c.front)}\t${esc(c.back)}`).join('\n'), 'text/plain;charset=utf-8');
  const exportCsv = () => download('zakir-deck.csv', 'front,back\n' + deck.map(c => `"${c.front.replace(/"/g, '""')}","${c.back.replace(/"/g, '""')}"`).join('\n'), 'text/csv;charset=utf-8');

  const startExam = async () => {
    if (!text.trim()) return; setBusy(true); setErr(''); setSubmitted(false); setAns({});
    try {
      const j = await post('/api/quiz', { topicOrText: text, count: qn, difficulty: 'medium', type: 'mcq' });
      setQs(j.questions || []); setLeft(qn * 90);
      clearInterval(timer.current);
      timer.current = setInterval(() => setLeft(l => { if (l <= 1) { clearInterval(timer.current); return 0; } return l - 1; }), 1000);
    } catch (e: any) { setErr(e.message || t.err); } finally { setBusy(false); }
  };
  useEffect(() => { if (left === 0 && qs.length && !submitted && timer.current) finish(); /* eslint-disable-next-line */ }, [left]);
  useEffect(() => () => clearInterval(timer.current), []);
  const finish = () => { clearInterval(timer.current); setSubmitted(true); const c = qs.filter(q => ans[q.id] === q.correctAnswer).length; award(c * 10); };
  const correct = qs.filter(q => ans[q.id] === q.correctAnswer).length;

  const card = 'rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4';
  const btn = 'px-4 py-2 rounded-xl font-bold text-xs cursor-pointer transition';
  const pri = `${btn} bg-teal-500 hover:bg-teal-600 text-slate-950 disabled:opacity-50`;
  const sec = `${btn} bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700`;
  const goal = Math.min(100, Math.round((stats.todayCount / 20) * 100));

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      <div><h2 className="text-xl font-black text-slate-900 dark:text-white">🧪 {t.title}</h2><p className="text-xs text-slate-500">{t.sub}</p></div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={card}><div className="text-lg font-black">⭐ {stats.xp}</div><div className="text-[11px] text-slate-500">{t.xp} · {t.level} {level}</div></div>
        <div className={card}><div className="text-lg font-black">🔥 {stats.streak}</div><div className="text-[11px] text-slate-500">{t.streak}</div></div>
        <div className={card}><div className="text-lg font-black">🎯 {stats.todayCount}/20</div><div className="h-1.5 mt-1 rounded bg-slate-200 dark:bg-slate-800"><div className="h-1.5 rounded bg-teal-500" style={{ width: goal + '%' }} /></div><div className="text-[11px] text-slate-500">{t.goal}</div></div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className={mode === 'review' ? pri : sec} onClick={() => setMode('review')}>{t.review}</button>
        <button className={mode === 'exam' ? pri : sec} onClick={() => setMode('exam')}>{t.exam}</button>
        <button className={mode === 'tutor' ? pri : sec} onClick={() => setMode('tutor')}>{t.tutor}</button>
        <button className={mode === 'league' ? pri : sec} onClick={() => setMode('league')}>{t.league}</button>
      </div>
      <div className={card + ' space-y-2'}>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder={t.paste} rows={4} className="w-full rounded-xl p-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800" />
        <div className="flex gap-2 flex-wrap">
          <label className={sec}>📷 {t.img}<input type="file" accept="image/*" className="hidden" onChange={e => importImage(e.target.files?.[0])} /></label>
          <button className={sec} onClick={importYt}>▶ {t.yt}</button>
          <label className={sec}>📄 .txt<input type="file" accept=".txt,.md,.csv" className="hidden" onChange={e => importFile(e.target.files?.[0])} /></label>
        </div>
        {info && <p className="text-xs text-teal-600">{info}</p>}
        {mode === 'tutor' || mode === 'league' ? null : mode === 'review' ? (
          <button className={pri} disabled={busy || !text.trim()} onClick={generate}>{busy ? t.loading : t.gen}</button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs">{t.q}: <select value={qn} onChange={e => setQn(+e.target.value)} className="bg-transparent border rounded p-1">{[5, 8, 12].map(n => <option key={n}>{n}</option>)}</select></label>
            <button className={pri} disabled={busy || !text.trim()} onClick={startExam}>{busy ? t.loading : t.start}</button>
          </div>
        )}
        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>

      {mode === 'league' && (
        <div className={card + ' space-y-1'}>
          <p className="text-sm font-bold">{tier} {t.week}: #{myRank}</p>
          <p className="text-[11px] text-slate-500">{t.sim}</p>
          {league.map((r, i) => <div key={r.n + i} className={`flex justify-between text-xs p-1.5 rounded ${r.n === t.you ? 'bg-teal-500/15 font-black' : ''}`}><span>{i + 1}. {r.n}</span><span>{r.xp} {t.xp}</span></div>)}
        </div>
      )}

      {mode === 'tutor' && (
        <div className={card + ' space-y-2'}>
          <div className="flex gap-2 flex-wrap">
            {(['feynman', 'eli12', 'normal'] as const).map(k => <button key={k} className={style === k ? pri : sec} onClick={() => setStyle(k)}>{k === 'feynman' ? t.feynman : k === 'eli12' ? t.eli12 : t.normal}</button>)}
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {chat.map((m, i) => <div key={i} className={`p-2 rounded-xl text-sm whitespace-pre-wrap ${m.role === 'u' ? 'bg-teal-500/10' : 'bg-slate-100 dark:bg-slate-800'}`}>{m.text}{m.role === 'a' && <button className="ms-2" onClick={() => speak(m.text)}>🔊</button>}</div>)}
          </div>
          <div className="flex gap-2"><input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} placeholder={t.ask} className="flex-1 rounded-xl p-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800" /><button className={pri} disabled={busy} onClick={sendMsg}>{busy ? '...' : t.send}</button></div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
      )}

      {mode === 'review' && (
        <>
          <div className={card + ' space-y-3 text-center'}>
            <div className="text-[11px] text-slate-500">{t.due}: {due.length} · {t.total}: {deck.length}</div>
            {!deck.length ? <p className="text-sm">{t.empty}</p> : !cur ? <p className="text-sm font-bold">🎉 {t.done}</p> : (
              <>
                <div className="min-h-[110px] flex flex-col items-center justify-center gap-2 cursor-pointer" onClick={() => setFlip(true)}>
                  <p className="text-base font-bold">{cur.front}</p>
                  {flip && <p className="text-sm text-teal-600 dark:text-teal-300">{cur.back}</p>}
                </div>
                <button className={sec} onClick={() => speak(flip ? `${cur.front}. ${cur.back}` : cur.front)}>🔊 {t.listen}</button>
                {!flip ? <div><button className={pri} onClick={() => setFlip(true)}>{t.show}</button></div> : (
                  <div className="grid grid-cols-4 gap-2">
                    <button className={`${btn} bg-red-500/15 text-red-600`} onClick={() => rate(0)}>{t.again}</button>
                    <button className={`${btn} bg-amber-500/15 text-amber-600`} onClick={() => rate(1)}>{t.hard}</button>
                    <button className={`${btn} bg-teal-500/15 text-teal-600`} onClick={() => rate(2)}>{t.good}</button>
                    <button className={`${btn} bg-emerald-500/15 text-emerald-600`} onClick={() => rate(3)}>{t.easy}</button>
                  </div>
                )}
              </>
            )}
          </div>
          <div className={card + ' space-y-2'}>
            <div className="grid sm:grid-cols-2 gap-2">
              <input value={nf} onChange={e => setNf(e.target.value)} placeholder={t.front} className="rounded-xl p-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800" />
              <input value={nb} onChange={e => setNb(e.target.value)} placeholder={t.back} className="rounded-xl p-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button className={pri} onClick={addManual}>{t.add}</button>
              <button className={sec} disabled={!deck.length} onClick={exportAnki}>⬇ {t.exportAnki}</button>
              <button className={sec} disabled={!deck.length} onClick={exportCsv}>⬇ {t.exportCsv}</button>
              <button className={sec} disabled={!deck.length} onClick={() => confirm('?') && setDeck([])}>🗑 {t.clear}</button>
            </div>
          </div>
        </>
      )}

      {mode === 'exam' && qs.length > 0 && (
        <div className="space-y-3">
          <div className={card + ' flex justify-between text-sm font-bold'}>
            <span>⏱ {t.time}: {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
            {submitted && <span>{t.score}: {correct}/{qs.length} ({Math.round((correct / qs.length) * 100)}%)</span>}
          </div>
          {qs.map((q, i) => (
            <div key={q.id} className={card + ' space-y-2'}>
              <p className="text-sm font-bold">{i + 1}. {q.question}</p>
              {q.options.map(o => {
                const sel = ans[q.id] === o; const ok = o === q.correctAnswer;
                const cls = submitted ? (ok ? 'border-emerald-500 bg-emerald-500/10' : sel ? 'border-red-500 bg-red-500/10' : 'border-slate-200 dark:border-slate-800') : sel ? 'border-teal-500 bg-teal-500/10' : 'border-slate-200 dark:border-slate-800';
                return <button key={o} disabled={submitted} onClick={() => setAns(a => ({ ...a, [q.id]: o }))} className={`w-full text-start p-2 rounded-xl border text-xs ${cls}`}>{o}</button>;
              })}
              {submitted && ans[q.id] !== q.correctAnswer && <p className="text-xs text-amber-600">💡 {t.weak}: {q.explanation}</p>}
            </div>
          ))}
          {!submitted && <button className={pri} onClick={finish}>{t.submit}</button>}
        </div>
      )}
    </div>
  );
};
