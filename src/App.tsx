import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardHome } from './components/DashboardHome';
import { AiAssistant } from './components/AiAssistant';
import { Summarizer } from './components/Summarizer';
import { PdfReader } from './components/PdfReader';
import { LectureTranscription } from './components/LectureTranscription';
import { MindMaps } from './components/MindMaps';
import { QuizGenerator } from './components/QuizGenerator';
import { FlashcardsView } from './components/FlashcardsView';
import { UpdateNotice } from './components/UpdateNotice';
import { AdSlot } from './components/AdSlot';
import { StudyLab } from './components/StudyLab';
import { StudyPlanner } from './components/StudyPlanner';
import { SavedMaterials } from './components/SavedMaterials';
import { ProgressDashboard } from './components/ProgressDashboard';
import { AdminControlPanel } from './components/AdminControlPanel';
import { StudentAuthModal } from './components/StudentAuthModal';
import { ContactUs } from './components/ContactUsModal';
import { ShareApp } from './components/ShareAppModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { AboutPrivacyPage } from './components/AboutPrivacyPage';
import { Onboarding } from './components/Onboarding';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DashboardTab, SavedMaterial, StudyTask, UserProgress, Student } from './types';
import { safeStorageGet, safeStorageSet, sanitizeMaterialForStorage } from './utils/storage';
import { useLanguage } from './contexts/LanguageContext';
import { requestAllPermissionsOnce } from './utils/native';

const VALID_TABS: DashboardTab[] = [
  'home',
  'assistant',
  'summarizer',
  'pdf_reader',
  'transcription',
  'mindmaps',
  'quizzes',
  'flashcards',
  'studylab',
  'planner',
  'saved',
  'progress',
  'share',
  'contact',
  'about',
  'admin',
];

function getInitialTab(): DashboardTab {
  if (typeof window !== 'undefined') {
    const param = new URLSearchParams(window.location.search).get('tab') as DashboardTab | null;
    if (param && VALID_TABS.includes(param)) {
      return param;
    }
  }
  return 'home';
}

