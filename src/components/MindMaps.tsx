import React, { useState, useEffect } from 'react';
import {
  GitFork,
  Sparkles,
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  BookOpen,
  Copy,
  Check,
  Info,
  Bookmark,
  AlertCircle,
  X,
} from 'lucide-react';
import { MindMapNode, SavedMaterial } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { safeStorageGet, safeStorageSet } from '../utils/storage';

interface MindMapsProps {
  initialTopic?: string;
  hasGeminiKey: boolean;
  onSaveMaterial?: (material: Omit<SavedMaterial, 'id' | 'createdAt'>) => void;
}

export const MindMaps: React.FC<MindMapsProps> = ({
  initialTopic = '',
  hasGeminiKey,
  onSaveMaterial,
}) => {
  const { t, lang } = useLanguage();
  const [topicInput, setTopicInput] = useState(initialTopic);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [copied, setCopied] = useState(false);
  const [savedMap, setSavedMap] = useState(false);
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [customTree, setCustomTree] = useState<MindMapNode | null>(() =>
    safeStorageGet<MindMapNode | null>('zakir_custom_mindmap', null)
  );
  const [newSubLabel, setNewSubLabel] = useState('');
  const [isAddingSub, setIsAddingSub] = useState(false);

  const mindMapData = customTree || t.mindmaps.initialTree;

  useEffect(() => {
    if (initialTopic) {
      setTopicInput(initialTopic);
    }
  }, [initialTopic]);

  useEffect(() => {
    safeStorageSet('zakir_custom_mindmap', customTree);
  }, [customTree]);

  const handleGenerate = async (topicToUse?: string) => {
    const text = topicToUse || topicInput;
    if (!text.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    setSelectedNode(null);

    try {
      const res = await fetch('/api/mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicOrText: text,
          language: lang,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.tree) {
        setErrorMsg(data.error || t.mindmaps.errorMsg);
        return;
      }

      setCustomTree(data.tree);
    } catch {
      setErrorMsg(t.mindmaps.errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyOutline = () => {
    const renderTextNode = (node: MindMapNode, level: number = 0): string => {
      const indent = '  '.repeat(level);
      let str = `${indent}• ${node.label}${node.description ? `: ${node.description}` : ''}\n`;
      if (node.children) {
        node.children.forEach((c) => {
          str += renderTextNode(c, level + 1);
        });
      }
      return str;
    };

    const outline = renderTextNode(mindMapData);
    navigator.clipboard?.writeText(outline).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveMap = () => {
    if (!onSaveMaterial) return;
    onSaveMaterial({
      title: `${t.saved.types.mindmap}: ${mindMapData.label}`,
      type: 'mindmap',
      subject: t.tabs.mindmaps.label,
      tags: [t.saved.types.mindmap],
      content: { tree: mindMapData },
    });
    setSavedMap(true);
    setTimeout(() => setSavedMap(false), 2000);
  };

  const handleAddChild = (parentId: string) => {
    if (!newSubLabel.trim()) return;

    const addRecursive = (node: MindMapNode): MindMapNode => {
      if (node.id === parentId) {
        const newChild: MindMapNode = {
          id: `custom-${Date.now()}`,
          label: newSubLabel.trim(),
          description: t.mindmaps.subAddedDesc,
        };
        return {
          ...node,
          children: [...(node.children || []), newChild],
        };
      }
      if (node.children) {
        return {
          ...node,
          children: node.children.map(addRecursive),
        };
      }
      return node;
    };

    const updatedTree = addRecursive(mindMapData);
    setCustomTree(updatedTree);
    setNewSubLabel('');
    setIsAddingSub(false);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GitFork className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <span>{t.mindmaps.title}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {t.mindmaps.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{hasGeminiKey ? t.assistant.liveEngine : t.nav.aiOffline}</span>
          </span>

          {onSaveMaterial && (
            <button
              type="button"
              onClick={handleSaveMap}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs border border-purple-500/30 font-semibold transition cursor-pointer"
            >
              {savedMap ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Bookmark className="w-3.5 h-3.5" />}
              <span>{savedMap ? t.mindmaps.savedMap : t.mindmaps.saveMap}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyOutline}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? t.mindmaps.copiedOutline : t.mindmaps.copyOutline}</span>
          </button>
        </div>
      </div>

      {/* Generator Input */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>{t.mindmaps.samplesLabel}</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {t.samples.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => {
                  setTopicInput(sample.title);
                  handleGenerate(sample.title);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                {sample.title}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder={t.mindmaps.placeholder}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-purple-500 transition"
          />

          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={isLoading || !topicInput.trim()}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 text-white font-bold text-sm shadow-md transition cursor-pointer"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t.mindmaps.loadingBtn}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{t.mindmaps.createBtn}</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Canvas Viewport */}
      <div className="relative rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[460px] shadow-2xl flex flex-col justify-between">
        {/* Zoom Controls */}
        <div className="flex items-center justify-between p-4 pb-0 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(1.3, Number((z + 0.1).toFixed(2))))}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono px-2 text-slate-600 dark:text-slate-400">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.8, Number((z - 0.1).toFixed(2))))}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              title={t.common.reset}
              aria-label={t.common.reset}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selected Node Drawer / Details Panel */}
        {selectedNode && (
          <div className="mx-4 mt-4 p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-purple-500/40 shadow-xl space-y-3 animate-fadeIn max-w-md self-center sm:self-end sm:me-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-purple-600 dark:text-purple-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>{t.mindmaps.nodeDetails}</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">{selectedNode.label}</div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {selectedNode.description || t.mindmaps.noDesc}
            </p>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              {isAddingSub ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newSubLabel}
                    onChange={(e) => setNewSubLabel(e.target.value)}
                    placeholder={t.mindmaps.subPlaceholder}
                    className="w-full text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingSub(false)}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      {t.common.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddChild(selectedNode.id)}
                      className="px-3 py-1 text-[11px] rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer"
                    >
                      {t.common.add}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingSub(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-semibold border border-purple-500/20 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.mindmaps.addSubBtn}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Responsive Hierarchy */}
        <div
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
          className="p-5 sm:p-8 lg:p-10 transition-transform duration-200 flex flex-col items-center space-y-8"
        >
          {/* Root Node */}
          <button
            type="button"
            onClick={() => setSelectedNode(mindMapData)}
            className="group cursor-pointer px-6 py-4 rounded-3xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white shadow-xl shadow-purple-900/25 border-2 border-purple-400/50 hover:scale-105 transition-all text-center max-w-md w-full sm:w-auto relative"
          >
            <div className="text-[10px] uppercase font-bold tracking-widest text-purple-200 mb-0.5">
              {t.mindmaps.rootLabel}
            </div>
            <div className="text-base sm:text-lg font-extrabold">{mindMapData.label}</div>
            {mindMapData.description && (
              <div className="text-xs text-purple-100/90 mt-1 line-clamp-2">
                {mindMapData.description}
              </div>
            )}
          </button>

          {/* Primary Branches */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 w-full max-w-5xl">
            {mindMapData.children?.map((branch, bIdx) => {
              const borderColors = [
                'border-teal-500/50 hover:border-teal-400',
                'border-cyan-500/50 hover:border-cyan-400',
                'border-amber-500/50 hover:border-amber-400',
                'border-pink-500/50 hover:border-pink-400',
              ];
              const tagBg = [
                'bg-teal-500/15 text-teal-700 dark:text-teal-300',
                'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
                'bg-amber-500/15 text-amber-700 dark:text-amber-300',
                'bg-pink-500/15 text-pink-700 dark:text-pink-300',
              ];

              return (
                <div key={branch.id || bIdx} className="space-y-3.5 flex flex-col items-center">
                  <div
                    onClick={() => setSelectedNode(branch)}
                    className={`w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border ${borderColors[bIdx % 4]} shadow-md cursor-pointer hover:-translate-y-0.5 transition text-start group`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tagBg[bIdx % 4]}`}>
                        {t.mindmaps.branchPrefix} {bIdx + 1}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition">
                      {branch.label}
                    </div>
                    {branch.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                        {branch.description}
                      </p>
                    )}
                  </div>

                  {branch.children && (
                    <div className="w-full space-y-2.5 ps-4 border-s-2 border-slate-200 dark:border-slate-800">
                      {branch.children.map((sub, sIdx) => (
                        <div
                          key={sub.id || sIdx}
                          onClick={() => setSelectedNode(sub)}
                          className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-purple-400/50 cursor-pointer transition text-start group"
                        >
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-300">
                            • {sub.label}
                          </div>
                          {sub.description && (
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                              {sub.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer tip */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-center text-xs text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2">
          <span>{t.mindmaps.footerTip}</span>
        </div>
      </div>
    </div>
  );
};
