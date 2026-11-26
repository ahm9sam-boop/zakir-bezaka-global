// Native scheduled study reminders (Android APK via Capacitor LocalNotifications).
type LN = {
  checkPermissions: () => Promise<{ display: string }>;
  requestPermissions: () => Promise<{ display: string }>;
  schedule: (o: { notifications: unknown[] }) => Promise<unknown>;
  cancel: (o: { notifications: { id: number }[] }) => Promise<unknown>;
  getPending: () => Promise<{ notifications: { id: number }[] }>;
  createChannel?: (c: unknown) => Promise<unknown>;
};

const POOL: { t: string; b: string }[] = [
  { t: 'صباح الهمة ☀️', b: 'ابدأ يومك بـ 25 دقيقة تركيز. خطوة صغيرة النهارده بتفرق في الامتحان.' },
  { t: 'وقت المذاكرة 📚', b: 'افتح ذاكر بذكاء وراجع ملخص محاضرة واحدة بس. هتحس بالفرق.' },
  { t: 'اختبر نفسك 🎯', b: 'جرّب كويز سريع من ملاحظاتك. الاسترجاع أقوى من إعادة القراءة.' },
  { t: 'كروت المراجعة جاهزة 🧠', b: 'في كروت مستنياك. 10 دقايق مراجعة متباعدة بتثبّت المعلومة.' },
  { t: 'لا تخلي الستريك يقع 🔥', b: 'مذاكرة النهارده بتحافظ على الاستمرارية. ولو 15 دقيقة.' },
  { t: 'سجّل محاضرتك 🎙️', b: 'ارفع تسجيل المحاضرة وخلّي الذكاء الاصطناعي يطلعلك ملاحظات منظمة.' },
  { t: 'خريطة ذهنية سريعة 🗺️', b: 'حوّل موضوع صعب لخريطة ذهنية. الصورة بتفضل في الذاكرة أكتر.' },
  { t: 'استراحة ذكية ☕', b: 'خد 5 دقايق راحة وبعدها ارجع. المخ بيذاكر أحسن بفواصل.' },
  { t: 'اسأل المعلم الذكي 💬', b: 'في نقطة مش فاهمها؟ اسأل المعلم الذكي واستوعبها في دقيقتين.' },
  { t: 'راجع قبل النوم 🌙', b: 'مراجعة خفيفة قبل النوم بتساعد المخ يثبّت اللي ذاكرته.' },
  { t: 'هدفك قريب 💪', b: 'كل ساعة مذاكرة النهارده بتقرّبك من النتيجة اللي بتحلم بيها.' },
  { t: 'ملخص بدقيقة ⚡', b: 'ألصق المادة واحصل على ملخص ونقاط رئيسية جاهزة للمراجعة.' },
  { t: 'متأجلش لبكرة ⏰', b: 'ابدأ بأصعب مادة دلوقتي. أول 5 دقايق هي الأصعب بس.' },
  { t: 'برافو عليك 👏', b: 'استمرارك هو سر التفوق. كمّل النهارده ولو شوية.' },
];
const SLOTS = [[8, 30], [12, 0], [15, 30], [19, 0], [21, 30]];
const BASE = 7100;

import { getPlugin } from './native';
export function getLN(): LN | null {
  return getPlugin<LN>('LocalNotifications');
}

export async function testNotificationNow(): Promise<string> {
  const ln = getLN();
  if (!ln) return 'مش شغال جوه التطبيق (محتاج نسخة الأندرويد).';
  try {
    let p = await ln.checkPermissions();
    if (p.display !== 'granted') p = await ln.requestPermissions();
    if (p.display !== 'granted') return 'الإذن مرفوض. فعّل الإشعارات من إعدادات الموبايل للتطبيق.';
    try { await ln.createChannel?.({ id: 'study', name: 'تذكيرات المذاكرة', importance: 4, vibration: true, visibility: 1 }); } catch { /* ignore */ }
    await ln.schedule({ notifications: [{ id: 7099, title: 'تجربة الإشعارات ✅', body: 'لو شايف الرسالة دي يبقى الإشعارات شغالة.', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, channelId: 'study', smallIcon: 'ic_launcher' }] });
    return 'اتبعت. هيظهر إشعار بعد 5 ثواني.';
  } catch (e) {
    return 'فشل: ' + (e instanceof Error ? e.message : 'خطأ');
  }
}

export async function enableNativeReminders(ask: boolean): Promise<boolean> {
  const ln = getLN();
  if (!ln) return false;
  try {
    let p = await ln.checkPermissions();
    if (p.display !== 'granted' && ask) p = await ln.requestPermissions();
    if (p.display !== 'granted') return false;
    try {
      await ln.createChannel?.({ id: 'study', name: 'تذكيرات المذاكرة', importance: 4, vibration: true, visibility: 1 });
    } catch { /* ignore */ }
    const pend = await ln.getPending();
    if (pend.notifications.length) await ln.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
    const now = Date.now();
    const list: unknown[] = [];
    let k = Math.floor(Math.random() * POOL.length);
    for (let d = 0; d < 14; d++) {
      SLOTS.forEach(([h, m], i) => {
        const at = new Date();
        at.setDate(at.getDate() + d);
        at.setHours(h, m, 0, 0);
        if (at.getTime() <= now + 60000) return;
        const msg = POOL[k++ % POOL.length];
        list.push({ id: BASE + d * 10 + i, title: msg.t, body: msg.b, schedule: { at, allowWhileIdle: true }, channelId: 'study', smallIcon: 'ic_launcher' });
      });
    }
    await ln.schedule({ notifications: list });
    return true;
  } catch {
    return false;
  }
}
export { POOL as REMINDER_POOL };