export default function App() {
  const { t } = useLanguage();
  const [currentTab, setCurrentTab] = useState<DashboardTab>(getInitialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(true);

  // Auth states
  const [currentStudent, setCurrentStudent] = useState<Student | null>(() => {
    // A saved session without a sign-in token is an old one: force a fresh login.
    const st = safeStorageGet<Student | null>('zakir_current_student', null);
    if (st && !(st as any).token) { safeStorageSet('zakir_current_student', null); return null; }
    return st;
  });
  const [isAdmin, setIsAdmin] = useState<boolean>(() =>
    safeStorageGet<boolean>('zakir_is_admin', false)
  );
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(() => !safeStorageGet<any>('zakir_profile', null));
  const [showAuthModal, setShowAuthModal] = useState<boolean>(() => {
    const dismissed = safeStorageGet<boolean>('zakir_auth_dismissed', false);
    const student = safeStorageGet<Student | null>('zakir_current_student', null);
    const admin = safeStorageGet<boolean>('zakir_is_admin', false);
    return !student && !admin && !dismissed;
  });

  // Cross-tab shared study text
  const [sharedText, setSharedText] = useState<string>('');

  // Persisted materials & tasks (null triggers localized defaults)
  const [customMaterials, setCustomMaterials] = useState<SavedMaterial[] | null>(() =>
    safeStorageGet<SavedMaterial[] | null>('zakir_saved_materials', null)
  );
  const savedMaterials = customMaterials ?? ([] as SavedMaterial[]);

  const [customTasks, setCustomTasks] = useState<StudyTask[] | null>(() =>
    safeStorageGet<StudyTask[] | null>('zakir_study_tasks', null)
  );
  const tasks = customTasks ?? ([] as StudyTask[]);

  const [progress, setProgress] = useState<UserProgress>(() =>
    safeStorageGet<UserProgress>('zakir_user_progress', {
      streakDays: 0,
      totalStudyMinutes: 0,
      quizzesTaken: 0,
      averageQuizScore: 0,
      cardsMastered: 0,
      summariesCreated: 0,
      tasksCompleted: 0,
      dailyMinutes: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'].map((day) => ({ day, minutes: 0 })),
    })
  );

  // Check backend status
  useEffect(() => { requestAllPermissionsOnce(); }, []);

  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        setHasGeminiKey(Boolean(data.hasGeminiKey));
      })
      .catch(() => {
        setHasGeminiKey(false);
      });
  }, []);

  // Verify stored student status on load
  useEffect(() => {
    if (currentStudent?.phone) {
      fetch(`/api/auth/student-check?phone=${encodeURIComponent(currentStudent.phone)}`)
        .then((res) => {
          if (res.status === 401 || res.status === 404) {
            setCurrentStudent(null);
            safeStorageSet('zakir_current_student', null);
            setShowAuthModal(true);
            return {} as any;
          }
          return res.json();
        })
        .then((data) => {
          if (data.student) {
            if (data.student.status !== 'active') {
              setCurrentStudent(null);
              safeStorageSet('zakir_current_student', null);
              setShowAuthModal(true);
            } else {
              setCurrentStudent(data.student);
              safeStorageSet('zakir_current_student', data.student);
            }
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Student session heartbeat
  useEffect(() => {
    if (!currentStudent?.phone) return;

    fetch('/api/student/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentStudent.phone, deltaMinutes: 1 }),
    }).catch(() => {});

    const interval = setInterval(() => {
      fetch('/api/student/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: currentStudent.phone, deltaMinutes: 1 }),
      }).catch(() => {});
    }, 60000);

    return () => clearInterval(interval);
  }, [currentStudent?.phone]);

  // Track tab navigation for active student
  useEffect(() => {
    if (!currentStudent?.phone || currentTab === 'admin') return;

    const label = (t.tabs as any)[currentTab]?.label || currentTab;
    fetch('/api/student/activity-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: currentStudent.phone,
        type: 'navigation',
        tool: currentTab,
        title: label,
        details: (t.tabs as any)[currentTab]?.desc || label,
      }),
    }).catch(() => {});
  }, [currentTab, currentStudent?.phone, t.tabs]);

  // Persist changes safely
  useEffect(() => {
    if (customMaterials !== null) {
      safeStorageSet('zakir_saved_materials', customMaterials);
    }
  }, [customMaterials]);

  useEffect(() => {
    if (customTasks !== null) {
      safeStorageSet('zakir_study_tasks', customTasks);
    }
  }, [customTasks]);

  useEffect(() => {
    safeStorageSet('zakir_user_progress', progress);
  }, [progress]);


  const handleStudentLoginSuccess = (student: Student) => {
    setCurrentStudent(student);
    setIsAdmin(false);
    safeStorageSet('zakir_current_student', student);
    safeStorageSet('zakir_is_admin', false);
    safeStorageSet('zakir_auth_dismissed', false);
    setShowAuthModal(false);
    if (currentTab === 'admin') {
      setCurrentTab('home');
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdmin(true);
    safeStorageSet('zakir_is_admin', true);
    safeStorageSet('zakir_auth_dismissed', false);
    setShowAuthModal(false);
    setCurrentTab('admin');
  };

  const handleLogout = () => {
    setCurrentStudent(null);
    setIsAdmin(false);
    safeStorageSet('zakir_current_student', null);
    safeStorageSet('zakir_is_admin', false);
    try { localStorage.removeItem('zakir_admin_token'); } catch {}
    safeStorageSet('zakir_auth_dismissed', false);
    setShowAuthModal(true);
  };

  useEffect(() => {
    if (!isAdmin) return;
    if (!localStorage.getItem('zakir_admin_token')) { handleLogout(); return; }
    // The admin session must be real: the server has to accept the token.
    fetch('/api/admin/overview').then((r) => { if (r.status === 401) handleLogout(); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleDismissAuth = () => {
    safeStorageSet('zakir_auth_dismissed', true);
    setShowAuthModal(false);
  };

  const handleSelectSample = (sampleId: string, targetTab: DashboardTab) => {
    const sample = t.samples.find((m) => m.id === sampleId);
    if (sample) {
      setSharedText(sample.fullText);
      setCurrentTab(targetTab);
    }
  };

  const handleSaveMaterial = (item: Omit<SavedMaterial, 'id' | 'createdAt'>) => {
    const sanitized = sanitizeMaterialForStorage(item);
    const newMaterial: SavedMaterial = {
      ...sanitized,
      id: `mat-${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setCustomMaterials((prev) => [newMaterial, ...(prev ?? ([] as SavedMaterial[]))]);
  };

  const handleDeleteMaterial = (id: string) => {
    setCustomMaterials((prev) => (prev ?? ([] as SavedMaterial[])).filter((m) => m.id !== id));
  };

  const handleUpdateTasks = (nextTasks: StudyTask[]) => {
    setCustomTasks(nextTasks);
    const done = nextTasks.filter((task) => task.completed).length;
    setProgress((prev) => ({
      ...prev,
      tasksCompleted: done,
    }));
  };

  const handleAddStudyMinutes = useCallback((minutes: number) => {
    setProgress((prev) => {
      const updatedDaily = prev.dailyMinutes.map((d, idx) =>
        idx === prev.dailyMinutes.length - 1 ? { ...d, minutes: d.minutes + minutes } : d
      );
      return {
        ...prev,
        totalStudyMinutes: prev.totalStudyMinutes + minutes,
        dailyMinutes: updatedDaily,
      };
    });
  }, []);

  const handleUpdateQuizProgress = (scorePercent: number) => {
    setProgress((prev) => {
      const newCount = prev.quizzesTaken + 1;
      const newAvg = Math.round((prev.averageQuizScore * prev.quizzesTaken + scorePercent) / newCount);
      return {
        ...prev,
        quizzesTaken: newCount,
        averageQuizScore: newAvg,
      };
    });
  };

  const handleUpdateFlashcardProgress = (masteredCount: number) => {
    setProgress((prev) => ({
      ...prev,
      cardsMastered: Math.max(prev.cardsMastered, masteredCount),
    }));
  };

  const pendingTasksCount = tasks.filter((task) => !task.completed).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-teal-500 selection:text-white transition-colors">
      <OfflineIndicator />

      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        hasGeminiKey={hasGeminiKey}
        streakDays={progress.streakDays}
        studyMinutes={progress.totalStudyMinutes}
        onOpenPomodoro={() => setCurrentTab('planner')}
        currentStudent={currentStudent}
        isAdmin={isAdmin}
        onOpenAuthModal={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        <Sidebar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          savedCount={savedMaterials.length}
          tasksPendingCount={pendingTasksCount}
          isAdmin={isAdmin}
          currentStudent={currentStudent}
          onOpenAuthModal={() => setShowAuthModal(true)}
          onLogout={handleLogout}
        />

        <main className="flex-1 min-w-0 lg:ms-64 xl:ms-72 pb-20 lg:pb-6">
          {currentTab === 'admin' &&
            (isAdmin ? (
              <AdminControlPanel
                onClose={() => setCurrentTab('home')}
                onLogoutAdmin={handleLogout}
              />
            ) : (
              <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4">
                <p className="text-base font-bold text-slate-900 dark:text-white">{t.admin.adminOnlyMsg}</p>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  {t.admin.adminOnlyBtn}
                </button>
              </div>
            ))}

          {currentTab === 'home' && (
            <DashboardHome
              onTabChange={setCurrentTab}
              onSelectSample={handleSelectSample}
              streakDays={progress.streakDays}
              studyMinutes={progress.totalStudyMinutes}
              completedTasksCount={tasks.length - pendingTasksCount}
              totalTasksCount={tasks.length}
              hasGeminiKey={hasGeminiKey}
            />
          )}

          {currentTab === 'assistant' && (
            <AiAssistant
              initialContext={sharedText}
              onSaveMaterial={handleSaveMaterial}
              hasGeminiKey={hasGeminiKey}
            />
          )}

          {currentTab === 'summarizer' && (
            <Summarizer
              initialText={sharedText}
              onSaveMaterial={handleSaveMaterial}
              onSendToQuiz={(text) => {
                setSharedText(text);
                setCurrentTab('quizzes');
              }}
              hasGeminiKey={hasGeminiKey}
            />
          )}

          {currentTab === 'pdf_reader' && (
            <PdfReader
              onSendToAssistant={(text) => {
                setSharedText(text);
                setCurrentTab('assistant');
              }}
              onSendToSummarizer={(text) => {
                setSharedText(text);
                setCurrentTab('summarizer');
              }}
              onSendToQuiz={(text) => {
                setSharedText(text);
                setCurrentTab('quizzes');
              }}
              onSendToFlashcards={(text) => {
                setSharedText(text);
                setCurrentTab('flashcards');
              }}
            />
          )}

          {currentTab === 'transcription' && (
            <LectureTranscription
              onSaveMaterial={handleSaveMaterial}
              onSendToSummarizer={(text) => {
                setSharedText(text);
                setCurrentTab('summarizer');
              }}
              hasGeminiKey={hasGeminiKey}
              studentPhone={currentStudent?.phone}
            />
          )}

          {currentTab === 'mindmaps' && (
            <MindMaps
              initialTopic={sharedText.slice(0, 80)}
              hasGeminiKey={hasGeminiKey}
              onSaveMaterial={handleSaveMaterial}
            />
          )}

          {currentTab === 'quizzes' && (
            <QuizGenerator
              initialText={sharedText}
              onSaveMaterial={handleSaveMaterial}
              onUpdateQuizProgress={handleUpdateQuizProgress}
              hasGeminiKey={hasGeminiKey}
              studentPhone={currentStudent?.phone}
            />
          )}

          {currentTab === 'flashcards' && (
            <FlashcardsView
              initialText={sharedText}
              onSaveMaterial={handleSaveMaterial}
              onUpdateFlashcardProgress={handleUpdateFlashcardProgress}
              hasGeminiKey={hasGeminiKey}
              studentPhone={currentStudent?.phone}
            />
          )}

          {currentTab === 'studylab' && <StudyLab />}

          {currentTab === 'planner' && (
            <StudyPlanner
              tasks={tasks}
              onUpdateTasks={handleUpdateTasks}
              onAddStudyMinutes={handleAddStudyMinutes}
            />
          )}

          {currentTab === 'saved' && (
            <SavedMaterials
              materials={savedMaterials}
              onDeleteMaterial={handleDeleteMaterial}
              onAddMaterial={handleSaveMaterial}
            />
          )}

          {currentTab === 'progress' && <ProgressDashboard progress={progress} />}

          {currentTab === 'share' && <ShareApp />}

          {currentTab === 'contact' && <ContactUs />}

          <UpdateNotice />
          {currentTab !== 'admin' && <AdSlot className="mx-4 my-6" />}

          {currentTab === 'about' && <AboutPrivacyPage onNavigate={setCurrentTab} />}
        </main>
      </div>

      <MobileBottomNav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onOpenMenu={() => setMobileMenuOpen(true)}
        isAdmin={isAdmin}
      />

      <StudentAuthModal
        isOpen={!currentStudent && !isAdmin}
        onStudentLoginSuccess={handleStudentLoginSuccess}
        onAdminLoginSuccess={handleAdminLoginSuccess}
        canDismiss={false}
      />
      {needsOnboarding && currentStudent && !isAdmin && <Onboarding onDone={() => setNeedsOnboarding(false)} />}
    </div>
  );
}
