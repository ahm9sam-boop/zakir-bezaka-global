import React, { useState } from 'react';
import {
  User,
  Phone,
  Shield,
  Key,
  LogIn,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  GraduationCap,
  Eye,
  EyeOff,
  Lock,
  Mail,
  X,
  Info,
} from 'lucide-react';
import { Student } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageThemeControls } from './LanguageThemeControls';

interface StudentAuthModalProps {
  isOpen: boolean;
  onStudentLoginSuccess: (student: Student) => void;
  onAdminLoginSuccess: () => void;
  onClose?: () => void;
  canDismiss?: boolean;
  onOpenAbout?: () => void;
}

export const StudentAuthModal: React.FC<StudentAuthModalProps> = ({
  isOpen,
  onStudentLoginSuccess,
  onAdminLoginSuccess,
  onClose,
  canDismiss = true,
  onOpenAbout,
}) => {
  const { t } = useLanguage();
  const [mainTab, setMainTab] = useState<'student' | 'admin'>('student');
  const [studentMode, setStudentMode] = useState<'login' | 'register'>('login');

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [showLoginPasscode, setShowLoginPasscode] = useState(false);

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regGoogleAccount, setRegGoogleAccount] = useState('');
  const [regPasscode, setRegPasscode] = useState('');
  const [regPasscodeConfirm, setRegPasscodeConfirm] = useState('');
  const [showRegPasscode, setShowRegPasscode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [adminPasscode, setAdminPasscode] = useState('');
  const [showAdminPasscode, setShowAdminPasscode] = useState(false);

  if (!isOpen) return null;

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedIdentifier = loginIdentifier.trim();
    const trimmedPasscode = loginPasscode.trim();

    if (!trimmedIdentifier || trimmedIdentifier.length < 2) {
      setErrorMessage(t.auth.errors.badIdentifier);
      return;
    }

    if (!trimmedPasscode) {
      setErrorMessage(t.auth.errors.noPasscode);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: trimmedIdentifier,
          passcode: trimmedPasscode,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.student) {
        setSuccessMessage(t.auth.welcomeSuccess.replace('{name}', data.student.name));
        setTimeout(() => {
          onStudentLoginSuccess(data.student);
        }, 400);
      } else {
        setErrorMessage(data.error || t.auth.errors.loginFailed);
      }
    } catch {
      setErrorMessage(t.auth.errors.network);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = regName.trim();
    const trimmedPhone = regPhone.trim().replace(/\s+/g, '');
    const trimmedPasscode = regPasscode.trim();
    const trimmedConfirm = regPasscodeConfirm.trim();
    const trimmedGoogle = regGoogleAccount.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage(t.auth.errors.badName);
      return;
    }

    if (!trimmedPhone || trimmedPhone.length < 6) {
      setErrorMessage(t.auth.errors.badPhone);
      return;
    }

    if (!trimmedPasscode || trimmedPasscode.length < 3) {
      setErrorMessage(t.auth.errors.shortPasscode);
      return;
    }

    if (trimmedConfirm && trimmedPasscode !== trimmedConfirm) {
      setErrorMessage(t.auth.errors.passMismatch);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/student-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          phone: trimmedPhone,
          passcode: trimmedPasscode,
          googleAccount: trimmedGoogle || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.student) {
        setSuccessMessage(t.auth.registerSuccess);
        setTimeout(() => {
          onStudentLoginSuccess(data.student);
        }, 400);
      } else {
        setErrorMessage(data.error || t.auth.errors.regFailed);
      }
    } catch {
      setErrorMessage(t.auth.errors.network);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!adminPasscode.trim()) {
      setErrorMessage(t.auth.errors.noAdminPin);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: adminPasscode.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onAdminLoginSuccess();
      } else {
        setErrorMessage(data.error || t.auth.errors.badAdminPin);
      }
    } catch {
      setErrorMessage(t.auth.errors.network);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-5 shadow-2xl relative my-auto animate-fadeIn">
        {/* Top Controls: Language/Theme + Dismiss */}
        <div className="flex items-center justify-between gap-2">
          <LanguageThemeControls compact />

          {canDismiss && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 cursor-pointer"
              title={t.common.close}
              aria-label={t.common.close}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 mx-auto shadow-lg shadow-emerald-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <GraduationCap className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-wide">
            {t.auth.title}
          </h2>
          <div className="flex items-center justify-center">
            <span className="text-xs text-teal-700 dark:text-teal-300 font-semibold bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
              {t.auth.badge}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">{t.auth.subtitle}</p>
        </div>

        {/* Main Tab Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMainTab('student');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
              mainTab === 'student'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>{t.auth.studentTab}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMainTab('admin');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
              mainTab === 'admin'
                ? 'bg-teal-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>{t.auth.adminTab}</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* STUDENT PORTAL */}
        {mainTab === 'student' && (
          <div className="space-y-4">
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950/70 p-1 border border-slate-200 dark:border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setStudentMode('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  studentMode === 'login'
                    ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t.auth.loginTab}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStudentMode('register');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  studentMode === 'register'
                    ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t.auth.registerTab}</span>
              </button>
            </div>

            {studentMode === 'login' && (
              <form onSubmit={handleStudentLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{t.auth.identifierLabel}</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder={t.auth.identifierPlaceholder}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{t.auth.passcodeLabel}</span>
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{t.auth.passcodeHint}</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showLoginPasscode ? 'text' : 'password'}
                      required
                      value={loginPasscode}
                      onChange={(e) => setLoginPasscode(e.target.value)}
                      placeholder={t.auth.passcodePlaceholder}
                      className="w-full pe-11 ps-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPasscode(!showLoginPasscode)}
                      className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showLoginPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t.auth.loggingIn}</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>{t.auth.loginBtn}</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStudentMode('register');
                      setErrorMessage(null);
                    }}
                    className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 font-bold underline underline-offset-4 cursor-pointer"
                  >
                    {t.auth.noAccountCta}
                  </button>
                </div>
              </form>
            )}

            {studentMode === 'register' && (
              <form onSubmit={handleStudentRegister} className="space-y-3.5">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>
                    <strong>{t.auth.instantTitle}</strong> {t.auth.instantBody}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{t.auth.fullNameLabel}</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder={t.auth.fullNamePlaceholder}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{t.auth.phoneLabel}</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder={t.auth.phonePlaceholder}
                    dir="ltr"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.auth.phoneHint}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>{t.auth.googleLabel}</span>
                  </label>
                  <input
                    type="email"
                    value={regGoogleAccount}
                    onChange={(e) => setRegGoogleAccount(e.target.value)}
                    placeholder={t.auth.googlePlaceholder}
                    dir="ltr"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{t.auth.createPassLabel}</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPasscode ? 'text' : 'password'}
                        required
                        value={regPasscode}
                        onChange={(e) => setRegPasscode(e.target.value)}
                        placeholder={t.auth.passcodePlaceholder}
                        className="w-full pe-9 ps-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPasscode(!showRegPasscode)}
                        className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 cursor-pointer"
                      >
                        {showRegPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{t.auth.confirmPassLabel}</span>
                    </label>
                    <input
                      type={showRegPasscode ? 'text' : 'password'}
                      required
                      value={regPasscodeConfirm}
                      onChange={(e) => setRegPasscodeConfirm(e.target.value)}
                      placeholder={t.auth.passcodePlaceholder}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t.auth.creatingBtn}</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>{t.auth.registerBtn}</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStudentMode('login');
                      setErrorMessage(null);
                    }}
                    className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    {t.auth.haveAccountPrefix}{' '}
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{t.auth.hasAccountCta}</span>
                  </button>
                </div>
              </form>
            )}

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed space-y-1">
              <div className="font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>{t.auth.toolsNoteTitle}</span>
              </div>
              <p>{t.auth.toolsNoteBody}</p>
            </div>
          </div>
        )}

        {/* ADMIN TAB */}
        {mainTab === 'admin' && (
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{t.auth.adminPinLabel}</span>
              </label>
              <div className="relative">
                <input
                  type={showAdminPasscode ? 'text' : 'password'}
                  required
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  placeholder={t.auth.adminPinPlaceholder}
                  className="w-full pe-11 ps-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono text-center text-lg tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPasscode(!showAdminPasscode)}
                  className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 cursor-pointer"
                >
                  {showAdminPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold text-sm shadow-xl shadow-teal-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t.auth.checkingBtn}</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>{t.auth.adminLoginBtn}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer links: Guest & About/Privacy */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          {canDismiss && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-semibold transition cursor-pointer"
            >
              {t.auth.continueGuest}
            </button>
          ) : (
            <span />
          )}

          {onOpenAbout && (
            <button
              type="button"
              onClick={onOpenAbout}
              className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
              <span>{t.auth.aboutLink}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
