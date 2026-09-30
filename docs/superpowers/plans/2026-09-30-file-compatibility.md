# 文件兼容性与公式识别 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展桌面公式工作台的文件导入范围，支持本地/联网可切换的结构化解析与公式 OCR。

**Architecture:** 统一导入管线先检测文件格式并读取字节，再将内容分发给文本、容器、PDF 或图像适配器。离线模式运行本地 Pix2Text；联网模式在主进程中调用 Mathpix、上传前明确确认并使用加密存储的凭据；所有结果回到现有公式扫描与预览导入流程。

**Tech Stack:** Electron 38、React 19、TypeScript、Vite、fflate (ZIP 容器)、PDF.js、Pix2Text/Python worker、Mathpix REST API、Electron safeStorage。

**Spec:** `docs/superpowers/specs/2026-09-30-file-compatibility-design.md`

## Global Constraints

- 支持矩阵与离线/联网规则必须遵循设计文档，不可静默上传或静默跳过公式。
- 文件名、MIME 和内容签名共同决定格式路由；无法验证的输入按不支持格式处理。
- 外部服务密钥只保存在 Electron 主进程加密存储中。
- 本地模式的 OCR 请求不得使用网络；模型/运行时自动下载只发生在首次本地 OCR 初始化阶段。
- 检查以 `npm run typecheck`、`npm run build` 和主进程语法检查为准；不运行测试套件。

---

### Task 1: 统一格式目录、字节读取与编码识别

**Files:**
- Create: `src/domain/fileCompatibility.ts`
- Create: `src/domain/fileDecoding.ts`
- Modify: `src/domain/batchImport.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/FileViewer.tsx`
- Modify: `src/renderer/global.d.ts`

**Interfaces:**
- `detectFileFormat(name: string, mime: string, bytes: Uint8Array): FileFormatDetection`
- `decodeTextFile(bytes: Uint8Array): { text: string; encoding: string; warning?: string }`
- Import ingress accepts browser `File` and native `ViewerFile` bytes without converting binary containers through `File.text()`.

- [x] 为各格式定义格式 ID、扩展名和文件签名路由。
- [x] 检查常见 PDF/ZIP/RTF/栅格图像签名；扩展名与内容不符时跳过并报错。
- [x] 按 BOM 检测 UTF-8/UTF-16；UTF-8 无 BOM 非法时尝试 GB18030，再不行报告替代字符。
- [x] 将导入改为字节读取，保留现有 TXT/MD/TEX/HTML/LTW/JSON 路由。
- [x] 更新文件选择器、文件查看器、文件夹导入和拖放支持范围。
- [x] 类型检查与生产构建通过。

### Task 2: 本地文档容器与 PDF 文本适配器

**Files:**
- Create: `src/domain/documentImport.ts`
- Create: `src/domain/officeXml.ts`
- Create: `src/domain/pdfImport.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/domain/mathmlToLatex.ts`
- Modify: `src/domain/batchImport.ts`

**Interfaces:**
- `extractDocumentContent(format: DocumentFormat, bytes: Uint8Array): Promise<DocumentImportContent>`
- `DocumentImportContent = { text: string; formulas: ImportedFormula[]; warnings: ImportWarning[] }`
- `pdfTextPages(bytes: Uint8Array): Promise<Array<{ page: number; text: string }>>`

- [x] 使用 `fflate` 流式读取 Office/ODF/EPUB 压缩部件，并限制压缩/解压大小、条目数、路径与 XML 长度。
- [x] DOCX/PPTX 提取段落文本和 OMML；把常见分式、根式、上下标、矩阵与大算符映射到 LaTeX。
- [x] XLSX/ODS 提取工作表文字和单元格表达式；不把电子表格表达式伪装成 LaTeX。
- [x] ODT/ODP 提取文本和 MathML；EPUB 按 spine 顺序扫描 XHTML。
- [x] RTF 解码转义字符、段落和 Unicode 控制字。
- [x] PDF.js 提取文字层并添加页码标记；扫描页转本地 OCR。
- [x] 检测 LibreOffice 并将 DOC/PPT/XLS 转换到 Office XML 格式；不改变源文件。
- [x] 类型检查和生产构建通过；electron-builder 已添加运行时依赖。

### Task 3: Mathpix 联网 OCR、设置与隐私确认

