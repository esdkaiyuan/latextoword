import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Dropdown, Option, Tooltip
} from '@fluentui/react-components';
import {
  BookOpen, Braces, ChartNoAxesCombined, ChevronLeft, ClipboardPaste, Copy, Download, FileImage,
  Columns2, Eye, FilePlus2, FileText, FolderInput, FolderOpen, ImageDown, Maximize2, Minimize2, MoreHorizontal,
  PanelLeft, PanelLeftClose, PanelRight, PanelRightClose, PanelRightOpen, Pencil, Check, Plus, Redo2, Rows2, Search,
  Settings2, Sigma, Star, Trash2, Undo2, Upload, WandSparkles, X
} from 'lucide-react';
import { createProject, effectiveStyle, mergeImportedFormulas, parseProject, reorderFormulas, updateFormula, type FormulaItem, type ProjectFile } from '../domain/project';
import { BUILT_IN_TEMPLATES, TEMPLATE_CATEGORIES, type TemplateCategory, type TemplateItem } from '../domain/templates';
import { decodeBase64File } from '../domain/fileDecoding';
import { isOnlineOcrSupported, supportedImportAccept, type ImportMode } from '../domain/fileCompatibility';
import { extractImportedFile, type ImportFileEntry } from '../domain/fileImportCoordinator';
import { getFormulaScale, renderLatex } from '../domain/mathPreview';
import { MATH_SYMBOLS, MATH_TEMPLATES, SYMBOL_CATEGORIES, type MathSymbol, type MathTemplate } from '../domain/mathSymbols';
import { DRAFT_STORAGE_KEY, formatSavedAt, parseDraft, serializeDraft } from '../domain/persistence';
import { sanitizeFileName } from '../domain/imageExport';
import { buildDocxParts, type DocxFormula } from '../domain/docx';
import { extractMathml, mathmlToLatex } from '../domain/mathmlToLatex';
import { searchEverything, type SearchHit } from '../domain/search';
import { buildFormulaImage, svgToPngDataUrl } from './rasterize';
import { getKatexCssWithFonts } from './katexAssets';
import LatexEditor, { type CursorPosition } from './LatexEditor';
import CommandPalette from './CommandPalette';
import FileViewer, { type ViewerFile } from './FileViewer';
import DocumentWorkspace from './DocumentWorkspace';
import ImportSettings from './ImportSettings';
import ImportReview from './ImportReview';
import { prepareImageForLocalOcr } from './prepareImageForLocalOcr';
import type { EditorView } from '@codemirror/view';

const FONT_OPTIONS = [
  { family: 'Cambria Math', label: 'Cambria Math · Word 默认' },
  { family: 'STIX Two Math', label: 'STIX Two Math · 学术出版' },
  { family: 'Libertinus Math', label: 'Libertinus Math · 现代 LaTeX' },
  { family: 'Noto Sans Math', label: 'Noto Sans Math · 无衬线' },
  { family: 'Latin Modern Math', label: 'Latin Modern Math · 经典 TeX' },
  { family: 'Times New Roman', label: 'Times New Roman' },
  { family: 'Arial', label: 'Arial' },
  { family: '宋体', label: '宋体' }
] as const;
const THEMES = [
  { id: 'white', name: '白', color: '#3b82f6', soft: '#edf4ff' },
  { id: 'cream', name: '米白', color: '#b47a3c', soft: '#f7eddd' },
  { id: 'black', name: '黑', color: '#9cc4ff', soft: '#2c3c52' },
  { id: 'aqua', name: '青湖蓝', color: '#0f8798', soft: '#e3f5f8' },
  { id: 'grass', name: '青草绿', color: '#4d9852', soft: '#e7f5e7' },
  { id: 'gray', name: '低调灰', color: '#6f7b88', soft: '#e9edf1' }
] as const;
const COPY_FORMATS = [
  { id: 'mathml', label: 'Word 公式' },
  { id: 'html', label: 'HTML' },
  { id: 'latex', label: 'LaTeX' },
  { id: 'png', label: 'PNG 图片' }
] as const;
type CopyFormat = typeof COPY_FORMATS[number]['id'];
type ThemeId = typeof THEMES[number]['id'];
type RibbonTab = 'start' | 'insert' | 'templates' | 'export' | 'view';
type LayoutMode = 'split' | 'editor' | 'preview';
type SidebarModule = 'files' | 'formulas' | 'symbols' | 'templates' | 'modeling' | 'macros';

function newFormula(name: string, latex: string, mode: FormulaItem['displayMode'] = 'block'): FormulaItem {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name, latex, displayMode: mode, style: {}, tags: [], createdAt: now, updatedAt: now };
}

