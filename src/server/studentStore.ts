import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Student, AdminSettings, StudentActivityEntry } from '../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'students.json');

interface StoreData {
  settings: AdminSettings;
  students: Student[];
}

const DEFAULT_SETTINGS: AdminSettings = {
  adminPasscode: '1q1q',
  autoApprove: true, // Immediate entry for registered students by default
  requirePhoneVerification: false,
};

const SEED_STUDENTS: Student[] = [
  {
    id: 'std_seed_1',
    name: 'أحمد محمود سامي',
    phone: '01012345678',
    passcode: '1234',
    status: 'active',
    registeredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    notes: 'طالب في كلية الهندسة - مجتهد',
    totalTimeMinutes: 78,
    stats: {
      transcriptions: 4,
      summaries: 6,
      quizzes: 5,
      flashcards: 12,
    },
    activityLog: [
      {
        id: 'act_seed_1_1',
        type: 'action',
        title: 'تفريغ محاضرة صوتية',
        details: 'قام بتفريغ وتلخيص تسجيل: "محاضرة الرياضيات التطبيقية والمعادلات التفاضلية"',
        tool: 'transcription',
        timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      },
      {
        id: 'act_seed_1_2',
        type: 'navigation',
        title: 'فتح أداة الخرائط الذهنية',
        details: 'استعرض خريطة ذهنية لمقرر الفيزياء الذرية',
        tool: 'mindmaps',
        timestamp: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      },
      {
        id: 'act_seed_1_3',
        type: 'action',
        title: 'إنشاء ملخص ذكي PDF',
        details: 'قام برفع ملف تلخيص "مبادئ الهندسة الكهربائية" واستخراج المصطلحات',
        tool: 'summarizer',
        timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      },
      {
        id: 'act_seed_1_4',
        type: 'action',
        title: 'خاض اختباراً تفاعلياً',
        details: 'أجرى اختبار 10 أسئلة وحصل على 90%',
        tool: 'quizzes',
        timestamp: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
      },
      {
        id: 'act_seed_1_5',
        type: 'session',
        title: 'تسجيل دخول إلى المنصة',
        details: 'بدء جلسة مذاكرة (مدة الجلسة: 32 دقيقة)',
        tool: 'auth',
        timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'std_seed_2',
    name: 'سارة عبد الرحمن حسن',
    phone: '01198765432',
    passcode: '1234',
    status: 'active',
    registeredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    notes: 'تم تفعيل الحساب بعد التأكد من الاشتراك',
    totalTimeMinutes: 42,
    stats: {
      transcriptions: 2,
      summaries: 4,
      quizzes: 3,
      flashcards: 8,
    },
    activityLog: [
      {
        id: 'act_seed_2_1',
        type: 'action',
        title: 'تفريغ محاضرة صوتية',
        details: 'تفريغ صوتي لمحاضرة: "مناهج البحث العلمي وتصميم التجارب"',
        tool: 'transcription',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'act_seed_2_2',
        type: 'action',
        title: 'مراجعة بطاقات استذكار',
        details: 'قام بمراجعة 8 بطاقات في علم النفس المعرفي',
        tool: 'flashcards',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'act_seed_2_3',
        type: 'navigation',
        title: 'فتح المساعد الدراسي الذكي',
        details: 'سأل المساعد عن الفرق بين الفرضية الصفرية والبديلة',
        tool: 'assistant',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'std_seed_3',
    name: 'عمر خالد إبراهيم',
    phone: '01234567890',
    passcode: '1234',
    status: 'active',
    registeredAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    notes: 'طالب مسجل - مفعل فورياً',
    totalTimeMinutes: 15,
    stats: {
      transcriptions: 0,
      summaries: 0,
      quizzes: 0,
      flashcards: 0,
    },
    activityLog: [
      {
        id: 'act_seed_3_1',
        type: 'session',
        title: 'إنشاء الحساب والدخول الأول',
        details: 'سجل حسابه بالاسم ورقم الهاتف ودخل فوراً للمنصة',
        tool: 'auth',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'act_seed_3_2',
        type: 'navigation',
        title: 'فتح الصفحة الرئيسية واستعراض الأدوات',
        details: 'استعرض أدوات تفريغ المحاضرات والملخصات والخرائط الذهنية',
        tool: 'home',
        timestamp: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
      },
    ],
  },
];

class StudentStore {
  private data: StoreData = {
    settings: { ...DEFAULT_SETTINGS },
    students: [...SEED_STUDENTS],
  };

  constructor() {
    this.init();
  }

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
          // Ensure settings defaults
          this.data.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };

          let modified = false;
          this.data.students.forEach((s) => {
            if (!s.passcode) {
              s.passcode = '1234';
              modified = true;
            }
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
    return { ...this.data.settings };
  }

  public updateSettings(newSettings: Partial<AdminSettings>): AdminSettings {
    this.data.settings = {
      ...this.data.settings,
      ...newSettings,
    };
    this.saveToFile();
    return { ...this.data.settings };
  }

  public getStudents(): Student[] {
    return [...this.data.students];
  }

  public findStudentByPhone(phone: string): Student | undefined {
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    return this.data.students.find((s) => s.phone.replace(/\s+/g, '') === cleanPhone);
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
  ): { student: Student; isNew: boolean } {
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    const cleanName = name.trim();
    const cleanPasscode = passcode.trim() || '1234';
    const cleanGoogle = googleAccount?.trim() || undefined;
    const now = new Date().toISOString();

    let existing = this.data.students.find(
      (s) => s.phone.replace(/\s+/g, '') === cleanPhone
    );

    if (existing) {
      existing.lastLoginAt = now;
      if (cleanName && cleanName.length >= 2) {
        existing.name = cleanName;
      }
      existing.passcode = cleanPasscode;
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
      this.saveToFile();
      return { student: existing, isNew: false };
    }

    // Create new student - default to active for immediate access
    const newStudent: Student = {
      id: `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      phone: cleanPhone,
      passcode: cleanPasscode,
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
    this.saveToFile();
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
    if (student.passcode && student.passcode !== cleanPasscode) {
      return {
        success: false,
        error: 'الرقم السري غير صحيح. يُرجى التأكد وإعادة المحاولة.',
      };
    }

    if (!student.passcode) {
      student.passcode = cleanPasscode;
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
    this.saveToFile();

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

    this.saveToFile();
    return true;
  }

  public incrementStudentTime(phone: string, deltaMinutes: number = 1): number {
    const student = this.findStudentByPhone(phone);
    if (!student) return 0;

    student.totalTimeMinutes = (student.totalTimeMinutes || 0) + deltaMinutes;
    student.lastLoginAt = new Date().toISOString();
    this.saveToFile();
    return student.totalTimeMinutes;
  }

  public updateStudentPasscode(id: string, newPasscode: string): Student | null {
    const student = this.data.students.find((s) => s.id === id);
    if (!student) return null;

    student.passcode = newPasscode.trim();
    this.logStudentActivity(student.phone, {
      type: 'action',
      title: 'تعديل الرقم السري',
      details: 'قام المشرف بتحديث الرقم السري لحساب الطالب',
      tool: 'admin',
    });
    this.saveToFile();
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
    this.saveToFile();
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
      passcode: cleanPasscode,
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

    this.saveToFile();
    return studentObj;
  }

  public deleteStudent(id: string): boolean {
    const prevLen = this.data.students.length;
    this.data.students = this.data.students.filter((s) => s.id !== id);
    if (this.data.students.length !== prevLen) {
      this.saveToFile();
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

      this.saveToFile();
    }
  }
}

export const studentStore = new StudentStore();