**Files:**
- Create: `src/main/mathpix.cjs`
- Create: `src/renderer/ImportSettings.tsx`
- Modify: `src/main/main.cjs`
- Modify: `src/main/preload.cjs`
- Modify: `src/renderer/global.d.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- `desktop.ocr.configureMathpix({ appId: string; appKey: string })`
- `desktop.ocr.mathpixStatus(): Promise<{ configured: boolean }>`
- `desktop.ocr.recognizeOnline({ name: string; bytes: Uint8Array }): Promise<OcrDocumentResult>`
- Main process stores encrypted credentials via Electron `safeStorage` and owns all authenticated HTTP requests.

- [x] 设置面板输入、更新、删除 Mathpix 凭据；renderer 只获知是否已配置。
- [x] 由主进程通过 Electron `safeStorage` 加密保存凭据，所有 OCR IPC 检查 sender。
- [x] 实现 Mathpix `/v3/text` 与 `/v3/pdf`、状态轮询、MMD 下载和远端任务清理。
- [x] 上传整份文件前列出文件并向用户确认；取消确认时不发送文件内容。
- [x] 请求设置超时，错误不返回认证头或密钥。
- [x] MMD 回到统一公式扫描器，页码分隔保留在来源文本。
- [x] 主进程语法检查、类型检查和生产构建通过。

### Task 4: 本地 Pix2Text worker、运行时和自动下载

**Files:**
- Create: `ocr-worker/worker.py`
- Create: `ocr-worker/requirements.txt`
- Create: `ocr-worker/manifest.json`
- Create: `src/main/localOcr.cjs`
- Create: `src/main/downloadManager.cjs`
- Modify: `src/main/main.cjs`
- Modify: `src/main/preload.cjs`
- Modify: `src/renderer/global.d.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- `desktop.ocr.localStatus(): Promise<LocalOcrStatus>`
- `desktop.ocr.ensureLocalReady(): Promise<void>`; progress event emits `{ phase, downloadedBytes, totalBytes, percent }`.
- `desktop.ocr.recognizeLocal({ name: string; bytes: Uint8Array }): Promise<OcrDocumentResult>`
- Worker uses JSON Lines stdin/stdout; diagnostics go to stderr and never mix with protocol responses.

- [x] 固定 Pix2Text 版本，自动下载并使用隔离 Python 3.12 环境及 CPU Torch，不修改系统 Python。
- [x] 运行时、依赖和模型缓存放在应用 userData；uv 可执行文件经 GitHub 发布元数据 SHA-256 校验。
- [x] 首次本地 OCR 自动准备环境与模型并显示阶段进度；失败后重试可重用缓存。
- [x] 使用固定 worker 可执行路径和 JSON Lines 协议，不经 shell 执行用户路径。
- [x] Pix2Text 识别图片/PDF，并识别 Office 压缩包内图片；PDF 页码分隔留在 Markdown 输出。
- [x] 模型成功下载后启用 Hugging Face 离线模式。
- [x] 类型检查、worker 语法检查、生产构建通过；worker 已配置为安装包 extra resource。

### Task 5: 统一导入流程、结果复核与兼容性 UI

**Files:**
- Create: `src/renderer/ImportReview.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/FileViewer.tsx`
- Modify: `src/renderer/styles.css`
- Modify: `src/domain/fileView.ts`

**Interfaces:**
- `ImportReview` accepts normalized formulas, per-file reports and project macros; only selected formulas are merged.

- [x] 多选、文件夹、拖放和查看器入口进入同一导入协调器。
- [x] 提供自动/离线/联网切换；格式不适配当前模式时回退本机解析并显示提示。
- [x] 联网前列出文件名/大小并逐批确认。
- [x] 显示运行时/模型与 Mathpix OCR 阶段进度。
- [x] 识别候选结果进入复核窗口，可预览、勾选和移除再导入。
- [x] 单文件失败会跳过，不阻断其他文件。
- [x] 类型检查和生产构建通过。

### Task 6: 分发配置与操作说明

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-30-file-compatibility-design.md`
- Modify: `docs/superpowers/plans/2026-09-30-file-compatibility.md`

- [x] electron-builder 配置 OCR worker extra resource，不将大模型预置进安装包。
- [x] README 列出兼容格式、LibreOffice 条件、上传提示和凭据设置。
- [x] 文档明确 Mathpix 凭据和服务额度由用户提供。
- [x] TypeScript、主进程/worker 语法检查和生产构建通过；未运行测试套件或实际下载运行时与模型。
