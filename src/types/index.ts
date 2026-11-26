export type LanguageCode =
  | 'ar'
  | 'en'
  | 'fr'
  | 'es'
  | 'de'
  | 'tr'
  | 'pt'
  | 'id'
  | 'hi'
  | 'ru';

export type ThemeMode = 'dark' | 'light';

export type DashboardTab =
  | 'home'
  | 'assistant'
  | 'summarizer'
  | 'pdf_reader'
  | 'transcription'
  | 'mindmaps'
  | 'quizzes'
  | 'flashcards'
  | 'studylab'
  | 'planner'
  | 'saved'
  | 'progress'
  | 'share'
  | 'contact'
  | 'about'
  | 'admin';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: string;
  isLiveAi?: boolean;
  sources?: { n: number; text: string }[];
}

export interface SummaryResult {
  title: string;
  overview: string;
  mainPoints: string[];
  definitions: { term: string; definition: string }[];
  examTips: string[];
  isAiGenerated?: boolean;
  engine?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: 'mcq' | 'true_false';
  options: string[];
  correctAnswer: string;
  explanation: string;
  userAnswer?: string;
  isCorrect?: boolean;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  mastered?: boolean;
}

export interface MindMapNode {
  id: string;
  label: string;
  description?: string;
  children?: MindMapNode[];
  color?: string;
}

export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  estimatedMinutes: number;
}

export interface SavedMaterial {
  id: string;
  title: string;
  type: 'summary' | 'quiz' | 'flashcards' | 'note' | 'transcription' | 'mindmap';
  content: any;
  createdAt: string;
  subject: string;
  tags: string[];
}

export interface UserProgress {
  streakDays: number;
  totalStudyMinutes: number;
  quizzesTaken: number;
  averageQuizScore: number;
  cardsMastered: number;
  summariesCreated: number;
  tasksCompleted: number;
  dailyMinutes: { day: string; minutes: number }[];
}

export interface StudentStats {
  transcriptions: number;
  summaries: number;
  quizzes: number;
  flashcards: number;
}

export interface StudentActivityEntry {
  id: string;
  type: 'navigation' | 'action' | 'session';
  title: string;
  details?: string;
  tool?: string;
  timestamp: string;
  durationMinutes?: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'motivation' | 'reminder' | 'feature' | 'system';
  read?: boolean;
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  passcode?: string;
  passhash?: string;
  googleAccount?: string;
  status: 'active' | 'pending' | 'blocked';
  registeredAt: string;
  lastLoginAt: string;
  notes?: string;
  stats?: StudentStats;
  totalTimeMinutes?: number;
  activityLog?: StudentActivityEntry[];
}

export interface AdminSettings {
  adminPasscode: string;
  autoApprove: boolean;
  requirePhoneVerification: boolean;
}

export interface AuthState {
  isLoggedIn: boolean;
  role: 'student' | 'admin' | null;
  currentStudent: Student | null;
}