function FitMathPreview({ latex, macros }: { latex: string; macros: Record<string, string> }) {
  const frameRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  const rendered = renderLatex(latex, 'block', macros);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    const measure = () => {
      const frameWidth = frame.clientWidth;
      const contentWidth = content.scrollWidth;
      if (!frameWidth || !contentWidth) return;
      setScale(Math.max(0.42, Math.min(1, (frameWidth - 8) / contentWidth)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [latex]);

  if (!rendered.ok) return <span className="math-template-preview-error">{latex}</span>;
  return <span ref={frameRef} className="fit-math-frame"><span ref={contentRef} className="fit-math-content" style={{ transform: `scale(${scale})` }} dangerouslySetInnerHTML={{ __html: rendered.html }} /></span>;
}

function App() {
  const [initial] = useState(() => {
    const draft = parseDraft(localStorage.getItem(DRAFT_STORAGE_KEY));
    return { project: draft?.project ?? createProject('我的公式集'), restoredAt: draft?.savedAt ?? null };
  });
  const [project, setProject] = useState<ProjectFile>(initial.project);
  const projectRef = useRef(initial.project);
  const [selectedId, setSelectedId] = useState(initial.project.formulas[0].id);
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('基础');
  const [templateSearch, setTemplateSearch] = useState('');
  const [formulaSearch, setFormulaSearch] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFormulaList, setShowFormulaList] = useState(true);
  const [message, setMessage] = useState(initial.restoredAt ? `已恢复 ${formatSavedAt(initial.restoredAt)} 的未保存编辑` : '已保存到本地');
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(initial.restoredAt);
  const [copyFormat, setCopyFormat] = useState<CopyFormat>(() => {
    const stored = localStorage.getItem('formula-workbench.copy-format');
    return COPY_FORMATS.some((format) => format.id === stored) ? stored as CopyFormat : 'mathml';
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [macroName, setMacroName] = useState('');
  const [macroBody, setMacroBody] = useState('');
  const [splitOrientation, setSplitOrientation] = useState<'horizontal' | 'vertical'>(() => {
    const stored = localStorage.getItem('formula-workbench.split-orientation');
    return stored === 'vertical' ? 'vertical' : 'horizontal';
  });
  const [splitVertical, setSplitVertical] = useState(0.52);
  const [cursor, setCursor] = useState<CursorPosition>({ line: 1, column: 1, lines: 1 });
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [viewer, setViewer] = useState<{ files: ViewerFile[]; index: number } | null>(null);
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const stored = localStorage.getItem('formula-workbench.theme');
    return THEMES.some((theme) => theme.id === stored) ? stored as ThemeId : 'white';
  });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showOcrSettings, setShowOcrSettings] = useState(false);
  const [mathpixConfigured, setMathpixConfigured] = useState(false);
  const [ocrSettingsBusy, setOcrSettingsBusy] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>(() => {
    const stored = localStorage.getItem('formula-workbench.import-mode');
    return stored === 'offline' || stored === 'online' ? stored : 'auto';
  });
  const [activeImport, setActiveImport] = useState<{ name: string; stage: string; percent: number } | null>(null);
  const [pendingImport, setPendingImport] = useState<{ formulas: FormulaItem[]; report: string[] } | null>(null);
  const [showSymbols, setShowSymbols] = useState(false);
  const [activeSymbolCategory, setActiveSymbolCategory] = useState(SYMBOL_CATEGORIES[0]);
  const [symbolPaletteMode, setSymbolPaletteMode] = useState<'symbols' | 'templates'>('symbols');
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTab>('start');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split');
  const [workspaceMode, setWorkspaceMode] = useState<'formulas' | 'documents'>('formulas');
  const [documentDirty, setDocumentDirty] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPreviewEditing, setIsPreviewEditing] = useState(false);
  const [previewDraft, setPreviewDraft] = useState('');
  const [sidebarModule, setSidebarModule] = useState<SidebarModule>('formulas');
  const [splitRatios, setSplitRatios] = useState({ sidebar: 0.19, editor: 0.4 });
  const [resizing, setResizing] = useState<'sidebar' | 'editor' | 'height' | null>(null);
  const [customTemplates, setCustomTemplates] = useState<TemplateItem[]>(() => {
    try {
      const stored = localStorage.getItem('formula-workbench.custom-templates');
      return stored ? JSON.parse(stored) as TemplateItem[] : [];
    } catch {
      return [];
    }
  });
  const importRef = useRef<HTMLInputElement>(null);
  const openFileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const historyRef = useRef<ProjectFile[]>([]);
  const redoRef = useRef<ProjectFile[]>([]);
  const editorViewRef = useRef<EditorView | null>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const themePopoverRef = useRef<HTMLDivElement>(null);
  const templateDrawerRef = useRef<HTMLElement>(null);
  const dragIdRef = useRef<string | null>(null);
  const syncSourceRef = useRef<'editor' | 'preview' | null>(null);
  const previewRatioRef = useRef(0);

  useEffect(() => {
    window.desktop?.window.setTheme(themeId);
  }, [themeId]);

  useEffect(() => {
    folderRef.current?.setAttribute('webkitdirectory', '');
    folderRef.current?.setAttribute('directory', '');
  }, []);

  useEffect(() => {
    if (!window.desktop) return;
    window.desktop.project.recent().then(setRecentProjects).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!window.desktop) return;
    window.desktop.ocr.mathpixStatus().then((status) => setMathpixConfigured(status.configured)).catch(() => undefined);
  }, []);

  useEffect(() => {
    localStorage.setItem('formula-workbench.import-mode', importMode);
  }, [importMode]);

  useEffect(() => {
    const unsubscribe = window.desktop?.ocr.onProgress((progress) => {
      setActiveImport({ name: progress.name, stage: progress.stage, percent: progress.percent });
    });
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      localStorage.setItem(DRAFT_STORAGE_KEY, serializeDraft(project, savedAt));
      setAutoSavedAt(savedAt);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    localStorage.setItem('formula-workbench.copy-format', copyFormat);
  }, [copyFormat]);

  // 切换公式时预览回到顶部，与编辑器保持一致
  useEffect(() => {
    previewRatioRef.current = 0;
    if (previewStageRef.current) previewStageRef.current.scrollTop = 0;
  }, [selectedId]);

  useEffect(() => {
    localStorage.setItem('formula-workbench.split-orientation', splitOrientation);
  }, [splitOrientation]);

  // Esc 逐层关闭浮层（命令面板自己处理 Esc）
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || paletteOpen) return;
      if (pendingImport) {
        setPendingImport(null);
        return;
      }
      if (viewer) {
        setViewer(null);
        return;
      }
      if (showOcrSettings) {
        setShowOcrSettings(false);
        return;
      }
      if (showThemePicker) {
        setShowThemePicker(false);
        return;
      }
      if (showTemplates) {
        setShowTemplates(false);
        return;
      }
      if (showSymbols) setShowSymbols(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteOpen, pendingImport, viewer, showOcrSettings, showThemePicker, showTemplates, showSymbols]);

  // 点击浮层外部即关闭
  useEffect(() => {
    if (!showThemePicker && !showTemplates) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (showThemePicker && !themePopoverRef.current?.contains(target)) setShowThemePicker(false);
      if (showTemplates && !templateDrawerRef.current?.contains(target)) setShowTemplates(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showThemePicker, showTemplates]);

  useEffect(() => {
    if (workspaceMode === 'documents') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setPaletteOpen((open) => !open);
      setPaletteQuery('');
      setPaletteIndex(0);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [workspaceMode]);

  useEffect(() => {
    if (!resizing) return;
    const onPointerMove = (event: PointerEvent) => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (resizing === 'height') {
        setSplitVertical(Math.max(0.2, Math.min(0.8, (event.clientY - rect.top) / rect.height)));
        return;
      }
      const position = Math.max(0, Math.min(rect.width, event.clientX - rect.left)) / rect.width;
      setSplitRatios((current) => {
        if (resizing === 'sidebar') {
          const maxSidebar = Math.max(0.12, 1 - current.editor - 0.28);
          return { ...current, sidebar: Math.max(0.12, Math.min(maxSidebar, position)) };
        }
        const editor = position - current.sidebar;
        const maxEditor = Math.max(0.28, 1 - current.sidebar - 0.3);
        return { ...current, editor: Math.max(0.28, Math.min(maxEditor, editor)) };
      });
    };
    const onPointerUp = () => setResizing(null);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing]);

  const selected = project.formulas.find((formula) => formula.id === selectedId) ?? project.formulas[0];
  const style = effectiveStyle(project, selected);
  const preview = useMemo(() => renderLatex(selected.latex, selected.displayMode, project.macros), [selected.latex, selected.displayMode, project.macros]);

  // 预览重渲染后保持滚动位置，避免打字时画面跳动
  useLayoutEffect(() => {
    const stage = previewStageRef.current;
    if (!stage) return;
    const max = stage.scrollHeight - stage.clientHeight;
    if (max > 0) stage.scrollTop = previewRatioRef.current * max;
  }, [preview.html]);
  const formulaScale = getFormulaScale(selected.latex);
  const visibleFormulas = project.formulas.filter((formula) => `${formula.name} ${formula.latex}`.toLowerCase().includes(formulaSearch.toLowerCase()));
  const allTemplates = [...BUILT_IN_TEMPLATES, ...customTemplates];
  const visibleTemplates = allTemplates.filter((template) => template.category === activeCategory && `${template.name} ${template.latex}`.toLowerCase().includes(templateSearch.toLowerCase()));
  const visibleCatalog = BUILT_IN_TEMPLATES.filter((template) => `${template.name} ${template.latex} ${template.category}`.toLowerCase().includes(formulaSearch.toLowerCase()));
  const visibleSymbols = MATH_SYMBOLS.filter((symbol) => symbol.category === activeSymbolCategory);
  const currentCopyLabel = COPY_FORMATS.find((format) => format.id === copyFormat)?.label ?? 'Word 公式';
  const paletteHits = useMemo(
    () => (paletteOpen
      ? searchEverything(paletteQuery, {
        project: project.formulas.map((formula) => ({ id: formula.id, name: formula.name, latex: formula.latex })),
        library: allTemplates.map((template) => ({ id: template.id, name: template.name, latex: template.latex, category: template.category })),
        symbols: MATH_SYMBOLS.map((symbol) => ({ id: symbol.id, label: symbol.label, insert: symbol.insert, category: symbol.category })),
        templates: MATH_TEMPLATES.map((template) => ({ id: template.id, label: template.label, description: template.description, insert: template.insert, caretOffset: template.caretOffset }))
      })
      : []),
    [paletteOpen, paletteQuery, project.formulas, allTemplates]
  );

  function mathPreviewHtml(latex: string, displayMode: 'inline' | 'block' = 'inline'): string {
    const result = renderLatex(latex, displayMode, project.macros);
    return result.ok ? result.html : '';
  }

  function scrollPreviewToRatio(ratio: number) {
    const stage = previewStageRef.current;
    if (!stage) return;
    const max = stage.scrollHeight - stage.clientHeight;
    if (max <= 0) return;
    syncSourceRef.current = 'editor';
    stage.scrollTop = ratio * max;
    requestAnimationFrame(() => { syncSourceRef.current = null; });
  }

  function scrollEditorToRatio(ratio: number) {
    const view = editorViewRef.current;
    if (!view) return;
    const max = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight;
    if (max <= 0) return;
    syncSourceRef.current = 'preview';
    view.scrollDOM.scrollTop = ratio * max;
    requestAnimationFrame(() => { syncSourceRef.current = null; });
  }

  function handleEditorScroll(ratio: number) {
    if (syncSourceRef.current === 'preview') return;
    previewRatioRef.current = ratio;
    scrollPreviewToRatio(ratio);
  }

  function handlePreviewScroll(event: React.UIEvent<HTMLDivElement>) {
    if (syncSourceRef.current === 'editor') return;
    const stage = event.currentTarget;
    const max = stage.scrollHeight - stage.clientHeight;
    if (max <= 0) return;
    const ratio = stage.scrollTop / max;
    previewRatioRef.current = ratio;
    scrollEditorToRatio(ratio);
  }

  function patchSelected(patch: Partial<Pick<FormulaItem, 'name' | 'latex' | 'displayMode' | 'style' | 'tags'>>) {
    commitProject((current) => updateFormula(current, selected.id, patch));
  }

  function commitProject(update: ProjectFile | ((current: ProjectFile) => ProjectFile)) {
    const current = projectRef.current;
    const next = typeof update === 'function' ? update(current) : update;
    historyRef.current = [...historyRef.current.slice(-49), current];
    redoRef.current = [];
    projectRef.current = next;
    setProject(next);
  }

  function undo() {
    const previous = historyRef.current.pop();
    if (!previous) return setMessage('没有可撤销的操作');
    redoRef.current.push(projectRef.current);
    projectRef.current = previous;
    setProject(previous);
    setSelectedId(previous.formulas.some((formula) => formula.id === selectedId) ? selectedId : previous.formulas[0].id);
    setMessage('已撤销');
  }

  function redo() {
    const next = redoRef.current.pop();
    if (!next) return setMessage('没有可重做的操作');
    historyRef.current.push(projectRef.current);
    projectRef.current = next;
    setProject(next);
    setSelectedId(next.formulas.some((formula) => formula.id === selectedId) ? selectedId : next.formulas[0].id);
    setMessage('已重做');
  }

  function insertTemplate(latex: string, name: string) {
    patchSelected({ latex, name });
    setMessage(`已插入模板：${name}`);
  }

  function insertSnippet(snippet: string, caretOffset: number, label: string) {
    const view = editorViewRef.current;
    if (!view) {
      patchSelected({ latex: `${selected.latex}${snippet}` });
      setMessage(`已插入：${label}`);
      return;
    }
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: snippet },
      selection: { anchor: from + caretOffset },
      scrollIntoView: true
    });
    view.focus();
    setMessage(`已插入：${label}`);
  }

  function insertSymbol(symbol: MathSymbol | MathTemplate) {
    insertSnippet(symbol.insert, 'caretOffset' in symbol ? symbol.caretOffset : symbol.insert.length, symbol.label);
  }

  function pickSearchHit(hit: SearchHit) {
    setPaletteOpen(false);
    if (hit.kind === 'project') {
      setSelectedId(hit.id);
      setMessage(`已切换到公式：${hit.title}`);
      return;
    }
    if (hit.kind === 'library') {
      insertTemplate(hit.latex, hit.title);
      return;
    }
    insertSnippet(hit.insert, hit.caretOffset ?? hit.insert.length, hit.title);
  }

  function addCustomTemplate() {
    const name = window.prompt('模板名称', '我的公式模板')?.trim();
    const latex = window.prompt('LaTeX 内容', selected.latex)?.trim();
    if (!name || !latex) return;
    setCustomTemplates((current) => {
      const next = [...current, { id: `custom-${crypto.randomUUID()}`, name, latex, category: activeCategory, tags: ['自定义'] }];
      localStorage.setItem('formula-workbench.custom-templates', JSON.stringify(next));
      return next;
    });
    setMessage(`已保存自定义模板：${name}`);
  }

  function selectTheme(nextTheme: ThemeId) {
    setThemeId(nextTheme);
    localStorage.setItem('formula-workbench.theme', nextTheme);
    setShowThemePicker(false);
  }

  function selectRibbonTab(tab: RibbonTab) {
    setActiveRibbonTab(tab);
    if (tab === 'templates') setShowTemplates(true);
  }

  function changeLayout(mode: LayoutMode) {
    setLayoutMode(mode);
    setMessage(mode === 'split' ? '已恢复左右分屏' : mode === 'editor' ? '已展开编辑区' : '已展开预览区');
  }

  function toggleOrientation() {
    const next = splitOrientation === 'vertical' ? 'horizontal' : 'vertical';
    setSplitOrientation(next);
    setLayoutMode('split');
    setMessage(next === 'vertical' ? '已切换为上下分屏' : '已切换为左右分屏');
  }

  function collapsePreview() {
    setLayoutMode('editor');
    setMessage('预览区已向右收起');
  }

  function beginPreviewEdit() {
    setLayoutMode('split');
    setPreviewDraft(selected.latex);
    setIsPreviewEditing(true);
    setMessage('正在编辑右侧预览公式');
  }

  function finishPreviewEdit() {
    patchSelected({ latex: previewDraft });
    setIsPreviewEditing(false);
    setMessage('已同步到 LaTeX 编辑器');
  }

  function cancelPreviewEdit() {
    setIsPreviewEditing(false);
    setPreviewDraft(selected.latex);
    setMessage('已取消右侧编辑');
  }

  function switchSidebarModule(module: SidebarModule) {
    setSidebarModule(module);
    setShowSymbols(false);
    if (module === 'templates') setShowTemplates(false);
    if (module === 'modeling') {
      setActiveCategory('数学建模');
      setShowTemplates(false);
    }
  }

  function beginResize(handle: 'sidebar' | 'editor' | 'height') {
    setResizing(handle);
  }

  async function toggleFullscreen() {
    if (!window.desktop) return setMessage('桌面模式下可切换全屏');
    const next = await window.desktop.window.toggleFullscreen();
    setIsFullscreen(next);
    setMessage(next ? '已进入全屏' : '已退出全屏');
  }

  function addFormula() {
    const formula = newFormula(`公式 ${project.formulas.length + 1}`, 'y = f(x)');
    commitProject((current) => ({ ...current, formulas: [...current.formulas, formula], updatedAt: formula.updatedAt }));
    setSelectedId(formula.id);
    setMessage('已新建公式');
  }

  function createNewProject() {
    const name = window.prompt('新公式集名称', '未命名公式集');
    if (name === null) return;
    const next = createProject(name.trim() || '未命名公式集');
    historyRef.current = [];
    redoRef.current = [];
    projectRef.current = next;
    setBatchIds([]);
    setProject(next);
    setSelectedId(next.formulas[0].id);
    setMessage(`已新建公式集：${next.title}（${next.formulas.length} 条示例公式）`);
  }

  function toggleBatch(id: string) {
    setBatchIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function copyBatch() {
    const text = project.formulas.filter((formula) => batchIds.includes(formula.id)).map((formula) => formula.latex).join('\n\n');
    if (!text) return setMessage('没有选中的公式');
    try {
      await writeClipboard({ text });
      setMessage(`已复制 ${batchIds.length} 条公式的 LaTeX`);
    } catch (error) {
      setMessage(error instanceof Error ? `复制失败：${error.message}` : '复制失败');
    }
  }

  async function exportBatch() {
    return exportFormulas(batchIds);
  }

  function applyStyleToBatch() {
    if (!batchIds.length) return;
    const stamp = new Date().toISOString();
    commitProject((current) => ({
      ...current,
      formulas: current.formulas.map((formula) => (batchIds.includes(formula.id) ? { ...formula, style: { ...selected.style }, updatedAt: stamp } : formula)),
      updatedAt: stamp
    }));
    setMessage(`已把当前样式同步到 ${batchIds.length} 条公式`);
  }

  function removeBatch() {
    if (project.formulas.length - batchIds.length < 1) return setMessage('至少需要保留一条公式');
    const next = project.formulas.filter((formula) => !batchIds.includes(formula.id));
    const stamp = new Date().toISOString();
    commitProject((current) => ({ ...current, formulas: next, updatedAt: stamp }));
    if (!next.some((formula) => formula.id === selected.id)) setSelectedId(next[0].id);
    setMessage(`已删除 ${batchIds.length} 条公式`);
    setBatchIds([]);
  }

  function reorderFormula(targetId: string) {
    const fromId = dragIdRef.current;
    dragIdRef.current = null;
    if (!fromId || fromId === targetId) return;
    commitProject((current) => reorderFormulas(current, fromId, targetId));
    setMessage('已调整公式顺序');
  }

  function addMacro() {
    const raw = macroName.trim();
    const name = raw.startsWith('\\') ? raw : `\\${raw}`;
    const body = macroBody.trim();
    if (name === '\\' || !body) return setMessage('请填写宏名称与内容');
    commitProject((current) => ({
      ...current,
      macros: { ...current.macros, [name]: body },
      updatedAt: new Date().toISOString()
    }));
    setMacroName('');
    setMacroBody('');
    setMessage(`已添加宏：${name}`);
  }

  function removeMacro(name: string) {
    commitProject((current) => {
      const macros = { ...current.macros };
      delete macros[name];
      return { ...current, macros, updatedAt: new Date().toISOString() };
    });
    setMessage(`已删除宏：${name}`);
  }

  function wordHtml(): string {
    return `<html><body><!--StartFragment-->${preview.ok ? preview.mathml : ''}<!--EndFragment--></body></html>`;
  }

  async function renderImage(): Promise<{ svg: string; png: string }> {
    if (!preview.ok) throw new Error('公式存在错误');
    const { svg, width, height } = buildFormulaImage(preview.html, getKatexCssWithFonts());
    return { svg, png: await svgToPngDataUrl(svg, width, height) };
  }

  async function writeClipboard(payload: { text?: string; html?: string; image?: string }) {
    const api = window.desktop;
    if (api) return api.clipboard.write(payload);
    if (payload.image) throw new Error('浏览器模式不支持复制图片，请改用桌面模式或另存为文件');
    if (payload.html) {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('当前浏览器不支持 HTML 复制');
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([payload.html], { type: 'text/html' }),
        'text/plain': new Blob([payload.text ?? ''], { type: 'text/plain' })
      })]);
      return;
    }
    await navigator.clipboard.writeText(payload.text ?? '');
  }

  async function copyAs(format: CopyFormat) {
    if (format !== 'latex' && !preview.ok) return setMessage('公式存在错误，暂时无法复制');
    try {
      if (format === 'latex') {
        await writeClipboard({ text: selected.latex });
        return setMessage('已复制 LaTeX 源码');
      }
      if (format === 'html') {
        await writeClipboard({ html: wordHtml(), text: selected.latex });
        return setMessage('已复制 HTML（Word 兼容）');
      }
      if (format === 'png') {
        const { png } = await renderImage();
        await writeClipboard({ image: png });
        return setMessage('已复制 PNG 图片');
      }
      const api = window.desktop;
      if (api) await api.clipboard.copyOfficeMath({ latex: selected.latex, mathml: preview.mathml });
      else await navigator.clipboard.writeText(preview.mathml);
      setMessage('已复制为可编辑 Word 公式');
    } catch (error) {
      setMessage(error instanceof Error ? `复制失败：${error.message}` : '复制失败');
    }
  }

  async function saveImage(kind: 'png' | 'svg') {
    const api = window.desktop;
    if (!api) return setMessage('桌面模式下可保存图片');
    if (!preview.ok) return setMessage('公式存在错误，暂时无法保存图片');
    try {
      const { svg, png } = await renderImage();
      const savedPath = await api.exports.saveImage({ kind, svg, dataUrl: png, defaultName: sanitizeFileName(selected.name) });
      setMessage(savedPath ? `图片已保存：${savedPath.split(/[\\/]/).at(-1)}` : '已取消保存');
    } catch (error) {
      setMessage(error instanceof Error ? `保存图片失败：${error.message}` : '保存图片失败');
    }
  }

  async function exportFormulas(ids: string[]) {
    const api = window.desktop;
    if (!api) return setMessage('桌面模式下可导出 DOCX');
    const items: DocxFormula[] = [];
    let skipped = 0;
    for (const formula of project.formulas) {
      if (!ids.includes(formula.id)) continue;
      const rendered = renderLatex(formula.latex, 'block', project.macros);
      if (!rendered.ok) {
        skipped += 1;
        continue;
      }
      const formulaStyle = effectiveStyle(project, formula);
      items.push({ name: formula.name, mathml: rendered.mathml, displayMode: formula.displayMode, fontFamily: formulaStyle.fontFamily, fontSizePt: formulaStyle.fontSizePt });
    }
    if (!items.length) return setMessage('选中的公式无法解析，暂时不能导出');
    try {
      const savedPath = await api.exports.createDocx({ parts: buildDocxParts(project.title, items, true), defaultName: sanitizeFileName(project.title) });
      setMessage(savedPath ? `DOCX 已保存：${savedPath.split(/[\\/]/).at(-1)}${skipped ? `，跳过 ${skipped} 条错误公式` : ''}` : '已取消导出');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'DOCX 导出失败');
    }
  }

  function exportDocx() {
    return exportFormulas(project.formulas.map((formula) => formula.id));
  }

  function applyOpenedProject(raw: unknown, recent?: string[]) {
    const opened = parseProject(raw);
    historyRef.current = [];
    redoRef.current = [];
    projectRef.current = opened;
    setBatchIds([]);
    setProject(opened);
    setSelectedId(opened.formulas[0].id);
    if (recent) setRecentProjects(recent);
    setMessage(`项目已打开：${opened.title}（${opened.formulas.length} 条公式）`);
  }

  async function openProject() {
    const api = window.desktop;
    if (!api) return setMessage('桌面模式下可打开项目');
    try {
      const opened = await api.project.open();
      if (opened) applyOpenedProject(opened.project, opened.recent);
    } catch (error) {
      setMessage(error instanceof Error ? `打开失败：${error.message}` : '打开失败');
    }
  }

  async function openRecentProject(filePath: string) {
    const api = window.desktop;
    if (!api) return setMessage('桌面模式下可打开项目');
    try {
      const opened = await api.project.openPath(filePath);
      applyOpenedProject(opened.project, opened.recent);
    } catch (error) {
      setMessage(error instanceof Error ? `打开失败：${error.message}` : '打开失败');
    }
  }

  async function saveProject() {
    const api = window.desktop;
    if (!api) return setMessage('桌面模式下可保存项目');
    try {
      const saved = await api.project.save(project);
      if (saved) {
        setRecentProjects(saved.recent);
        setMessage(`已保存：${saved.path.split(/[\\/]/).at(-1)}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? `保存失败：${error.message}` : '保存失败');
    }
  }

  async function importFileEntries(entries: ImportFileEntry[], openDirectly = false) {
    if (!entries.length) return;
    const remoteFiles = importMode === 'online' ? entries.filter((file) => isOnlineOcrSupported(file.name)) : [];
    if (remoteFiles.length) {
      if (!window.desktop) return setMessage('联网识别需要桌面版并配置 Mathpix');
      if (!mathpixConfigured) return setMessage('请先打开文件识别设置并配置 Mathpix 凭据');
      const names = remoteFiles.map((file) => `• ${file.name}${file.size ? `（${(file.size / 1024 / 1024).toFixed(1)} MB）` : ''}`).join('\n');
      const accepted = window.confirm(`联网识别将把以下整份文件上传至 Mathpix 处理：\n\n${names}\n\n处理完成后应用会请求删除远端原件和结果；服务商的缓存可能短时保留。只有本次任务会上传。确认继续？`);
      if (!accepted) return setMessage('已取消联网识别，文件未上传');
    }
    const additions: FormulaItem[] = [];
    const report: string[] = [];
    let directProject: ProjectFile | null = null;
    setMessage(`正在读取 ${entries.length} 个文件…`);
    for (const file of entries) {
      try {
        const base = file.name.replace(/\.[^.]+$/, '');
        const imported = await extractImportedFile(file, importMode, async (name, kind, bytes) => {
          const jobId = crypto.randomUUID();
          setActiveImport({ name, stage: '准备上传', percent: 0 });
          try {
            const result = await window.desktop!.ocr.recognizeOnline({ name, kind, bytes, jobId });
            return result.text;
          } finally {
            setActiveImport(null);
          }
        }, async (name, kind, bytes) => {
          if (!window.desktop) throw new Error('本地 OCR 需要桌面版');
          const jobId = crypto.randomUUID();
          setActiveImport({ name, stage: '自动下载本地 OCR 运行环境和模型', percent: 0 });
          try {
            const prepared = kind === 'image' ? await prepareImageForLocalOcr(name, bytes) : { name, bytes };
            const result = await window.desktop.ocr.recognizeLocal({ name: prepared.name, kind, bytes: prepared.bytes, jobId });
            return result.text;
          } finally {
            setActiveImport(null);
          }
        }, async (name, bytes) => {
          if (!window.desktop) throw new Error('旧版 Office 转换需要桌面版');
          return window.desktop.files.convertLegacyOffice({ name, bytes });
        });
        if (imported.project) {
          const sourceProject = imported.project;
          if (openDirectly && entries.length === 1) directProject = sourceProject;
          else {
            const stamp = new Date().toISOString();
            sourceProject.formulas.forEach((formula) => additions.push({ ...formula, id: crypto.randomUUID(), name: `${base} · ${formula.name}`, createdAt: stamp, updatedAt: stamp }));
          }
        } else {
          imported.formulas.forEach((formula, index) => additions.push(newFormula(`${base} · ${index + 1}`, formula.latex, formula.displayMode)));
        }
        report.push(`${file.name}（${imported.format}）：${imported.project?.formulas.length ?? imported.formulas.length} 条公式${imported.warnings.length ? `；${imported.warnings.join('；')}` : ''}`);
      } catch (error) {
        report.push(`${file.name}：${error instanceof Error ? error.message : '读取失败'}，已跳过`);
      }
    }

    setActiveImport(null);
    if (directProject) {
      applyOpenedProject(directProject);
      setMessage(`项目已打开：${directProject.title}（${directProject.formulas.length} 条公式）`);
      return;
    }
    if (!additions.length) return setMessage(`没有识别到可导入公式；${report.join('；')}`);
    if (openDirectly && entries.length === 1) {
      applyImportedFormulas(additions, true, report);
      return;
    }
    setPendingImport({ formulas: additions, report });
    setMessage(`识别完成：发现 ${additions.length} 条候选公式，等待复核`);
  }

  function applyImportedFormulas(formulas: FormulaItem[], openedDirectly = false, report: string[] = []) {
    setPendingImport(null);
    const merged = mergeImportedFormulas(project, formulas);
    if (!merged.added) return setMessage(`没有新增公式（${merged.skipped} 条重复或为空）`);
    commitProject(merged.project);
    setSelectedId(merged.project.formulas[merged.project.formulas.length - merged.added].id);
    setMessage(openedDirectly
      ? `文件已打开：新增 ${merged.added} 条公式，首条已进入编辑与预览${report.length ? `；${report.join('；')}` : ''}`
      : `导入完成：新增 ${merged.added} 条，重复跳过 ${merged.skipped} 条`);
  }

  async function importFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    await importFileEntries(files.map((file) => ({ name: file.name, type: file.type, size: file.size, readBytes: async () => new Uint8Array(await file.arrayBuffer()) })));
  }

  async function openFileDirectly(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    await importFileEntries(files.map((file) => ({ name: file.name, type: file.type, size: file.size, readBytes: async () => new Uint8Array(await file.arrayBuffer()) })), true);
  }

  async function importDroppedFiles(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!files.length) return setMessage('请将文件拖入窗口，文件夹请使用“导入文件夹”按钮');
    await importFileEntries(files.map((file) => ({ name: file.name, type: file.type, size: file.size, readBytes: async () => new Uint8Array(await file.arrayBuffer()) })));
  }

  async function saveMathpixCredentials(appId: string, appKey: string) {
    if (!window.desktop) return setMessage('联网识别凭据只能保存在桌面版');
    setOcrSettingsBusy(true);
    try {
      await window.desktop.ocr.saveMathpixCredentials({ appId, appKey });
      setMathpixConfigured(true);
      setShowOcrSettings(false);
      setMessage('Mathpix 凭据已加密保存在本机');
    } catch (error) {
      setMessage(error instanceof Error ? `凭据保存失败：${error.message}` : '凭据保存失败');
    } finally {
      setOcrSettingsBusy(false);
    }
  }

  async function removeMathpixCredentials() {
    if (!window.desktop || !window.confirm('删除已保存的 Mathpix 凭据？')) return;
    setOcrSettingsBusy(true);
    try {
      await window.desktop.ocr.removeMathpixCredentials();
      setMathpixConfigured(false);
      setShowOcrSettings(false);
      setMessage('已删除 Mathpix 凭据');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除凭据失败');
    } finally {
      setOcrSettingsBusy(false);
    }
  }

  async function pasteFormulaFromClipboard() {
    const api = window.desktop;
    if (!api) return setMessage('桌面模式下可从剪贴板导入公式');
    try {
      const { text, html } = await api.clipboard.read();
      const looksLikeLatex = /(\$\$|\$|\\\[|\\begin\{|\\frac|\\sqrt|[a-zA-Z]\^|_\{)/.test(text);
      const candidate = extractMathml(html) ?? extractMathml(text) ?? (looksLikeLatex ? text : '');
      if (!candidate.trim()) return setMessage('剪贴板中没有可识别的公式');
      if (/<(\w+:)?math[\s>]/i.test(candidate)) {
        const latex = mathmlToLatex(candidate);
        if (!latex.trim()) return setMessage('无法从剪贴板的 MathML 中提取公式');
        patchSelected({ latex });
        setMessage('已把剪贴板的 MathML 转换为 LaTeX');
      } else {
        patchSelected({ latex: candidate.trim() });
        setMessage('已从剪贴板导入 LaTeX 源码');
      }
    } catch (error) {
      setMessage(error instanceof Error ? `粘贴失败：${error.message}` : '粘贴失败');
    }
  }

  const pasteRef = useRef(pasteFormulaFromClipboard);
  pasteRef.current = pasteFormulaFromClipboard;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!((event.ctrlKey || event.metaKey) && event.shiftKey) || event.key.toLowerCase() !== 'v') return;
      event.preventDefault();
      void pasteRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function openFileViewer() {
    const api = window.desktop;
    if (!api) return setMessage('桌面模式下可查看文件');
    try {
      const paths = await api.files.pick();
      if (!paths.length) return;
      const files = await Promise.all(paths.map((filePath) => api.files.read(filePath)));
      setViewer({ files, index: 0 });
    } catch (error) {
      setMessage(error instanceof Error ? `读取文件失败：${error.message}` : '读取文件失败');
    }
  }

  function viewerImport(file: ViewerFile) {
    const readBytes = async () => file.data ? decodeBase64File(file.data) : new TextEncoder().encode(file.text ?? '');
    void importFileEntries([{ name: file.name, type: file.mime, readBytes }]);
  }

  async function viewerCopy(file: ViewerFile) {
    try {
      await writeClipboard({ text: file.text ?? '' });
      setMessage(`已复制 ${file.name} 的内容`);
    } catch (error) {
      setMessage(error instanceof Error ? `复制失败：${error.message}` : '复制失败');
    }
  }

  async function viewerOpenExternal(filePath: string) {
    const error = await window.desktop?.files.openExternal(filePath);
    if (error) setMessage(`系统打开失败：${error}`);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (workspaceMode === 'documents') return;
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier) return;
    const key = event.key.toLowerCase();
    if (key === 'enter') { event.preventDefault(); if (isPreviewEditing) finishPreviewEdit(); else void copyAs(copyFormat); }
    if (key === 's') { event.preventDefault(); void saveProject(); }
    if (key === 'o') { event.preventDefault(); void openProject(); }
    if (key === 'n') { event.preventDefault(); createNewProject(); }
    if (key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
    if (key === 'y' || (key === 'z' && event.shiftKey)) { event.preventDefault(); redo(); }
  }

  function switchWorkspace(next: 'formulas' | 'documents') {
    if (workspaceMode === 'documents' && next === 'formulas' && documentDirty && !window.confirm('文档仍有未保存更改，切回公式工作台后也会保留。确定切换吗？')) return;
    setWorkspaceMode(next);
    setShowTemplates(false);
    setPaletteOpen(false);
    setViewer(null);
  }

  async function extractDocumentFormulas(name: string, bytes: Uint8Array) {
    await importFileEntries([{ name, size: bytes.byteLength, readBytes: async () => new Uint8Array(bytes) }], true);
  }

  return (
    <div className="app-shell" data-theme={themeId} data-workspace={workspaceMode} onKeyDown={handleKeyDown} onDragOver={(event) => { if (event.dataTransfer?.types?.includes('Files')) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); if (workspaceMode === 'formulas' && event.dataTransfer?.files?.length) void importDroppedFiles(event); }}>
      <header className="titlebar">
        <div className="brand"><div className="brand-mark">∑</div><div><div className="brand-title">公式工作台</div><div className="brand-subtitle">LaTeX → Word</div></div></div>
        <div className="workspace-switch" role="tablist" aria-label="工作区"><button role="tab" aria-selected={workspaceMode === 'formulas'} className={workspaceMode === 'formulas' ? 'active' : ''} onClick={() => switchWorkspace('formulas')}>公式工作台</button><button role="tab" aria-selected={workspaceMode === 'documents'} className={workspaceMode === 'documents' ? 'active' : ''} onClick={() => switchWorkspace('documents')}>文档工作区{documentDirty ? ' ·' : ''}</button></div>
        <div className="title-actions"><Tooltip relationship="label" content="主题"><Button appearance="subtle" icon={<Settings2 size={16} />} onClick={() => setShowThemePicker((value) => !value)} /></Tooltip><Button appearance="subtle" icon={<MoreHorizontal size={17} />} /></div>
        {showThemePicker && <div className="theme-popover" ref={themePopoverRef}><div className="theme-popover-title">主题色</div><div className="theme-options">{THEMES.map((theme) => <button key={theme.id} className={`theme-option ${themeId === theme.id ? 'selected' : ''}`} onClick={() => selectTheme(theme.id)}><span className="theme-swatch" style={{ background: theme.color }} /><span>{theme.name}</span>{themeId === theme.id && <span className="theme-check">✓</span>}</button>)}</div><div className="theme-tip">主题色会同步应用到边框、按钮和选中状态</div></div>}
      </header>

      {showOcrSettings && <ImportSettings configured={mathpixConfigured} busy={ocrSettingsBusy} onSave={(appId, appKey) => { void saveMathpixCredentials(appId, appKey); }} onRemove={() => { void removeMathpixCredentials(); }} onClose={() => setShowOcrSettings(false)} />}
      {pendingImport && <ImportReview formulas={pendingImport.formulas} report={pendingImport.report} macros={project.macros} onApply={applyImportedFormulas} onClose={() => setPendingImport(null)} />}
      {activeImport && <div className="import-progress-toast"><div><strong>{activeImport.name}</strong><span>{activeImport.stage}{activeImport.percent ? ` · ${Math.round(activeImport.percent)}%` : ''}</span></div><progress max="100" value={activeImport.percent} /></div>}

      <nav className="commandbar">
      <div className="ribbon">
        <div className="ribbon-tabs"><button className={activeRibbonTab === 'start' ? 'active' : ''} onClick={() => selectRibbonTab('start')}>开始</button><button className={activeRibbonTab === 'insert' ? 'active' : ''} onClick={() => selectRibbonTab('insert')}>插入</button><button className={activeRibbonTab === 'templates' ? 'active' : ''} onClick={() => selectRibbonTab('templates')}>模板</button><button className={activeRibbonTab === 'export' ? 'active' : ''} onClick={() => selectRibbonTab('export')}>导出</button><button className={activeRibbonTab === 'view' ? 'active' : ''} onClick={() => selectRibbonTab('view')}>视图</button></div>
        <div className="ribbon-tools">
          {(activeRibbonTab === 'start' || activeRibbonTab === 'insert') && <div className="tool-group">
            <Button appearance="subtle" icon={<FilePlus2 size={16} />} onClick={createNewProject}>新建</Button>
            <Button appearance="subtle" icon={<FolderOpen size={16} />} onClick={openProject}>打开项目</Button>
            <Button appearance="subtle" icon={<FileText size={16} />} onClick={() => openFileRef.current?.click()}>打开文件</Button>
            <Button appearance="subtle" icon={<Upload size={16} />} onClick={() => importRef.current?.click()}>批量导入</Button>
            <Button appearance="subtle" icon={<Download size={16} />} onClick={saveProject}>保存</Button>
          </div>}
          {(activeRibbonTab === 'start' || activeRibbonTab === 'insert') && <div className="tool-separator" />}
          {(activeRibbonTab === 'start' || activeRibbonTab === 'view') && <div className="tool-group"><Button appearance="subtle" icon={<Undo2 size={16} />} onClick={undo}>撤销</Button><Button appearance="subtle" icon={<Redo2 size={16} />} onClick={redo}>重做</Button></div>}
          {activeRibbonTab === 'start' && <div className="tool-separator" />}
          {(activeRibbonTab === 'insert' || activeRibbonTab === 'templates') && <div className="tool-group"><Button appearance="subtle" icon={<Plus size={16} />} onClick={addFormula}>插入公式</Button><Button appearance="subtle" icon={<Sigma size={16} />} onClick={() => switchSidebarModule('symbols')}>数学符号</Button><Button appearance="subtle" icon={<BookOpen size={16} />} onClick={() => switchSidebarModule('templates')}>打开模板</Button><Button appearance="subtle" icon={<WandSparkles size={16} />} onClick={addCustomTemplate}>新建模板</Button></div>}
          {(activeRibbonTab === 'export' || activeRibbonTab === 'start') && <div className="tool-group"><Button appearance="subtle" icon={<ClipboardPaste size={16} />} onClick={() => void pasteFormulaFromClipboard()} title="Ctrl/⌘ + Shift + V，支持 Word 公式（MathML）与 LaTeX 源码">粘贴公式</Button><Button appearance="subtle" icon={<Copy size={16} />} onClick={() => void copyAs(copyFormat)}>复制{currentCopyLabel}</Button><Button appearance="subtle" icon={<Download size={16} />} onClick={exportDocx}>导出 DOCX</Button>{activeRibbonTab === 'export' && <><Dropdown size="small" className="copy-format-dropdown" value={currentCopyLabel} onOptionSelect={(_, data) => setCopyFormat(data.optionValue as CopyFormat)}>{COPY_FORMATS.map((format) => <Option key={format.id} value={format.id}>{format.label}</Option>)}</Dropdown><Button appearance="subtle" icon={<FileImage size={16} />} onClick={() => void saveImage('svg')}>存为 SVG</Button><Button appearance="subtle" icon={<ImageDown size={16} />} onClick={() => void saveImage('png')}>存为 PNG</Button></>}</div>}
          {activeRibbonTab === 'view' && <div className="tool-group"><Button appearance="subtle" icon={<PanelLeft size={16} />} onClick={() => setShowFormulaList((value) => !value)}>{showFormulaList ? '隐藏公式列表' : '显示公式列表'}</Button><Button appearance="subtle" icon={<BookOpen size={16} />} onClick={() => setShowTemplates((value) => !value)}>{showTemplates ? '关闭模板面板' : '打开模板面板'}</Button><Button appearance="subtle" icon={<PanelRightClose size={16} />} onClick={() => changeLayout('editor')}>展开编辑</Button><Button appearance="subtle" icon={<PanelLeftClose size={16} />} onClick={() => changeLayout('preview')}>展开预览</Button><Button appearance="subtle" icon={<Columns2 size={16} />} onClick={() => changeLayout('split')}>恢复分屏</Button><Button appearance="subtle" icon={splitOrientation === 'vertical' ? <Rows2 size={16} /> : <Columns2 size={16} />} onClick={toggleOrientation}>{splitOrientation === 'vertical' ? '左右分屏' : '上下分屏'}</Button><Button appearance="subtle" icon={isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />} onClick={toggleFullscreen}>{isFullscreen ? '退出全屏' : '全屏'}</Button><Button appearance="subtle" icon={<Settings2 size={16} />} onClick={() => setShowThemePicker(true)}>主题色</Button></div>}
          <div className="ribbon-spacer" /><div className="compat-pill"><span className="compat-dot" />Word 可编辑</div>
        </div>
        <input ref={importRef} type="file" multiple accept={supportedImportAccept()} hidden onChange={importFiles} />
        <input ref={openFileRef} type="file" multiple accept={supportedImportAccept()} hidden onChange={openFileDirectly} />
        <input ref={folderRef} type="file" multiple hidden onChange={importFiles} />
      </div>
      </nav>

      <div hidden={workspaceMode !== 'documents'} className="document-workspace-overlay"><DocumentWorkspace active={workspaceMode === 'documents'} onDirtyChange={setDocumentDirty} onExtractFormulas={extractDocumentFormulas} /></div>

      <main ref={workspaceRef} className={`workspace ${showFormulaList ? '' : 'sidebar-collapsed'} ${resizing ? 'is-resizing' : ''}`} data-layout={layoutMode} data-orientation={splitOrientation} style={{ '--sidebar-width': `${splitRatios.sidebar * 100}%`, '--editor-width': `${splitRatios.editor * 100}%`, '--editor-height': `${splitVertical * 100}%` } as React.CSSProperties}>
        {showFormulaList && <aside className="formula-sidebar">
          <nav className="sidebar-switcher" aria-label="工作区模块">
            <button className={sidebarModule === 'files' ? 'active' : ''} onClick={() => switchSidebarModule('files')} title="文件"><FolderOpen size={16} /><span>文件</span></button>
            <button className={sidebarModule === 'formulas' ? 'active' : ''} onClick={() => switchSidebarModule('formulas')} title="公式"><Sigma size={16} /><span>公式</span></button>
            <button className={sidebarModule === 'symbols' ? 'active' : ''} onClick={() => switchSidebarModule('symbols')} title="符号"><Sigma size={16} /><span>符号</span></button>
            <button className={sidebarModule === 'templates' ? 'active' : ''} onClick={() => switchSidebarModule('templates')} title="模板"><BookOpen size={16} /><span>模板</span></button>
            <button className={sidebarModule === 'modeling' ? 'active' : ''} onClick={() => switchSidebarModule('modeling')} title="数学建模"><ChartNoAxesCombined size={16} /><span>建模</span></button>
            <button className={sidebarModule === 'macros' ? 'active' : ''} onClick={() => switchSidebarModule('macros')} title="宏"><Braces size={16} /><span>宏</span></button>
          </nav>
          <div className="sidebar-module">
            {sidebarModule === 'files' && <div className="file-module">
              <div className="sidebar-heading"><span>文件</span></div>
              <div className="file-actions">
                <Button appearance="subtle" icon={<FilePlus2 size={16} />} onClick={createNewProject}>新建项目</Button>
                <Button appearance="subtle" icon={<FolderOpen size={16} />} onClick={openProject}>打开项目</Button>
                <Button appearance="subtle" icon={<FileText size={16} />} onClick={() => openFileRef.current?.click()}>打开文件</Button>
                <Button appearance="subtle" icon={<Download size={16} />} onClick={saveProject}>保存项目</Button>
                <Button appearance="subtle" icon={<Upload size={16} />} onClick={() => importRef.current?.click()}>批量导入</Button>
                <Button appearance="subtle" icon={<FolderInput size={16} />} onClick={() => folderRef.current?.click()}>导入文件夹</Button>
                <Button appearance="subtle" icon={<Eye size={16} />} onClick={openFileViewer}>查看文件</Button>
              </div>
              <div className="import-mode-row"><span>识别模式</span><Dropdown size="small" value={importMode === 'auto' ? '自动' : importMode === 'offline' ? '本地离线' : '联网识别'} selectedOptions={[importMode]} onOptionSelect={(_, data) => setImportMode(data.optionValue as ImportMode)}><Option value="auto">自动</Option><Option value="offline">本地离线</Option><Option value="online" disabled={!window.desktop}>联网识别</Option></Dropdown><Button size="small" appearance="subtle" onClick={() => setShowOcrSettings(true)}>设置</Button></div>
              <div className="recent-heading">当前项目</div>
              <button className="recent-project selected" onClick={() => setSidebarModule('formulas')}><FileText size={15} /><span><strong>{project.title}</strong><small>{project.formulas.length} 条公式</small></span></button>
              {recentProjects.length > 0 && <><div className="recent-heading">最近项目</div><div className="recent-list">{recentProjects.map((filePath) => <button className="recent-item" key={filePath} onClick={() => openRecentProject(filePath)} title={filePath}><FileText size={13} /><span>{filePath.split(/[\\/]/).at(-1)}</span></button>)}</div></>}
              <div className="file-tip">支持文本、Office、OpenDocument、EPUB、PDF 和常见图片；扫描页及图片公式可用本地或联网 OCR。</div>
            </div>}
            {sidebarModule === 'formulas' && <div className="formula-module"><div className="sidebar-heading"><span>公式集合</span><Button appearance="subtle" size="small" icon={<Plus size={15} />} onClick={addFormula} /></div><div className="sidebar-search"><Search size={14} /><input placeholder="搜索公式、分类或 LaTeX" value={formulaSearch} onChange={(event) => setFormulaSearch(event.target.value)} /></div>{batchIds.length > 0 && <div className="batch-bar"><span className="batch-count">已选 {batchIds.length} 条</span><div className="batch-actions"><Button size="small" appearance="subtle" icon={<Copy size={13} />} onClick={copyBatch}>复制</Button><Button size="small" appearance="subtle" icon={<Download size={13} />} onClick={exportBatch}>导出</Button><Button size="small" appearance="subtle" icon={<WandSparkles size={13} />} onClick={applyStyleToBatch}>同步样式</Button><Button size="small" appearance="subtle" icon={<Trash2 size={13} />} onClick={removeBatch}>删除</Button><Button size="small" appearance="subtle" onClick={() => setBatchIds([])}>取消</Button></div></div>}<div className="formula-collection-scroll"><div className="collection-section-title">当前项目 · {project.formulas.length}</div><div className="formula-list project-formula-list">{visibleFormulas.map((formula) => <button key={formula.id} className={`formula-item ${formula.id === selected.id ? 'selected' : ''} ${batchIds.includes(formula.id) ? 'batch-selected' : ''}`} onClick={(event) => { if (event.ctrlKey || event.metaKey) toggleBatch(formula.id); else setSelectedId(formula.id); }} title="拖拽可调整顺序，Ctrl/⌘ + 点击可多选" draggable onDragStart={() => { dragIdRef.current = formula.id; }} onDragEnd={() => { dragIdRef.current = null; }} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderFormula(formula.id)}><div className="formula-item-title">{formula.name}</div><div className="formula-item-preview">{formula.latex}</div><div className="formula-item-meta">{formula.displayMode === 'block' ? '块级' : '行内'} · {formula.updatedAt.slice(11, 16)}</div></button>)}</div><div className="collection-section-title builtin-title">内置公式库 · {visibleCatalog.length}</div><div className="formula-catalog-list">{visibleCatalog.map((template) => <button key={template.id} className="formula-catalog-item" onClick={() => insertTemplate(template.latex, template.name)}><span className="catalog-preview" dangerouslySetInnerHTML={{ __html: mathPreviewHtml(template.latex) }} /><span className="catalog-info"><strong>{template.name}</strong><small>{template.category}</small></span></button>)}</div></div><div className="sidebar-footer"><span>{project.formulas.length} 条项目公式 · {BUILT_IN_TEMPLATES.length} 条内置公式</span><Button appearance="subtle" size="small" icon={<Star size={14} />} /></div></div>}
            {sidebarModule === 'symbols' && <div className="symbols-module"><div className="sidebar-heading"><span>数学符号</span><span className="module-count">{symbolPaletteMode === 'symbols' ? MATH_SYMBOLS.length : MATH_TEMPLATES.length}</span></div><div className="symbol-mode-switch"><button className={symbolPaletteMode === 'symbols' ? 'active' : ''} onClick={() => setSymbolPaletteMode('symbols')}>基础符号</button><button className={symbolPaletteMode === 'templates' ? 'active' : ''} onClick={() => setSymbolPaletteMode('templates')}>组合模板</button></div>{symbolPaletteMode === 'symbols' ? <><div className="symbol-category-list">{SYMBOL_CATEGORIES.map((category) => <button key={category} className={activeSymbolCategory === category ? 'active' : ''} onClick={() => setActiveSymbolCategory(category)}>{category}<span>{MATH_SYMBOLS.filter((symbol) => symbol.category === category).length}</span></button>)}</div><div className="sidebar-symbol-grid">{visibleSymbols.map((symbol) => <button key={symbol.id} className={`symbol-button symbol-${symbol.style}`} onClick={() => insertSymbol(symbol)} title={`${symbol.label} · ${symbol.insert.trim()}`}><span className="symbol-glyph" dangerouslySetInnerHTML={{ __html: mathPreviewHtml(symbol.latex) }} /><span className="symbol-code">{symbol.insert.trim()}</span></button>)}</div></> : <div className="sidebar-template-grid">{MATH_TEMPLATES.map((template) => <button key={template.id} className={`math-template-card math-template-${template.style}`} onClick={() => insertSymbol(template)} title={template.description}><span className="math-template-info"><span className="math-template-label">{template.label}</span><span className="math-template-description">{template.description}</span><code>{template.insert}</code></span><FitMathPreview latex={template.preview} macros={project.macros} /></button>)}</div>}</div>}
            {sidebarModule === 'templates' && <div className="templates-module"><div className="sidebar-heading"><span>公式模板</span><Button appearance="subtle" size="small" onClick={() => setShowTemplates(true)}>展开</Button></div><div className="sidebar-search"><Search size={14} /><input placeholder="搜索模板" value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} /></div><div className="sidebar-template-list">{visibleTemplates.slice(0, 12).map((template) => <button key={template.id} className="sidebar-template-card" onClick={() => insertTemplate(template.latex, template.name)}><span className="template-mini-glyph">{template.name.slice(0, 1)}</span><span><strong>{template.name}</strong><small>{template.latex}</small></span></button>)}</div></div>}
            {sidebarModule === 'modeling' && <div className="templates-module modeling-module"><div className="sidebar-heading"><span>数学建模公式</span><span className="module-count">{visibleTemplates.length}</span></div><div className="sidebar-search"><Search size={14} /><input placeholder="搜索建模公式" value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} /></div><div className="modeling-intro">优化、微分方程、统计推断、数值计算与运筹学</div><div className="sidebar-template-list">{visibleTemplates.map((template) => <button key={template.id} className="sidebar-template-card modeling-card" onClick={() => insertTemplate(template.latex, template.name)}><span className="template-mini-glyph">{template.name.slice(0, 1)}</span><span><strong>{template.name}</strong><small>{template.tags.join(' · ')}</small></span></button>)}</div></div>}
            {sidebarModule === 'macros' && <div className="macros-module"><div className="sidebar-heading"><span>宏定义</span><span className="module-count">{Object.keys(project.macros).length}</span></div><div className="macros-hint">宏在预览、图片与 DOCX 导出中统一生效，例如 <code>{'\\R'}</code> → <code>{'\\mathbb{R}'}</code></div><div className="macro-list">{Object.entries(project.macros).map(([name, body]) => <div className="macro-row" key={name}><code className="macro-name">{name}</code><span className="macro-arrow">→</span><code className="macro-body">{body}</code><button type="button" onClick={() => removeMacro(name)} aria-label={`删除宏 ${name}`}><X size={12} /></button></div>)}</div><div className="macro-editor"><input placeholder="\R" value={macroName} onChange={(event) => setMacroName(event.target.value)} aria-label="宏名称" /><input placeholder="\mathbb{R}" value={macroBody} onChange={(event) => setMacroBody(event.target.value)} aria-label="宏内容" /><Button appearance="primary" size="small" onClick={addMacro}>添加</Button></div></div>}
          </div>
        </aside>}

        <section className="editor-panel">
          <div className="panel-toolbar editor-toolbar"><div className="panel-actions editor-actions"><Button className="sidebar-toggle-button" appearance="subtle" size="small" icon={showFormulaList ? <ChevronLeft size={15} /> : <PanelLeft size={15} />} onClick={() => setShowFormulaList((value) => !value)} title={showFormulaList ? '收起左侧面板' : '展开左侧面板'} aria-label={showFormulaList ? '收起左侧面板' : '展开左侧面板'} /><div className="editor-right-actions"><div className="mode-toggle editor-mode-toggle"><button className={selected.displayMode === 'inline' ? 'active' : ''} onClick={() => patchSelected({ displayMode: 'inline' })}>行内</button><button className={selected.displayMode === 'block' ? 'active' : ''} onClick={() => patchSelected({ displayMode: 'block' })}>块级</button></div>{layoutMode === 'split' ? <Button className="editor-layout-button preview-collapse-button" appearance="subtle" size="small" icon={<PanelRightClose size={15} />} onClick={collapsePreview} title="向右收起预览区" aria-label="向右收起预览区" /> : layoutMode === 'editor' ? <Button className="editor-layout-button preview-expand-button" appearance="subtle" size="small" icon={<PanelRightOpen size={15} />} onClick={() => changeLayout('split')} title="展开预览区" aria-label="展开预览区" /> : null}</div></div></div>
          {showSymbols && <div className="symbol-palette"><div className="symbol-palette-header"><div><div className="symbol-palette-title"><Sigma size={16} />数学符号</div><div className="symbol-palette-hint">点击符号插入当前光标位置</div></div><button onClick={() => setShowSymbols(false)}>收起</button></div><div className="symbol-palette-body"><div className="symbol-category-list">{SYMBOL_CATEGORIES.map((category) => <button key={category} className={activeSymbolCategory === category ? 'active' : ''} onClick={() => setActiveSymbolCategory(category)}>{category}<span>{MATH_SYMBOLS.filter((symbol) => symbol.category === category).length}</span></button>)}</div><div className="symbol-grid">{visibleSymbols.map((symbol) => <button key={symbol.id} className={`symbol-button symbol-${symbol.style}`} onClick={() => insertSymbol(symbol)} title={`${symbol.label} · ${symbol.insert.trim()}`}><span className="symbol-glyph">{symbol.label}</span><span className="symbol-code">{symbol.insert.trim()}</span></button>)}</div></div></div>}
          <LatexEditor value={selected.latex} dark={themeId === 'black'} macros={project.macros} onChange={(value) => patchSelected({ latex: value })} onCreateEditor={(view) => { editorViewRef.current = view; }} onScrollRatio={handleEditorScroll} onCursor={setCursor} />
        </section>

        <section className="preview-panel">
          <div className="panel-toolbar">
            <div className="panel-title"><PanelRight size={16} />实时预览</div>
            <div className="panel-actions preview-style-controls">
              <div className="style-control">
                <span className="style-label">字体</span>
                <Dropdown size="small" value={FONT_OPTIONS.find((font) => font.family === style.fontFamily)?.label ?? style.fontFamily} selectedOptions={[style.fontFamily]} onOptionSelect={(_, data) => {
                  if (typeof data.optionValue === 'string') patchSelected({ style: { ...selected.style, fontFamily: data.optionValue } });
                }}>
                  {FONT_OPTIONS.map((font) => <Option key={font.family} value={font.family}>{font.label}</Option>)}
                </Dropdown>
              </div>
              <div className="style-control size-control"><span className="style-label">字号</span><input type="number" min="6" max="96" step="0.5" value={style.fontSizePt} onChange={(event) => patchSelected({ style: { ...selected.style, fontSizePt: Math.min(96, Math.max(6, Number(event.target.value) || 14)) } })} /><span>pt</span></div>
              <Button appearance={isPreviewEditing ? 'primary' : 'subtle'} size="small" icon={isPreviewEditing ? <Check size={14} /> : <Pencil size={14} />} onClick={isPreviewEditing ? finishPreviewEdit : beginPreviewEdit}>{isPreviewEditing ? '完成编辑' : '编辑预览'}</Button>
            </div>
          </div>
          <div className={`preview-stage ${isPreviewEditing ? 'preview-editing' : ''}`} ref={previewStageRef} onScroll={handlePreviewScroll} onDoubleClick={isPreviewEditing ? undefined : beginPreviewEdit}>{isPreviewEditing ? <textarea className="preview-latex-editor" value={previewDraft} onChange={(event) => setPreviewDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancelPreviewEdit(); } }} autoFocus spellCheck={false} aria-label="右侧预览 LaTeX 编辑器" /> : <div className="formula-preview-scaler" style={{ transform: `scale(${formulaScale})` }}><div className={`formula-preview ${selected.displayMode}`} style={{ fontFamily: style.fontFamily, fontSize: `${style.fontSizePt}px`, maxWidth: '100%' }}>{preview.ok ? <div dangerouslySetInnerHTML={{ __html: preview.html }} /> : <div className="preview-error"><div>无法渲染公式</div><code>{preview.message}</code></div>}</div></div>}</div>
          {!preview.ok && <div className="error-banner">{preview.message}</div>}
        </section>
        {layoutMode === 'split' && splitOrientation === 'vertical' && <div className="workspace-splitter splitter-horizontal" onPointerDown={() => beginResize('height')} role="separator" aria-label="调整编辑区高度" />}
        {layoutMode === 'split' && showFormulaList && <div className="workspace-splitter splitter-sidebar" onPointerDown={() => beginResize('sidebar')} role="separator" aria-label="调整侧栏宽度" />}
        {layoutMode === 'split' && <div className={`workspace-splitter splitter-editor ${showFormulaList ? '' : 'sidebar-hidden'}`} onPointerDown={() => beginResize('editor')} role="separator" aria-label="调整编辑区和预览区宽度" />}
      </main>

      {showTemplates && <section className="template-drawer" ref={templateDrawerRef} role="dialog" aria-label="公式模板"><div className="template-header"><div><div className="template-title"><BookOpen size={17} />公式模板</div><div className="template-subtitle">选择模板插入当前公式</div></div><div className="panel-actions"><Button appearance="primary" size="small" onClick={addCustomTemplate}>新建模板</Button><Button appearance="subtle" onClick={() => setShowTemplates(false)}>关闭</Button></div></div><div className="template-body"><div className="template-nav">{TEMPLATE_CATEGORIES.map((category) => <button key={category} className={activeCategory === category ? 'active' : ''} onClick={() => setActiveCategory(category)}>{category}<span>{allTemplates.filter((template) => template.category === category).length}</span></button>)}</div><div className="template-content"><div className="template-search"><Search size={14} /><input placeholder="搜索模板" value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} /></div><div className="template-grid">{visibleTemplates.map((template) => <button className="template-card" key={template.id} onClick={() => insertTemplate(template.latex, template.name)}><div className="template-card-preview">{mathPreviewHtml(template.latex, 'block') ? <span dangerouslySetInnerHTML={{ __html: mathPreviewHtml(template.latex, 'block') }} /> : template.latex}</div><div className="template-card-name">{template.name}</div><div className="template-card-code">{template.latex}</div></button>)}</div></div></div></section>}

      {paletteOpen && <CommandPalette query={paletteQuery} hits={paletteHits} activeIndex={paletteIndex} onQuery={setPaletteQuery} onActiveIndex={setPaletteIndex} onPick={pickSearchHit} onClose={() => setPaletteOpen(false)} />}

      {viewer && <FileViewer files={viewer.files} index={viewer.index} onIndexChange={(index) => setViewer({ files: viewer.files, index })} onClose={() => setViewer(null)} onImport={viewerImport} onCopy={viewerCopy} onOpenExternal={viewerOpenExternal} onShowInFolder={(filePath) => { void window.desktop?.files.showInFolder(filePath); }} />}

      <footer className="statusbar"><div className="status-left"><span className="status-ready"><span className="status-dot" />就绪</span><span>{workspaceMode === 'documents' ? documentDirty ? '文档有未保存更改' : '本机文档工作区' : message}</span>{workspaceMode === 'formulas' && <span>{autoSavedAt ? `自动保存 ${formatSavedAt(autoSavedAt)}` : '等待自动保存'}</span>}</div><div className="status-right">{workspaceMode === 'documents' ? <><span>文档编辑</span><span>Ctrl/⌘ + S 保存</span><span>Ctrl/⌘ + O 打开</span></> : <><div className="status-editor-meta"><span>LaTeX 数学模式</span><span>UTF-8</span><span className={preview.ok ? 'parse-ok' : 'parse-error'}>{preview.ok ? '✓ 解析成功' : '! 解析错误'}</span></div><span>公式 {project.formulas.findIndex((formula) => formula.id === selected.id) + 1} / {project.formulas.length}</span><span>行 {cursor.line}, 列 {cursor.column}</span><span>本地模式</span><span>⌘/Ctrl + Enter 复制</span><span>⌘/Ctrl + K 搜索</span><div className="view-controls" aria-label="窗口布局"><button className={layoutMode === 'editor' ? 'active' : ''} onClick={() => changeLayout('editor')}>编辑</button><button className={layoutMode === 'split' ? 'active' : ''} onClick={() => changeLayout('split')}><Columns2 size={12} />分屏</button><button className={layoutMode === 'preview' ? 'active' : ''} onClick={() => changeLayout('preview')}>预览</button><button onClick={toggleFullscreen}>{isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}{isFullscreen ? '退出全屏' : '全屏'}</button></div></>}</div></footer>
    </div>
  );
}

export default App;
