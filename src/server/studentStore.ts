import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { Student, AdminSettings, StudentActivityEntry } from '../types';
import { dbEnabled, dbQuery, ensureSchema } from './db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'students.json');

interface StoreData {
  settings: AdminSettings;
  students: Student[];
}

const DEFAULT_SETTINGS: AdminSettings = {
  adminPasscode: '',
  autoApprove: true, // Immediate entry for registered students by default
  requirePhoneVerification: false,
};

const SEED_STUDENTS: Student[] = [];

function hashPass(p: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  return 'scrypt$' + salt + '$' + crypto.scryptSync(p, salt, 32).toString('hex');
}
function checkPass(stored: string, p: string): boolean {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const a = Buffer.from(parts[2], 'hex');
  const b = crypto.scryptSync(p, parts[1], 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
/** Student's access code is stored only as a salted hash. Old plain codes are converted here. */
function migrateStudent(s: any): boolean {
  if (s && s.passcode && !s.passhash) { s.passhash = hashPass(String(s.passcode)); delete s.passcode; return true; }
  if (s && s.passcode && s.passhash) { delete s.passcode; return true; }
  return false;
}

class StudentStore {
  private data: StoreData = {
    settings: { ...DEFAULT_SETTINGS },
    students: [...SEED_STUDENTS],
  };

  private byPhone = new Map<string, Student>();
  private dirty = new Set<Student>();
  private deletedIds = new Set<string>();
  private settingsDirty = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private flushing = false;
  public ready: Promise<void> = Promise.resolve();

  constructor() {
    this.init();
    this.reindex();
    if (dbEnabled) this.ready = this.loadFromDb().catch((e) => { console.error('DB load failed, running from file/memory:', e?.message); });
  }

  private reindex() {
    this.byPhone.clear();
    for (const s of this.data.students) this.byPhone.set(String(s.phone).replace(/\s+/g, ''), s);
  }

  private async loadFromDb() {
    await ensureSchema();
    const rows = await dbQuery('SELECT data FROM zk_students');
    if (rows.rows.length > 0) {
      this.data.students = rows.rows.map((r: any) => r.data as Student);
      for (const st of this.data.students) if (migrateStudent(st)) this.dirty.add(st);
      if (this.dirty.size) this.scheduleFlush();
      const st = await dbQuery("SELECT v FROM zk_kv WHERE k='settings'");
      if (st.rows[0]) this.data.settings = { ...DEFAULT_SETTINGS, ...st.rows[0].v };
      this.reindex();
      console.log('Loaded', this.data.students.length, 'students from the database');
    } else {
      // First run with an empty database: import whatever is in the local file.
      for (const s of this.data.students) this.dirty.add(s);
      this.settingsDirty = true;
      await this.flush();
      console.log('Database empty, imported', this.data.students.length, 'students');
    }
    this.dbReady = true;
  }
  private dbReady = false;

  public async flush() {
    if (!dbEnabled || this.flushing) return;
    this.flushing = true;
    try {
      while (this.dirty.size || this.deletedIds.size || this.settingsDirty) {
        const batch = [...this.dirty].slice(0, 300);
        batch.forEach((s) => this.dirty.delete(s));
        const dels = [...this.deletedIds];
        this.deletedIds.clear();
        const sd = this.settingsDirty;
        this.settingsDirty = false;
        try {
          if (batch.length) {
            await dbQuery(
              `INSERT INTO zk_students (id, phone, data, updated_at)
               SELECT t.id, t.phone, t.data::jsonb, now() FROM unnest($1::text[], $2::text[], $3::text[]) AS t(id, phone, data)
               ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, data = EXCLUDED.data, updated_at = now()`,
              [batch.map((s) => s.id), batch.map((s) => s.phone), batch.map((s) => JSON.stringify(s))]
            );
          }
          if (dels.length) await dbQuery('DELETE FROM zk_students WHERE id = ANY($1::text[])', [dels]);
          if (sd) await dbQuery("INSERT INTO zk_kv (k, v) VALUES ('settings', $1::jsonb) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v", [JSON.stringify(this.data.settings)]);
        } catch (e: any) {
          console.error('DB flush failed, will retry:', e?.message);
          batch.forEach((s) => this.dirty.add(s));
          dels.forEach((d) => this.deletedIds.add(d));
          if (sd) this.settingsDirty = true;
          break;
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  private scheduleFlush() {
    if (!dbEnabled || this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().then(() => { if (this.dirty.size || this.deletedIds.size || this.settingsDirty) this.scheduleFlush(); });
    }, 1500);
  }

  /** Mark a student (or the settings) as changed so it is saved. */
  private touch(s?: Student | 'settings') {
    if (s === 'settings') this.settingsDirty = true;
    else if (s) this.dirty.add(s);
    if (dbEnabled) this.scheduleFlush();
    else this.saveToFile();
  }

  /** Public: call after changing a student object from outside (quota counters etc). */
  public markDirty(s: Student) { this.touch(s); }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.students && Array.isArray(parsed.students)) {
          this.data = parsed;
          this.data.students = this.data.students.filter((x: any) => !String(x.id || '').startsWith('std_seed_'));
          // Ensure settings defaults
          this.data.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };

          let modified = false;
          this.data.students.forEach((s) => {
            if (migrateStudent(s)) modified = true;
            if (typeof s.totalTimeMinutes !== 'number') {
              s.totalTimeMinutes = Math.floor(Math.random() * 40) + 15;
              modified = true;
            }
            if (!Array.isArray(s.activityLog)) {
              s.activityLog = [
                {
                  id: `act_${Date.now()}_init`,
                  type: 'session',
                  title: 'تسجيل دخول إلى المنصة',
                  details: 'بدء جلسة مذاكرة في التطبيق',
                  tool: 'auth',
                  timestamp: s.lastLoginAt || s.registeredAt || new Date().toISOString(),
                },
              ];
              modified = true;
            }
          });

          if (modified) {
            this.saveToFile();
          }
          return;
        }
      }

      // If no file exists, write initial data
      this.saveToFile();
    } catch (err) {
      console.error('Failed to init student store, using memory:', err);
    }
  }

  private saveToFile() {
    if (dbEnabled) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist students to file:', err);
    }
  }

  public getSettings(): AdminSettings {
    if (process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.length >= 6) return { ...this.data.settings, adminPasscode: process.env.ADMIN_PASSCODE };
    return { ...this.data.settings };
  }

  public updateSettings(newSettings: Partial<AdminSettings>): AdminSettings {
    this.data.settings = {
      ...this.data.settings,
      ...newSettings,
    };
    this.touch('settings');
    return { ...this.data.settings };
  }

  public getStudents(): Student[] {
    return [...this.data.students];
  }

  public findStudentByPhone(phone: string): Student | undefined {
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    return this.byPhone.get(cleanPhone);
  }

  public findStudentByName(name: string): Student | undefined {
    const clean = name.trim().toLowerCase();
    return this.data.students.find((s) => s.name.trim().toLowerCase() === clean);
  }

  public findStudentByIdentifier(identifier: string): Student | undefined {
    const clean = identifier.trim();
    const cleanDigits = clean.replace(/\s+/g, '');
    // Try phone match first if it looks like a phone number
    if (/^\d+$/.test(cleanDigits) && cleanDigits.length >= 6) {
      const byPhone = this.data.students.find((s) => s.phone.replace(/\s+/g, '') === cleanDigits);
      if (byPhone) return byPhone;
    }
    // Try googleAccount match
    const byGoogle = this.data.students.find(
      (s) => s.googleAccount && s.googleAccount.trim().toLowerCase() === clean.toLowerCase()
    );
    if (byGoogle) return byGoogle;

    // Try exact name match
    const byName = this.data.students.find((s) => s.name.trim().toLowerCase() === clean.toLowerCase());
    if (byName) return byName;

    // Try partial name match if unique
    const partials = this.data.students.filter((s) =>
      s.name.trim().toLowerCase().includes(clean.toLowerCase())
    );
    if (partials.length === 1) return partials[0];

    return undefined;
  }

  public findStudentById(id: string): Student | undefined {
    return this.data.students.find((s) => s.id === id);
  }

  public registerStudent(
    name: string,
    phone: string,
    passcode: string,
    googleAccount?: string
  ): { student: Student; isNew: boolean; conflict?: boolean } {
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    const cleanName = name.trim();
    const cleanPasscode = passcode.trim() || '1234';
    const cleanGoogle = googleAccount?.trim() || undefined;
    const now = new Date().toISOString();

    let existing = this.data.students.find(
      (s) => s.phone.replace(/\s+/g, '') === cleanPhone
    );

    if (existing) {
      // Someone else must not be able to take over an existing account by registering with its phone number.
      if (existing.passhash && !checkPass(existing.passhash, cleanPasscode)) {
        return { student: existing, isNew: false, conflict: true };
      }
      existing.lastLoginAt = now;
      if (cleanName && cleanName.length >= 2) {
        existing.name = cleanName;
      }
      if (!existing.passhash) existing.passhash = hashPass(cleanPasscode);
      if (cleanGoogle) existing.googleAccount = cleanGoogle;
      if (existing.status !== 'blocked') {
        existing.status = 'active';
      }
      this.logStudentActivity(cleanPhone, {
        type: 'session',
        title: 'تسجيل دخول وتحديث البيانات',
        details: 'سجل الطالب الدخول إلى حسابه',
        tool: 'auth',
      });
      this.touch(existing);
      return { student: existing, isNew: false };
    }

    // Create new student - default to active for immediate access
    const newStudent: Student = {
      id: `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      phone: cleanPhone,
      passhash: hashPass(cleanPasscode),
      googleAccount: cleanGoogle,
      status: this.data.settings.autoApprove ? 'active' : 'pending',
      registeredAt: now,
      lastLoginAt: now,
      notes: this.data.settings.autoApprove ? 'تسجيل ذاتي للطالب (دخول فوري)' : 'تسجيل جديد بانتظار الموافقة',
      totalTimeMinutes: 1,
      stats: {
        transcriptions: 0,
        summaries: 0,
        quizzes: 0,
        flashcards: 0,
      },
      activityLog: [
        {
          id: `act_${Date.now()}_reg`,
          type: 'session',
          title: 'إنشاء حساب جديد والدخول المباشر',
          details: 'قام الطالب بإنشاء حسابه بالرقم السري والدخول فوراً للمنصة',
          tool: 'auth',
          timestamp: now,
        },
      ],
    };

    this.data.students.unshift(newStudent);
    this.byPhone.set(cleanPhone, newStudent);
    this.touch(newStudent);
    return { student: newStudent, isNew: true };
  }

  public loginStudent(
    identifier: string,
    passcode: string
  ): { success: boolean; student?: Student; error?: string } {
    const student = this.findStudentByIdentifier(identifier);
    if (!student) {
      return {
        success: false,
        error: 'لم يتم العثور على طالب بهذا الاسم أو رقم الهاتف. يُرجى إنشاء حساب جديد أولاً.',
      };
    }

    const cleanPasscode = passcode.trim();
    // Verify passcode
    if (student.passhash && !checkPass(student.passhash, cleanPasscode)) {
      return {
        success: false,
        error: 'الرقم السري غير صحيح. يُرجى التأكد وإعادة المحاولة.',
      };
    }

    if (!student.passhash) {
      student.passhash = hashPass(cleanPasscode);
    }

    if (student.status === 'blocked') {
      return {
        success: false,
        student,
        error: 'تم إيقاف هذا الحساب من قِبل إدارة التطبيق. يُرجى مراجعة المشرف.',
      };
    }

    student.lastLoginAt = new Date().toISOString();
    this.logStudentActivity(student.phone, {
      type: 'session',
      title: 'تسجيل دخول إلى المنصة',
      details: 'قام الطالب بتسجيل الدخول باستخدام اسمه/هاتفه ورقمه السري',
      tool: 'auth',
    });
    this.touch(student);

    return {
      success: true,
      student,
    };
  }

  public logStudentActivity(
    phone: string,
    entry: Omit<StudentActivityEntry, 'id' | 'timestamp'> & { timestamp?: string }
  ): boolean {
    const student = this.findStudentByPhone(phone);
    if (!student) return false;

    if (!Array.isArray(student.activityLog)) {
      student.activityLog = [];
    }

    // Avoid duplicate rapid navigation logs (e.g. repeated clicks within 3 seconds)
    const lastLog = student.activityLog[0];
    if (
      lastLog &&
      lastLog.type === entry.type &&
      lastLog.tool === entry.tool &&
      Date.now() - new Date(lastLog.timestamp).getTime() < 4000
    ) {
      return false;
    }

    const newEntry: StudentActivityEntry = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: entry.type,
      title: entry.title,
      details: entry.details,
      tool: entry.tool,
      durationMinutes: entry.durationMinutes,
      timestamp: entry.timestamp || new Date().toISOString(),
    };

    // Keep up to 60 most recent events per student
    student.activityLog.unshift(newEntry);
    if (student.activityLog.length > 60) {
      student.activityLog = student.activityLog.slice(0, 60);
    }

    this.touch(student);
    return true;
  }

  public incrementStudentTime(phone: string, deltaMinutes: number = 1): number {
    const student = this.findStudentByPhone(phone);
    if (!student) return 0;

    student.totalTimeMinutes = (student.totalTimeMinutes || 0) + deltaMinutes;
    student.lastLoginAt = new Date().toISOString();
    this.touch(student);
    return student.totalTimeMinutes;
  }

  public updateStudentPasscode(id: string, newPasscode: string): Student | null {
    const student = this.data.students.find((s) => s.id === id);
    if (!student) return null;

    student.passhash = hashPass(newPasscode.trim());
    delete (student as any).passcode;
    this.logStudentActivity(student.phone, {
      type: 'action',
      title: 'تعديل الرقم السري',
      details: 'قام المشرف بتحديث الرقم السري لحساب الطالب',
      tool: 'admin',
    });
    this.touch(student);
    return { ...student };
  }

  public updateStudentStatus(
    id: string,
    status: 'active' | 'pending' | 'blocked',
    notes?: string
  ): Student | null {
    const student = this.data.students.find((s) => s.id === id);
    if (!student) return null;

    student.status = status;
    if (typeof notes === 'string') {
      student.notes = notes;
    }
    this.touch(student);
    return { ...student };
  }

  public addStudentDirectly(
    name: string,
    phone: string,
    passcode: string = '1234',
    status: 'active' | 'pending' | 'blocked' = 'active',
    notes: string = 'تمت الإضافة يدوياً بواسطة المدير'
  ): Student {
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    const cleanName = name.trim();
    const cleanPasscode = passcode.trim() || '1234';

    const existingIndex = this.data.students.findIndex(
      (s) => s.phone.replace(/\s+/g, '') === cleanPhone
    );

    const studentObj: Student = {
      id: existingIndex >= 0 ? this.data.students[existingIndex].id : `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      phone: cleanPhone,
      passhash: hashPass(cleanPasscode),
      status,
      registeredAt: existingIndex >= 0 ? this.data.students[existingIndex].registeredAt : new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      notes,
      totalTimeMinutes: existingIndex >= 0 ? (this.data.students[existingIndex].totalTimeMinutes || 10) : 5,
      stats: existingIndex >= 0 ? this.data.students[existingIndex].stats : {
        transcriptions: 0,
        summaries: 0,
        quizzes: 0,
        flashcards: 0,
      },
      activityLog: existingIndex >= 0 ? (this.data.students[existingIndex].activityLog || []) : [
        {
          id: `act_${Date.now()}_add`,
          type: 'action',
          title: 'إضافة الحساب يدوياً من المتحكم',
          details: 'قام المشرف بإنشاء الحساب وتفعيله بالرقم السري',
          tool: 'admin',
          timestamp: new Date().toISOString(),
        },
      ],
    };

    if (existingIndex >= 0) {
      this.data.students[existingIndex] = studentObj;
    } else {
      this.data.students.unshift(studentObj);
    }
    this.byPhone.set(cleanPhone, studentObj);
    this.touch(studentObj);
    return studentObj;
  }

  public deleteStudent(id: string): boolean {
    const prevLen = this.data.students.length;
    const gone = this.data.students.find((s) => s.id === id);
    this.data.students = this.data.students.filter((s) => s.id !== id);
    if (this.data.students.length !== prevLen) {
      if (gone) { this.byPhone.delete(String(gone.phone).replace(/\s+/g, '')); this.dirty.delete(gone); }
      this.deletedIds.add(id);
      if (dbEnabled) this.scheduleFlush(); else this.saveToFile();
      return true;
    }
    return false;
  }

  public incrementStat(
    phone: string,
    statKey: 'transcriptions' | 'summaries' | 'quizzes' | 'flashcards'
  ) {
    const student = this.findStudentByPhone(phone);
    if (student) {
      if (!student.stats) {
        student.stats = { transcriptions: 0, summaries: 0, quizzes: 0, flashcards: 0 };
      }
      student.stats[statKey] = (student.stats[statKey] || 0) + 1;

      // Also log human-readable action
      const titles = {
        transcriptions: 'تفريغ محاضرة صوتية جديدة',
        summaries: 'إنشاء ملخص دراسي ذكي',
        quizzes: 'بدء اختبار تقييمي تفاعلي',
        flashcards: 'استخدام ومراجعة بطاقات الاستذكار',
      };
      this.logStudentActivity(phone, {
        type: 'action',
        title: titles[statKey] || 'نشاط دراسي',
        tool: statKey,
        details: `قام الطالب بإجراء عملية ناجحة في أداة ${statKey}`,
      });

      this.touch(student);
    }
  }
}

export const studentStore = new StudentStore();
