import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  Clock,
  UserX,
  Search,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Key,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Phone,
  Calendar,
  Activity,
  FileSpreadsheet,
  Edit3,
  Save,
  X,
  AlertCircle,
  Shield,
  Eye,
  EyeOff,
  History,
  Bot,
  FileText,
  Mic,
  GitFork,
  HelpCircle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Student } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface AdminControlPanelProps {
  onClose?: () => void;
  onLogoutAdmin: () => void;
}

export const AdminControlPanel: React.FC<AdminControlPanelProps> = ({
  onLogoutAdmin,
}) => {
  const { t, langMeta } = useLanguage();
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    pending: 0,
    blocked: 0,
  });
  const [autoApprove, setAutoApprove] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'blocked'>('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [newStudentPasscode, setNewStudentPasscode] = useState('1234');
  const [newStudentNotes, setNewStudentNotes] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  const [revealedPasscodes, setRevealedPasscodes] = useState<Record<string, boolean>>({});
  const [studentToEditPasscode, setStudentToEditPasscode] = useState<{
    id: string;
    name: string;
    currentPasscode?: string;
  } | null>(null);
  const [targetNewPasscode, setTargetNewPasscode] = useState('');
  const [isSavingStudentPasscode, setIsSavingStudentPasscode] = useState(false);

  const [selectedStudentForLog, setSelectedStudentForLog] = useState<Student | null>(null);
  const [activityFilter, setActivityFilter] = useState<'all' | 'navigation' | 'action' | 'session'>('all');

  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [newPasscode, setNewPasscode] = useState('');
  const [passcodeSuccess, setPasscodeSuccess] = useState(false);

  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');

  const [studentToDelete, setStudentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const formatDuration = (minutes: number = 0): string => {
    if (!minutes || minutes <= 0) return `< 1 ${t.common.minShort}`;
    if (minutes < 60) return `${minutes} ${t.common.minutes}`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    if (rem === 0) return `${hours} ${t.common.hours}`;
    return `${hours}${t.common.hours.slice(0, 1)} ${rem}${t.common.minShort}`;
  };

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const getStatusLabel = (status: 'active' | 'pending' | 'blocked') => {
    switch (status) {
      case 'active':
        return t.admin.statusActive;
      case 'pending':
        return t.admin.statusPending;
      case 'blocked':
        return t.admin.statusBlocked;
    }
  };

  const fetchOverview = async () => {
    setIsLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/admin/overview');
      if (!res.ok) {
        setErrorBanner(t.common.error);
        return;
      }
      const data = await res.json();
      setStudents(data.students || []);
      setSummary(data.summary || { total: 0, active: 0, pending: 0, blocked: 0 });
      setAutoApprove(Boolean(data.settings?.autoApprove));
    } catch {
      setErrorBanner(t.auth.errors.network);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleStatusChange = async (studentId: string, newStatus: 'active' | 'pending' | 'blocked') => {
    try {
      const res = await fetch('/api/admin/student/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, status: newStatus }),
      });
      if (res.ok) {
        setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, status: newStatus } : s)));
        fetchOverview();
        showFeedback(getStatusLabel(newStatus));
      }
    } catch {
      setErrorBanner(t.common.error);
    }
  };

  const confirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    const { id, name } = studentToDelete;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/student/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setStudents((prev) => prev.filter((s) => s.id !== id));
        fetchOverview();
        showFeedback(`${t.common.delete}: ${name}`);
      }
    } catch {
      setErrorBanner(t.common.error);
    } finally {
      setIsDeleting(false);
      setStudentToDelete(null);
    }
  };

  const handleToggleAutoApprove = async () => {
    const nextVal = !autoApprove;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoApprove: nextVal }),
      });
      if (res.ok) {
        setAutoApprove(nextVal);
        showFeedback(nextVal ? t.admin.autoApproveDescOn : t.admin.autoApproveDescOff);
      }
    } catch {
      setErrorBanner(t.common.error);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentPhone.trim()) return;

    setIsSubmittingNew(true);
    try {
      const res = await fetch('/api/admin/student/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStudentName.trim(),
          phone: newStudentPhone.trim(),
          passcode: newStudentPasscode.trim() || '1234',
          status: 'active',
          notes: newStudentNotes.trim(),
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewStudentName('');
        setNewStudentPhone('');
        setNewStudentPasscode('1234');
        setNewStudentNotes('');
        fetchOverview();
        showFeedback(t.admin.addModalSubmit);
      }
    } catch {
      setErrorBanner(t.common.error);
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleSaveStudentPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentToEditPasscode || !targetNewPasscode.trim() || targetNewPasscode.trim().length < 3) return;

    setIsSavingStudentPasscode(true);
    try {
      const res = await fetch(`/api/admin/student/${studentToEditPasscode.id}/passcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: targetNewPasscode.trim() }),
      });

      if (res.ok) {
        setStudents((prev) =>
          prev.map((s) =>
            s.id === studentToEditPasscode.id ? { ...s, passcode: targetNewPasscode.trim() } : s
          )
        );
        showFeedback(t.admin.savePassBtn);
        setStudentToEditPasscode(null);
        setTargetNewPasscode('');
      }
    } catch {
      setErrorBanner(t.common.error);
    } finally {
      setIsSavingStudentPasscode(false);
    }
  };

  const handleSaveNotes = async (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    try {
      const res = await fetch('/api/admin/student/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          status: student.status,
          notes: tempNotes,
        }),
      });

      if (res.ok) {
        setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, notes: tempNotes } : s)));
        setEditingNotesId(null);
        showFeedback(t.common.saved);
      }
    } catch {
      setErrorBanner(t.common.error);
    }
  };

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasscode.length < 4) return;

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPasscode }),
      });

      if (res.ok) {
        setPasscodeSuccess(true);
        setTimeout(() => {
          setPasscodeSuccess(false);
          setShowPasscodeModal(false);
          setNewPasscode('');
        }, 1200);
        showFeedback(t.admin.pinSuccessMsg);
      }
    } catch {
      setErrorBanner(t.common.error);
    }
  };

  const handleExportCSV = () => {
    const headers = 'Name,Phone,Passcode,Status,TimeMinutes,RegisteredAt,LastLoginAt,Transcriptions,Summaries,Quizzes,Notes\n';
    const rows = students
      .map((s) => {
        const st = getStatusLabel(s.status);
        const passcode = s.passcode || '1234';
        const timeMinutes = s.totalTimeMinutes || 0;
        const reg = s.registeredAt ? new Date(s.registeredAt).toLocaleDateString(langMeta.locale) : '';
        const login = s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString(langMeta.locale) : '';
        const trans = s.stats?.transcriptions || 0;
        const sums = s.stats?.summaries || 0;
        const quiz = s.stats?.quizzes || 0;
        const notes = (s.notes || '').replace(/,/g, ' - ');
        return `"${s.name}","${s.phone}","${passcode}","${st}",${timeMinutes},"${reg}","${login}",${trans},${sums},${quiz},"${notes}"`;
      })
      .join('\n');

    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `students-list-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery);
    const matchesFilter = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-white to-teal-500/10 dark:from-emerald-950/60 dark:via-slate-900 dark:to-teal-950/60 border border-emerald-500/30 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner shrink-0">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-wide">
                {t.admin.title}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {t.admin.badge}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
              {t.admin.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={fetchOverview}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            aria-label={t.common.retry}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowPasscodeModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            <Key className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span>{t.admin.changePin}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.admin.addStudent}</span>
          </button>

          <button
            type="button"
            onClick={onLogoutAdmin}
            className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-500/20 transition cursor-pointer"
          >
            {t.admin.exitAdmin}
          </button>
        </div>
      </div>

      {errorBanner && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {feedbackMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button type="button" onClick={() => setFeedbackMessage(null)} className="text-emerald-600 dark:text-emerald-400 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>{t.admin.totalStudents}</span>
            <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">{summary.total}</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.admin.totalSub}</p>
        </div>

        <div className="p-5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/30 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-xs font-medium">
            <span>{t.admin.activeStudents}</span>
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">{summary.active}</div>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">{t.admin.activeSub}</p>
        </div>

        <div className="p-5 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/30 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 text-xs font-medium">
            <span>{t.admin.pendingStudents}</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 dark:text-amber-300">{summary.pending}</div>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80">{t.admin.pendingSub}</p>
        </div>

        <div className="p-5 rounded-2xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/30 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-300 text-xs font-medium">
            <span>{t.admin.blockedStudents}</span>
            <UserX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-700 dark:text-rose-300">{summary.blocked}</div>
          <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">{t.admin.blockedSub}</p>
        </div>
      </div>

      {/* Auto Approve & Filter Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleToggleAutoApprove}
              className={`p-1.5 px-3 rounded-xl border flex items-center gap-2 transition cursor-pointer ${
                autoApprove
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              {autoApprove ? (
                <ToggleRight className="w-6 h-6 text-emerald-500" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-slate-400" />
              )}
              <span className="text-xs font-bold">
                {autoApprove ? t.admin.autoApproveOn : t.admin.autoApproveOff}
              </span>
            </button>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {autoApprove ? t.admin.autoApproveDescOn : t.admin.autoApproveDescOff}
            </span>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>{t.admin.exportCsv}</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.admin.searchPlaceholder}
              className="w-full ps-10 pe-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {(
              [
                { id: 'all', label: `${t.admin.filterAll} (${students.length})`, activeCls: 'bg-slate-800 text-white' },
                { id: 'active', label: `${t.admin.filterActive} (${summary.active})`, activeCls: 'bg-emerald-600 text-white' },
                { id: 'pending', label: `${t.admin.filterPending} (${summary.pending})`, activeCls: 'bg-amber-600 text-white' },
                { id: 'blocked', label: `${t.admin.filterBlocked} (${summary.blocked})`, activeCls: 'bg-rose-600 text-white' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  statusFilter === f.id
                    ? `${f.activeCls} shadow`
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
            <span>{t.admin.loading}</span>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-400" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-300">{t.admin.emptyTitle}</p>
            <p className="text-xs text-slate-500">{t.admin.emptySub}</p>
          </div>
        ) : (
          filteredStudents.map((student) => {
            const isEditing = editingNotesId === student.id;
            const regDate = student.registeredAt
              ? new Date(student.registeredAt).toLocaleDateString(langMeta.locale, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : '-';
            const lastLogin = student.lastLoginAt
              ? new Date(student.lastLoginAt).toLocaleTimeString(langMeta.locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '-';

            return (
              <div
                key={student.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition space-y-4 shadow-md"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">{student.name}</span>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                          student.status === 'active'
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : student.status === 'pending'
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300 animate-pulse'
                            : 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {student.status === 'active' && <CheckCircle className="w-3 h-3" />}
                        {student.status === 'pending' && <Clock className="w-3 h-3" />}
                        {student.status === 'blocked' && <XCircle className="w-3 h-3" />}
                        <span>{getStatusLabel(student.status)}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1 font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                        <Phone className="w-3.5 h-3.5" />
                        <span dir="ltr">{student.phone}</span>
                      </span>

                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs font-mono">
                        <Key className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                        <span className="text-slate-500 dark:text-slate-400 font-sans text-[11px]">
                          {t.admin.passcodeLabel}
                        </span>
                        <span className="text-amber-700 dark:text-amber-300 font-bold tracking-wider">
                          {revealedPasscodes[student.id] ? student.passcode || '1234' : '••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedPasscodes((prev) => ({ ...prev, [student.id]: !prev[student.id] }))
                          }
                          className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                        >
                          {revealedPasscodes[student.id] ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStudentToEditPasscode({
                              id: student.id,
                              name: student.name,
                              currentPasscode: student.passcode,
                            });
                            setTargetNewPasscode(student.passcode || '');
                          }}
                          className="text-slate-500 hover:text-amber-500 p-0.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </span>

                      {student.googleAccount && (
                        <span
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 text-xs text-teal-700 dark:text-teal-300 font-mono"
                          dir="ltr"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          <span>{student.googleAccount}</span>
                        </span>
                      )}

                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {t.admin.regLabel} {regDate}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {t.admin.lastSeenLabel} {lastLogin}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentForLog(student)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-xs font-bold transition shadow-sm cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>{t.admin.activityBtn}</span>
                    </button>

                    {student.status !== 'active' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.id, 'active')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{t.admin.activateBtn}</span>
                      </button>
                    )}

                    {student.status !== 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.id, 'pending')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-500/35 transition cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{t.admin.suspendBtn}</span>
                      </button>
                    )}

                    {student.status !== 'blocked' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.id, 'blocked')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-500/30 transition cursor-pointer"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>{t.admin.blockBtn}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setStudentToDelete({ id: student.id, name: student.name })}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-rose-500/15 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-slate-500 hover:text-rose-500 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stats & Notes */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {student.stats?.transcriptions || 0}
                      </span>
                      <span>{t.admin.lecturesUnit}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-bold text-teal-600 dark:text-teal-400">{student.stats?.summaries || 0}</span>
                      <span>{t.admin.summariesUnit}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {student.stats?.quizzes || 0}
                      </span>
                      <span>{t.admin.quizzesUnit}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <input
                          type="text"
                          value={tempNotes}
                          onChange={(e) => setTempNotes(e.target.value)}
                          placeholder={t.admin.notesPlaceholder}
                          className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500 w-48"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveNotes(student.id)}
                          className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNotesId(null)}
                          className="p-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <span className="text-[11px] italic">
                          {student.notes ? `${t.admin.notesPrefix} ${student.notes}` : t.admin.noNotes}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNotesId(student.id);
                            setTempNotes(student.notes || '');
                          }}
                          className="text-slate-400 hover:text-amber-500 p-0.5 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>{t.admin.addModalTitle}</span>
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-bold">{t.admin.addModalName}</label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-bold">{t.admin.addModalPhone}</label>
                <input
                  type="text"
                  required
                  value={newStudentPhone}
                  onChange={(e) => setNewStudentPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-bold">{t.admin.addModalPass}</label>
                <input
                  type="text"
                  required
                  value={newStudentPasscode}
                  onChange={(e) => setNewStudentPasscode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <p className="text-[10px] text-slate-500">{t.admin.addModalPassHint}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-bold">{t.admin.addModalNotes}</label>
                <input
                  type="text"
                  value={newStudentNotes}
                  onChange={(e) => setNewStudentNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {isSubmittingNew ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                  <span>{t.admin.addModalSubmit}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Passcode Modal */}
      {studentToEditPasscode && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                <span>{t.admin.editPassTitle}</span>
              </h3>
              <button type="button" onClick={() => setStudentToEditPasscode(null)} className="text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <p>
                {t.admin.studentLabel} <strong className="text-slate-900 dark:text-white">{studentToEditPasscode.name}</strong>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t.admin.currentPassLabel}{' '}
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {studentToEditPasscode.currentPasscode || '1234'}
                </span>
              </p>
            </div>

            <form onSubmit={handleSaveStudentPasscode} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-bold">{t.admin.newPassLabel}</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={targetNewPasscode}
                  onChange={(e) => setTargetNewPasscode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono text-center text-base"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStudentToEditPasscode(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudentPasscode}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingStudentPasscode && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t.admin.savePassBtn}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Admin Passcode Modal */}
      {showPasscodeModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                <span>{t.admin.changePinTitle}</span>
              </h3>
              <button type="button" onClick={() => setShowPasscodeModal(false)} className="text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePasscode} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-bold">{t.admin.newPinLabel}</label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono text-center text-base"
                />
              </div>

              {passcodeSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-center font-bold">
                  {t.admin.pinSuccessMsg}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasscodeModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {t.admin.savePinBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-rose-500/30 p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-500 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.admin.deleteTitle}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {t.admin.deleteConfirmText.replace('{name}', studentToDelete.name)}
              </p>
              <p className="text-[11px] text-slate-500">{t.admin.deleteWarnText}</p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                {t.admin.deleteCancel}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteStudent}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{t.admin.deleteConfirmBtn}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Activity Log Modal */}
      {selectedStudentForLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-7 space-y-5 shadow-2xl my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                      {t.admin.logTitle}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.admin.logSub}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2 text-xs text-slate-700 dark:text-slate-300 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-white text-sm bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-lg">
                    {selectedStudentForLog.name}
                  </span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400" dir="ltr">
                    {selectedStudentForLog.phone}
                  </span>
                  <span className="text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md font-mono text-[11px]">
                    {t.admin.passcodeLabel} {selectedStudentForLog.passcode || '1234'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudentForLog(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-full bg-slate-100 dark:bg-slate-800/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-shrink-0">
              <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/25 space-y-1">
                <div className="flex items-center justify-between text-teal-700 dark:text-teal-400 text-[11px]">
                  <span>{t.admin.timeSpent}</span>
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white font-mono">
                  {formatDuration(selectedStudentForLog.totalTimeMinutes || 0)}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1">
                <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-[11px]">
                  <span>{t.admin.transCount}</span>
                  <Mic className="w-3.5 h-3.5" />
                </div>
                <div className="text-base font-black text-amber-700 dark:text-amber-300 font-mono">
                  {selectedStudentForLog.stats?.transcriptions || 0}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 space-y-1">
                <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 text-[11px]">
                  <span>{t.admin.sumQuizCount}</span>
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="text-base font-black text-indigo-700 dark:text-indigo-300 font-mono">
                  {(selectedStudentForLog.stats?.summaries || 0) + (selectedStudentForLog.stats?.quizzes || 0)}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                  <span>{t.admin.eventsCount}</span>
                  <Activity className="w-3.5 h-3.5 text-teal-500" />
                </div>
                <div className="text-base font-black text-slate-900 dark:text-slate-200 font-mono">
                  {selectedStudentForLog.activityLog?.length || 0}
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-shrink-0 text-xs">
              {(
                [
                  { id: 'all', label: `${t.admin.allEvents} (${selectedStudentForLog.activityLog?.length || 0})`, activeCls: 'bg-teal-500 text-slate-950' },
                  { id: 'navigation', label: t.admin.navEvents, activeCls: 'bg-cyan-500 text-slate-950' },
                  { id: 'action', label: t.admin.actionEvents, activeCls: 'bg-emerald-500 text-slate-950' },
                  { id: 'session', label: t.admin.sessionEvents, activeCls: 'bg-amber-500 text-slate-950' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivityFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                    activityFilter === tab.id
                      ? `${tab.activeCls} shadow`
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Activity Timeline */}
            <div className="overflow-y-auto space-y-3 flex-1 pe-1 custom-scrollbar">
              {(() => {
                const logs = (selectedStudentForLog.activityLog || []).filter((log) => {
                  if (activityFilter === 'all') return true;
                  return log.type === activityFilter;
                });

                if (logs.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-1">
                      <Clock className="w-7 h-7 mx-auto text-slate-400 mb-2" />
                      <p className="font-bold text-slate-600 dark:text-slate-400">{t.admin.noLogsTitle}</p>
                      <p className="text-[11px]">{t.admin.noLogsSub}</p>
                    </div>
                  );
                }

                return logs.map((log) => {
                  const timeFormatted = log.timestamp
                    ? new Date(log.timestamp).toLocaleDateString(langMeta.locale, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-';

                  let icon = <Activity className="w-4 h-4 text-slate-400" />;
                  if (log.tool === 'transcription') icon = <Mic className="w-4 h-4 text-amber-500" />;
                  else if (log.tool === 'summarizer') icon = <FileText className="w-4 h-4 text-indigo-500" />;
                  else if (log.tool === 'pdf_reader') icon = <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
                  else if (log.tool === 'mindmaps') icon = <GitFork className="w-4 h-4 text-purple-500" />;
                  else if (log.tool === 'quizzes') icon = <HelpCircle className="w-4 h-4 text-sky-500" />;
                  else if (log.tool === 'flashcards') icon = <Layers className="w-4 h-4 text-rose-500" />;
                  else if (log.tool === 'assistant') icon = <Bot className="w-4 h-4 text-teal-500" />;
                  else if (log.tool === 'auth') icon = <Key className="w-4 h-4 text-emerald-500" />;

                  return (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex items-start gap-3 text-xs"
                    >
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex-shrink-0 mt-0.5">
                        {icon}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 dark:text-white text-sm">{log.title}</span>
                          <span className="text-[11px] text-slate-500 font-mono" dir="ltr">
                            {timeFormatted}
                          </span>
                        </div>
                        {log.details && (
                          <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">{log.details}</p>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-shrink-0 text-xs">
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                {t.admin.totalTimeFooter}{' '}
                <strong className="text-teal-700 dark:text-teal-300 font-mono">
                  {formatDuration(selectedStudentForLog.totalTimeMinutes || 0)}
                </strong>
              </span>

              <button
                type="button"
                onClick={() => setSelectedStudentForLog(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold transition cursor-pointer"
              >
                {t.common.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
