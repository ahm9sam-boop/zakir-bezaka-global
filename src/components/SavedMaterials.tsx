import React, { useState } from 'react';
import {
  Bookmark,
  Search,
  Trash2,
  Eye,
  FileText,
  HelpCircle,
  Layers,
  Mic,
  GitFork,
  Download,
  Calendar,
  X,
  Copy,
  Check,
  Plus,
} from 'lucide-react';
import { SavedMaterial, MindMapNode } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface SavedMaterialsProps {
  materials: SavedMaterial[];
  onDeleteMaterial: (id: string) => void;
  onAddMaterial?: (material: Omit<SavedMaterial, 'id' | 'createdAt'>) => void;
}

export const SavedMaterials: React.FC<SavedMaterialsProps> = ({
  materials,
  onDeleteMaterial,
  onAddMaterial,
}) => {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedMaterial, setSelectedMaterial] = useState<SavedMaterial | null>(null);
  const [copied, setCopied] = useState(false);

  // Manual note creation modal
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteSubject, setNoteSubject] = useState('');
  const [noteBody, setNoteBody] = useState('');

  const filtered = materials.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch =
      m.title.toLowerCase().includes(q) ||
      m.subject.toLowerCase().includes(q) ||
      m.tags.some((tag) => tag.toLowerCase().includes(q));

    const matchesType = filterType === 'all' || m.type === filterType;
    return matchesSearch && matchesType;
  });

  const getIcon = (type: SavedMaterial['type']) => {
    switch (type) {
      case 'summary':
        return <FileText className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />;
      case 'quiz':
        return <HelpCircle className="w-4 h-4 text-sky-500 dark:text-sky-400" />;
      case 'flashcards':
        return <Layers className="w-4 h-4 text-teal-500 dark:text-teal-400" />;
      case 'transcription':
        return <Mic className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
      case 'mindmap':
        return <GitFork className="w-4 h-4 text-purple-500 dark:text-purple-400" />;
      default:
        return <Bookmark className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />;
    }
  };

  const getTypeName = (type: SavedMaterial['type']) => {
    return t.saved.types[type] || t.saved.types.note;
  };

  const handleExportAll = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(materials, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `zakir_smart_library_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteBody.trim() || !onAddMaterial) return;
    onAddMaterial({
      title: noteTitle.trim(),
      type: 'note',
      subject: noteSubject.trim() || t.saved.types.note,
      tags: [t.saved.types.note],
      content: { text: noteBody.trim() },
    });
    setNoteTitle('');
    setNoteSubject('');
    setNoteBody('');
    setShowNoteModal(false);
  };

  const renderMindMapPreview = (node: MindMapNode, depth = 0): React.ReactNode => (
    <div key={node.id || node.label} className={depth > 0 ? 'ps-4 border-s-2 border-purple-500/30 mt-2' : ''}>
      <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">• {node.label}</div>
      {node.description && (
        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{node.description}</div>
      )}
      {node.children?.map((c) => renderMindMapPreview(c, depth + 1))}
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            <span>{t.saved.title}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {t.saved.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onAddMaterial && (
            <button
              type="button"
              onClick={() => setShowNoteModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-slate-950 text-xs font-bold shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.saved.newNoteBtn}</span>
            </button>
          )}

          {materials.length > 0 && (
            <button
              type="button"
              onClick={handleExportAll}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>{t.saved.exportBtn}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.saved.searchPlaceholder}
            className="w-full ps-9 pe-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs w-full md:w-auto">
          {(
            [
              { id: 'all', label: t.saved.types.all },
              { id: 'summary', label: t.saved.types.summary },
              { id: 'quiz', label: t.saved.types.quiz },
              { id: 'note', label: t.saved.types.note },
              { id: 'transcription', label: t.saved.types.transcription },
              { id: 'flashcards', label: t.saved.types.flashcards },
              { id: 'mindmap', label: t.saved.types.mindmap },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                filterType === tab.id
                  ? 'bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white bg-slate-100 dark:bg-slate-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Materials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-4 shadow-md group"
          >
            <div>
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {getIcon(item.type)}
                  <span>{getTypeName(item.type)}</span>
                </span>
                <span className="text-[11px] text-slate-500 flex items-center gap-1 shrink-0">
                  <Calendar className="w-3 h-3" />
                  <span>{item.createdAt}</span>
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition line-clamp-2">
                {item.title}
              </h3>

              <div className="flex items-center gap-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-[11px]">
                  {item.subject}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setSelectedMaterial(item)}
                className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-300 font-semibold transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{t.saved.viewContent}</span>
              </button>

              <button
                type="button"
                onClick={() => onDeleteMaterial(item.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title={t.common.delete}
                aria-label={t.common.delete}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 space-y-3">
            <Bookmark className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
            <div className="text-sm font-bold text-slate-900 dark:text-white">{t.saved.emptyTitle}</div>
            <p className="text-xs">{t.saved.emptySub}</p>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {selectedMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl max-h-[85vh] flex flex-col justify-between animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {getIcon(selectedMaterial.type)}
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {selectedMaterial.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMaterial(null)}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed pe-1">
              {selectedMaterial.type === 'summary' && selectedMaterial.content && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-teal-600 dark:text-teal-400 block mb-1">
                      {t.saved.overviewLabel}
                    </span>
                    {selectedMaterial.content.overview}
                  </div>
                  {selectedMaterial.content.mainPoints && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <span className="font-bold text-cyan-600 dark:text-cyan-400 block mb-1">
                        {t.saved.pointsLabel}
                      </span>
                      {selectedMaterial.content.mainPoints.map((p: string, i: number) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-teal-600 dark:text-teal-400 font-bold">•</span>
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedMaterial.type === 'note' && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">
                  {selectedMaterial.content?.text || JSON.stringify(selectedMaterial.content)}
                </div>
              )}

              {selectedMaterial.type === 'transcription' && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">
                  {selectedMaterial.content?.transcription || JSON.stringify(selectedMaterial.content)}
                </div>
              )}

              {selectedMaterial.type === 'quiz' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {t.saved.questionsCountLabel} {selectedMaterial.content?.questions?.length || 0}
                  </div>
                  {selectedMaterial.content?.questions?.map((q: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="font-bold text-slate-900 dark:text-white mb-1">
                        {i + 1}. {q.question}
                      </div>
                      <div className="text-teal-700 dark:text-teal-300 text-xs">
                        {t.saved.correctAnsLabel} {q.correctAnswer}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedMaterial.type === 'flashcards' && (
                <div className="space-y-2.5">
                  {selectedMaterial.content?.cards?.map((c: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="font-bold text-slate-900 dark:text-white">{c.front}</div>
                      <div className="text-xs text-teal-700 dark:text-teal-300">{c.back}</div>
                    </div>
                  ))}
                </div>
              )}

              {selectedMaterial.type === 'mindmap' && selectedMaterial.content?.tree && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  {renderMindMapPreview(selectedMaterial.content.tree)}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500">
                {t.saved.savedAtLabel} {selectedMaterial.createdAt}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    let text = '';
                    if (selectedMaterial.type === 'summary' && selectedMaterial.content) {
                      text = `${selectedMaterial.title}\n\n${selectedMaterial.content.overview || ''}\n\n${(selectedMaterial.content.mainPoints || []).join('\n')}`;
                    } else if (selectedMaterial.type === 'note') {
                      text = selectedMaterial.content?.text || JSON.stringify(selectedMaterial.content);
                    } else if (selectedMaterial.type === 'transcription') {
                      text = selectedMaterial.content?.transcription || JSON.stringify(selectedMaterial.content);
                    } else {
                      text = JSON.stringify(selectedMaterial.content, null, 2);
                    }
                    navigator.clipboard?.writeText(text).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? t.common.copied : t.common.copy}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMaterial(null)}
                  className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold cursor-pointer"
                >
                  {t.common.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>{t.saved.noteModalTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t.saved.noteTitleLabel}
                </label>
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder={t.saved.noteTitlePlaceholder}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t.saved.noteSubjectLabel}
                </label>
                <input
                  type="text"
                  value={noteSubject}
                  onChange={(e) => setNoteSubject(e.target.value)}
                  placeholder={t.saved.noteSubjectPlaceholder}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t.saved.noteBodyLabel}
                </label>
                <textarea
                  required
                  rows={5}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder={t.saved.noteBodyPlaceholder}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-bold cursor-pointer"
                >
                  {t.saved.saveNoteBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
