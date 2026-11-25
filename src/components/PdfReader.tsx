import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  BookOpen,
  FileText,
  Search,
  ChevronRight,
  ChevronLeft,
  Bot,
  HelpCircle,
  Sparkles,
  Layers,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  FileCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface PdfReaderProps {
  onSendToAssistant: (text: string) => void;
  onSendToSummarizer: (text: string) => void;
  onSendToQuiz: (text: string) => void;
  onSendToFlashcards: (text: string) => void;
}

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_TXT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_PAGES_TO_PROCESS = 60;

export const PdfReader: React.FC<PdfReaderProps> = ({
  onSendToAssistant,
  onSendToSummarizer,
  onSendToQuiz,
  onSendToFlashcards,
}) => {
  const { t, isRtl } = useLanguage();

  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [extractedPages, setExtractedPages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [isScannedPdf, setIsScannedPdf] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<number>(15);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeLoadingTaskRef = useRef<{ destroy: () => void } | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (activeLoadingTaskRef.current) {
        try {
          activeLoadingTaskRef.current.destroy();
        } catch {
          // ignore
        }
        activeLoadingTaskRef.current = null;
      }
    };
  }, []);

  const resetReaderState = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (activeLoadingTaskRef.current) {
      try {
        activeLoadingTaskRef.current.destroy();
      } catch {
        // ignore
      }
      activeLoadingTaskRef.current = null;
    }
    setErrorMsg(null);
    setWarningMsg(null);
    setIsScannedPdf(false);
    setSearchQuery('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    resetReaderState();

    const lowerName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
    const isTxt =
      file.type === 'text/plain' ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.text');

    if (!isPdf && !isTxt) {
      setErrorMsg(t.pdf.unsupportedErr);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const maxAllowedSize = isPdf ? MAX_PDF_SIZE_BYTES : MAX_TXT_SIZE_BYTES;
    const maxMb = isPdf ? 15 : 5;
    if (file.size > maxAllowedSize) {
      const actualMb = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMsg(
        t.pdf.sizeErr.replace('{actual}', actualMb).replace('{max}', String(maxMb))
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFileName(file.name);
    setFileSize(
      file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(0)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(2)} MB`
    );
    setIsLoading(true);
    setLoadingProgress({ current: 0, total: 1 });

    try {
      if (isTxt) {
        await processTextFile(file);
      } else {
        await processPdfFile(file);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      const isMemoryErr =
        (err instanceof Error && err.name === 'RangeError') ||
        message.toLowerCase().includes('memory') ||
        message.toLowerCase().includes('storage') ||
        message.toLowerCase().includes('allocation');

      if (isMemoryErr) {
        setErrorMsg(t.pdf.memErr);
      } else {
        setErrorMsg(message && !message.includes('[object') ? message : t.pdf.genericErr);
      }
      setExtractedPages([]);
      setNumPages(0);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processTextFile = async (file: File) => {
    const rawText = await file.text();
    if (!rawText.trim()) {
      setErrorMsg(t.pdf.emptyErr);
      setExtractedPages([]);
      setNumPages(0);
      return;
    }

    const PAGE_CHAR_LIMIT = 2000;
    const pages: string[] = [];
    const paragraphs = rawText.split(/\n\s*\n/);
    let currentPageText = '';

    for (const paragraph of paragraphs) {
      if (currentPageText.length + paragraph.length > PAGE_CHAR_LIMIT && currentPageText.length > 0) {
        pages.push(currentPageText.trim());
        currentPageText = paragraph + '\n\n';
      } else {
        currentPageText += paragraph + '\n\n';
      }
    }
    if (currentPageText.trim()) {
      pages.push(currentPageText.trim());
    }

    setExtractedPages(pages);
    setNumPages(pages.length);
    setCurrentPage(1);
  };

  const processPdfFile = async (file: File) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjsLib = (window as unknown as { pdfjsLib?: any }).pdfjsLib;
    if (!pdfjsLib) {
      throw new Error(t.pdf.libLoadingErr);
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
      disableAutoFetch: true,
      disableStream: false,
    });
    activeLoadingTaskRef.current = loadingTask;

    const pdf = await loadingTask.promise;
    const totalDocPages = pdf.numPages || 1;
    const pagesToRead = Math.min(totalDocPages, MAX_PAGES_TO_PROCESS);

    if (totalDocPages > MAX_PAGES_TO_PROCESS) {
      setWarningMsg(
        t.pdf.maxPagesWarn
          .replace('{total}', String(totalDocPages))
          .replace('{max}', String(MAX_PAGES_TO_PROCESS))
      );
    }

    setNumPages(pagesToRead);
    setCurrentPage(1);
    setLoadingProgress({ current: 0, total: pagesToRead });

    const pagesText: string[] = [];
    let totalExtractedChars = 0;

    for (let i = 1; i <= pagesToRead; i++) {
      setLoadingProgress({ current: i, total: pagesToRead });

      const page = await pdf.getPage(i);
      try {
        const textContent = await page.getTextContent();
        let pageStr = '';

        if (textContent && Array.isArray(textContent.items)) {
          pageStr = textContent.items
            .map((item: { str?: unknown }) => (typeof item?.str === 'string' ? item.str : ''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        }

        if (pageStr.length > 0) {
          pagesText.push(pageStr);
          totalExtractedChars += pageStr.length;
        } else {
          pagesText.push(t.pdf.scannedPageNote);
        }
      } finally {
        page.cleanup();
      }
    }

    if (totalExtractedChars < pagesToRead * 15) {
      setIsScannedPdf(true);
    }

    setExtractedPages(pagesText);

    try {
      pdf.cleanup();
      loadingTask.destroy();
    } catch {
      // ignore
    }
    activeLoadingTaskRef.current = null;
  };

  const handleLoadSampleBook = () => {
    resetReaderState();
    setFileName(t.pdf.sampleBookName);
    setFileSize('1.4 MB');
    setNumPages(3);
    setCurrentPage(1);
    setExtractedPages([
      t.samples[0].fullText,
      t.pdf.samplePages[1],
      t.pdf.samplePages[2],
    ]);
  };

  const currentText = extractedPages[currentPage - 1] || '';

  const handleCopyCurrentPage = () => {
    if (!currentText) return;
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const searchResultsCount = searchQuery.trim()
    ? extractedPages.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase())).length
    : 0;

  const jumpToNextMatch = () => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    for (let i = currentPage; i < extractedPages.length; i++) {
      if (extractedPages[i].toLowerCase().includes(q)) {
        setCurrentPage(i + 1);
        return;
      }
    }
    for (let i = 0; i < currentPage - 1; i++) {
      if (extractedPages[i].toLowerCase().includes(q)) {
        setCurrentPage(i + 1);
        return;
      }
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            {t.pdf.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t.pdf.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,application/pdf,.txt,text/plain"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{t.pdf.uploadBtn}</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSampleBook}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>{t.pdf.sampleBtn}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-3 shadow-md">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-rose-800 dark:text-rose-200">{t.pdf.errHeader}</div>
            <div className="leading-relaxed">{errorMsg}</div>
          </div>
        </div>
      )}

      {warningMsg && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500 mt-0.5" />
          <div className="leading-relaxed">{warningMsg}</div>
        </div>
      )}

      {isScannedPdf && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-3 shadow-md">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">{t.pdf.scannedTitle}</div>
            <div className="leading-relaxed opacity-90">{t.pdf.scannedBody}</div>
          </div>
        </div>
      )}

      {!fileName && !isLoading && (
        <div
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
          }}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500/60 rounded-3xl p-8 sm:p-10 text-center cursor-pointer bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-100/70 dark:hover:bg-slate-900/70 transition-all flex flex-col items-center justify-center gap-4 group"
        >
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 border border-slate-200 dark:border-slate-700 group-hover:scale-110 transition">
            <Upload className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <div className="text-base font-bold text-slate-900 dark:text-white">
              {t.pdf.dropTitle}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t.pdf.dropSub}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleLoadSampleBook();
            }}
            className="mt-1 text-xs text-teal-600 dark:text-teal-400 hover:underline font-semibold underline-offset-4 cursor-pointer"
          >
            {t.pdf.dropSample}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="p-10 text-center rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-900 dark:text-white">{t.pdf.loadingText}</div>
            {loadingProgress.total > 0 && (
              <div className="text-xs text-teal-600 dark:text-teal-300 font-mono">
                {t.pdf.pageStatus
                  .replace('{current}', String(loadingProgress.current))
                  .replace('{total}', String(loadingProgress.total))}{' '}
                ({Math.round((loadingProgress.current / loadingProgress.total) * 100)}%)
              </div>
            )}
          </div>

          {loadingProgress.total > 0 && (
            <div className="max-w-md mx-auto bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-500 to-cyan-400 h-2 rounded-full transition-all duration-200"
                style={{
                  width: `${Math.round((loadingProgress.current / loadingProgress.total) * 100)}%`,
                }}
              />
            </div>
          )}

          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.pdf.memoryNote}</div>
        </div>
      )}

      {fileName && !isLoading && numPages > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Viewer Toolbar */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <FileCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px] sm:max-w-xs">
                  {fileName}
                </span>
                {fileSize && <span className="text-[11px] text-slate-500 dark:text-slate-400">({fileSize})</span>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && jumpToNextMatch()}
                    placeholder={t.pdf.searchPlaceholder}
                    className="w-28 sm:w-36 ps-7 pe-2 py-1 text-[11px] rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
                  />
                  <Search
                    onClick={jumpToNextMatch}
                    className="w-3 h-3 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2 cursor-pointer hover:text-teal-500"
                  />
                </div>
                {searchResultsCount > 0 && (
                  <button
                    type="button"
                    onClick={jumpToNextMatch}
                    className="cursor-pointer text-[10px] px-2 py-0.5 rounded bg-teal-500/15 text-teal-700 dark:text-teal-300 font-mono"
                  >
                    {t.pdf.pagesMatch.replace('{count}', String(searchResultsCount))}
                  </button>
                )}

                <div className="flex items-center gap-1 border-s border-slate-200 dark:border-slate-700 ps-2 ms-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    title={t.common.prev}
                  >
                    {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </button>

                  <span className="px-2 font-medium text-slate-700 dark:text-slate-300">
                    <span className="text-teal-600 dark:text-teal-400 font-bold">{currentPage}</span> / {numPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage >= numPages}
                    onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    title={t.common.next}
                  >
                    {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center gap-1 border-s border-slate-200 dark:border-slate-700 ps-2 ms-1">
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.min(22, s + 1))}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    aria-label="Increase font size"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.max(12, s - 1))}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    aria-label="Decrease font size"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Document Content Canvas */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 min-h-[420px] max-h-[600px] overflow-y-auto space-y-4 shadow-inner relative">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {t.pdf.pageStatus
                    .replace('{current}', String(currentPage))
                    .replace('{total}', String(numPages))}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCurrentPage}
                  className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? t.common.copied : t.pdf.copyPage}</span>
                </button>
              </div>

              <div
                style={{ fontSize: `${fontSize}px` }}
                className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap select-text"
              >
                {currentText || t.pdf.emptyPage}
              </div>
            </div>
          </div>

          {/* Side AI Actions Panel */}
          <div className="space-y-4">
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{t.pdf.aiActionsTitle}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t.pdf.aiActionsSub}
              </p>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => onSendToAssistant(currentText)}
                  disabled={!currentText || isScannedPdf}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 hover:border-teal-500/50 border border-slate-200 dark:border-slate-700/80 disabled:opacity-40 transition group text-start cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-300">
                        {t.pdf.askAssistant}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t.pdf.askAssistantSub}
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onSendToSummarizer(currentText)}
                  disabled={!currentText || isScannedPdf}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 hover:border-indigo-500/50 border border-slate-200 dark:border-slate-700/80 disabled:opacity-40 transition group text-start cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
                        {t.pdf.summarizePage}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t.pdf.summarizePageSub}
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onSendToQuiz(currentText)}
                  disabled={!currentText || isScannedPdf}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 hover:border-cyan-500/50 border border-slate-200 dark:border-slate-700/80 disabled:opacity-40 transition group text-start cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300">
                        {t.pdf.quizPage}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t.pdf.quizPageSub}
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onSendToFlashcards(currentText)}
                  disabled={!currentText || isScannedPdf}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 hover:border-emerald-500/50 border border-slate-200 dark:border-slate-700/80 disabled:opacity-40 transition group text-start cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
                        {t.pdf.cardsPage}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t.pdf.cardsPageSub}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-500 dark:text-slate-400 space-y-2 shadow-sm">
              <div className="font-semibold text-slate-800 dark:text-slate-300 flex items-center justify-between">
                <span>{t.pdf.docInfo}</span>
                <button
                  type="button"
                  onClick={() => {
                    resetReaderState();
                    setFileName(null);
                    setExtractedPages([]);
                    setNumPages(0);
                  }}
                  className="text-[11px] text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t.pdf.closeDoc}</span>
                </button>
              </div>
              <div>
                {t.pdf.fileNameLabel} <span className="text-slate-900 dark:text-white truncate block">{fileName}</span>
              </div>
              <div>
                {t.pdf.pagesCountLabel} <span className="text-teal-600 dark:text-teal-400 font-bold">{numPages}</span>
              </div>
              <div>
                {t.pdf.charsCountLabel} <span className="text-slate-900 dark:text-white">{currentText.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
