import React, { useState, useEffect, useRef } from 'react';
import {
  CalendarCheck,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Edit2,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Filter,
  X,
} from 'lucide-react';
import { StudyTask } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface StudyPlannerProps {
  tasks: StudyTask[];
  onUpdateTasks: (tasks: StudyTask[]) => void;
  onAddStudyMinutes: (minutes: number) => void;
}

export const StudyPlanner: React.FC<StudyPlannerProps> = ({
  tasks,
  onUpdateTasks,
  onAddStudyMinutes,
}) => {
  const { t } = useLanguage();
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<StudyTask | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskSubject, setTaskSubject] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskMinutes, setTaskMinutes] = useState(30);

  const POMODORO_WORK_SECONDS = 25 * 60;
  const POMODORO_BREAK_SECONDS = 5 * 60;
  const [timerSeconds, setTimerSeconds] = useState(POMODORO_WORK_SECONDS);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<'work' | 'break'>('work');
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            if (timerMode === 'work') {
              onAddStudyMinutes(25);
              setTimerMode('break');
              return POMODORO_BREAK_SECONDS;
            } else {
              setTimerMode('work');
              return POMODORO_WORK_SECONDS;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isTimerRunning, timerMode, onAddStudyMinutes, POMODORO_BREAK_SECONDS, POMODORO_WORK_SECONDS]);

  const handleToggleComplete = (id: string) => {
    onUpdateTasks(tasks.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)));
  };

  const handleDeleteTask = (id: string) => {
    onUpdateTasks(tasks.filter((task) => task.id !== id));
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const fallbackSubject = t.tabs.planner.label;
    const fallbackDue = t.planner.taskDuePlaceholder.split(',')[0].trim();

    if (editingTask) {
      onUpdateTasks(
        tasks.map((task) =>
          task.id === editingTask.id
            ? {
                ...task,
                title: taskTitle.trim(),
                subject: taskSubject.trim() || fallbackSubject,
                dueDate: taskDueDate.trim() || fallbackDue,
                priority: taskPriority,
                estimatedMinutes: taskMinutes,
              }
            : task
        )
      );
      setEditingTask(null);
    } else {
      const newTask: StudyTask = {
        id: `task-${Date.now()}`,
        title: taskTitle.trim(),
        subject: taskSubject.trim() || fallbackSubject,
        dueDate: taskDueDate.trim() || fallbackDue,
        priority: taskPriority,
        completed: false,
        estimatedMinutes: taskMinutes,
      };
      onUpdateTasks([...tasks, newTask]);
    }

    setTaskTitle('');
    setTaskSubject('');
    setTaskDueDate('');
    setTaskPriority('medium');
    setTaskMinutes(30);
    setShowAddModal(false);
  };

  const startEdit = (task: StudyTask) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskSubject(task.subject);
    setTaskDueDate(task.dueDate);
    setTaskPriority(task.priority);
    setTaskMinutes(task.estimatedMinutes);
    setShowAddModal(true);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const subjects = Array.from(new Set(tasks.map((task) => task.subject)));
  const filteredTasks =
    filterSubject === 'all' ? tasks : tasks.filter((task) => task.subject === filterSubject);

  const completedCount = tasks.filter((task) => task.completed).length;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-rose-500 dark:text-rose-400" />
            <span>{t.planner.title}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {t.planner.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingTask(null);
            setTaskTitle('');
            setTaskSubject('');
            setTaskDueDate('');
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.planner.addTaskBtn}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pomodoro Timer */}
        <div className="lg:col-span-1 rounded-3xl bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center justify-between shadow-2xl relative overflow-hidden">
          <div className="w-full flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-3 border-b border-slate-200 dark:border-slate-800/80 gap-2">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>{t.planner.pomodoroTitle}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setIsTimerRunning(false);
                if (timerMode === 'work') {
                  setTimerMode('break');
                  setTimerSeconds(POMODORO_BREAK_SECONDS);
                } else {
                  setTimerMode('work');
                  setTimerSeconds(POMODORO_WORK_SECONDS);
                }
              }}
              className={`px-2.5 py-1 rounded-full font-bold cursor-pointer transition ${
                timerMode === 'work'
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25'
              }`}
            >
              {timerMode === 'work' ? t.planner.focusBadge : t.planner.breakBadge}
            </button>
          </div>

          <div className="my-6 relative flex items-center justify-center">
            <div className="w-44 h-44 rounded-full border-4 border-slate-200 dark:border-slate-800 flex items-center justify-center relative bg-slate-50 dark:bg-slate-950/60 shadow-inner">
              <div
                className={`absolute inset-0 rounded-full border-4 border-t-transparent transition-colors ${
                  isTimerRunning ? 'animate-spin-slow' : ''
                } ${timerMode === 'work' ? 'border-teal-500 dark:border-teal-400' : 'border-emerald-500 dark:border-emerald-400'}`}
              />
              <div className="text-center">
                <div className="text-4xl font-mono font-black text-slate-900 dark:text-white tracking-wider">
                  {formatTimer(timerSeconds)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {timerMode === 'work' ? t.planner.focusDuration : t.planner.breakDuration}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-bold text-xs sm:text-sm shadow-md transition transform active:scale-95 cursor-pointer ${
                isTimerRunning
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-slate-950'
              }`}
            >
              {isTimerRunning ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>{t.planner.pauseBtn}</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>{t.planner.startBtn}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsTimerRunning(false);
                setTimerSeconds(timerMode === 'work' ? POMODORO_WORK_SECONDS : POMODORO_BREAK_SECONDS);
              }}
              className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              title={t.common.reset}
              aria-label={t.common.reset}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-4 text-[11px] text-center text-slate-500 dark:text-slate-400">
            {t.planner.timerNote}
          </p>
        </div>

        {/* Task List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1 font-semibold">
                <Filter className="w-3.5 h-3.5" />
                <span>{t.planner.subjectFilter}</span>
              </span>
              <button
                type="button"
                onClick={() => setFilterSubject('all')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  filterSubject === 'all'
                    ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {t.common.all} ({tasks.length})
              </button>
              {subjects.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setFilterSubject(sub)}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    filterSubject === sub
                      ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>

            <div className="text-slate-600 dark:text-slate-400 font-medium">
              {t.planner.completedOf
                .replace('{done}', String(completedCount))
                .replace('{total}', String(tasks.length))}
            </div>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pe-1">
            {filteredTasks.map((task) => {
              const priorityStyles = {
                high: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25',
                medium: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
                low: 'bg-slate-200 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
              };

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    task.completed
                      ? 'bg-slate-100/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 opacity-65'
                      : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-teal-500/40 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(task.id)}
                      className="text-teal-600 dark:text-teal-400 hover:text-teal-500 transition flex-shrink-0 cursor-pointer"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-teal-500 fill-teal-400/20" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-400 dark:text-slate-600 hover:text-teal-500" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-semibold truncate ${
                          task.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {task.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {task.subject}
                        </span>
                        <span>•</span>
                        <span>
                          {t.planner.duePrefix} {task.dueDate}
                        </span>
                        <span>•</span>
                        <span>
                          {task.estimatedMinutes} {t.planner.minsSuffix}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityStyles[task.priority]}`}
                    >
                      {task.priority === 'high'
                        ? t.planner.priHigh
                        : task.priority === 'medium'
                        ? t.planner.priMed
                        : t.planner.priLow}
                    </span>

                    <button
                      type="button"
                      onClick={() => startEdit(task)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
                      title={t.common.edit}
                      aria-label={t.common.edit}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-rose-500 transition cursor-pointer"
                      title={t.common.delete}
                      aria-label={t.common.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredTasks.length === 0 && (
              <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                {t.planner.emptyTasks}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{editingTask ? t.planner.modalEdit : t.planner.modalAdd}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t.planner.taskTitleLabel}
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder={t.planner.taskTitlePlaceholder}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t.planner.taskSubjectLabel}
                  </label>
                  <input
                    type="text"
                    value={taskSubject}
                    onChange={(e) => setTaskSubject(e.target.value)}
                    placeholder={t.planner.taskSubjectPlaceholder}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t.planner.taskDueLabel}
                  </label>
                  <input
                    type="text"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    placeholder={t.planner.taskDuePlaceholder}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t.planner.taskPriLabel}
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="low">{t.planner.priLow}</option>
                    <option value="medium">{t.planner.priMed}</option>
                    <option value="high">{t.planner.priHigh}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t.planner.taskMinsLabel}
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={taskMinutes}
                    onChange={(e) => setTaskMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold cursor-pointer"
                >
                  {editingTask ? t.planner.updateBtn : t.planner.createBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
