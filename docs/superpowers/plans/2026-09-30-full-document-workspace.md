# Full Document Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a format-aware workspace for editing and previewing whole documents, then commit and push the complete project to the configured GitHub remote without overwriting its existing history.

**Architecture:** Keep document state separate from the formula `ProjectFile`. Add format-specific adapters and narrowly scoped Electron IPC for open/save operations, then render source documents, Word documents, and PDFs with their appropriate editing model. Preserve source files and use explicit Save As for lossy conversions.

**Tech Stack:** Electron 38, React 19, TypeScript, CodeMirror, existing PDF.js, Vitest, format-specific document packages only where needed.

**Spec:** `docs/superpowers/specs/2026-09-30-full-document-workspace-design.md`

## Global Constraints

- Keep existing formula workbench behavior and formula-project persistence independent from document content.
- Do not overwrite the source file on first save after format conversion; use Save As and disclose unsupported structures.
- PDF text is not reflow-edited; PDF editing in this milestone means page-preserving annotations and OCR-to-copy.
- Keep parsing and file writes behind the Electron preload bridge; renderer code never receives arbitrary filesystem access.
- Do not push with force; integrate the existing `origin/main` README commit as an ancestor before pushing.
- Inspect all untracked files and secrets before staging the whole project; retain ignored build/dependency artifacts as ignored.

---

### Task 1: Document model and safe file IPC

**Files:**
- Create: `src/domain/document.ts`
- Create: `tests/document.test.ts`
- Create: `src/main/trustedNavigation.cjs`
- Create: `tests/trustedNavigation.test.ts`
- Modify: `src/main/main.cjs`
- Modify: `src/main/preload.cjs`
- Modify: `src/renderer/global.d.ts`

**Interfaces:**
- Produces discriminated document kinds for `source`, `rich-text`, `pdf`, and `readonly` documents; includes path, format, dirty state, and format warnings.
- Produces `window.desktop.documents.open()`, `save(path, bytes)`, `saveAs(defaultName, mode, bytes)`, `convertToDocx`, and `exportDocx` behind validated IPC.

- [x] Add failing Vitest cases for format capabilities and save-target compatibility in `tests/document.test.ts`.
- [x] Run `npm test -- tests/document.test.ts` and confirm the missing-model failure.
- [x] Implement the typed document capability model separately from formula project types.
- [x] Add main/preload IPC for native open/save dialogs, bounded atomic byte writes, conversion and DOCX export; restrict IPC to the trusted app renderer URL.
- [x] Run focused tests and `npm run typecheck`; confirm both pass.

### Task 2: Source-document editing and live preview

**Files:**
- Create: `src/renderer/DocumentWorkspace.tsx`
- Create: `src/renderer/SourceDocumentEditor.tsx`
- Create: `src/renderer/DocumentPreview.tsx`
- Create: `src/domain/sourceDocument.ts`
- Create: `tests/sourceDocument.test.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`
- Modify: `package.json` and `package-lock.json` only if a safe Markdown renderer is required.

**Interfaces:**
- `openSourceDocument(name, bytes)` returns `{ text, format, encoding, warnings }`; `serializeSourceDocument` preserves untouched bytes and re-encodes supported edits.
- The source editor changes the complete document string; preview rendering is derived from the current string and never rewrites source.

- [x] Add failing codec tests for UTF-8/UTF-16, unchanged bytes, and legacy-encoding warnings in `tests/sourceDocument.test.ts`.
- [x] Run the focused tests and verify failures are about missing source-document behavior.
- [x] Implement `openSourceDocument` / `serializeSourceDocument` with encoding warnings and unchanged-source preservation.
- [x] Add CodeMirror source editing and safe Markdown/LaTeX/HTML/RTF preview with KaTeX math.
- [x] Add open, dirty indicator, save, Save As, undo/redo shortcuts, and unsaved-change confirmation on document switches and app close without changing formula workspace state.
- [x] Run source-document tests, regression suite, typecheck, and production build.

### Task 3: Word/ODT conversion editor

**Files:**
- Create: `src/domain/richDocument.ts`
- Create: `tests/richDocument.test.ts`
- Create: `src/renderer/RichDocumentEditor.tsx`
- Modify: `src/main/legacyOffice.cjs`
- Modify: `src/main/main.cjs`
- Modify: `src/main/preload.cjs`
- Modify: `src/renderer/DocumentWorkspace.tsx`
- Modify: `package.json` and `package-lock.json` for the selected import/export libraries.

**Interfaces:**
- `importRichDocument(bytes)` returns safe editable HTML plus converter warnings; main-process `document:export-docx` creates DOCX bytes for Save As.
- DOC/ODT conversion uses the existing local LibreOffice worker where available.

- [x] Add DOCX import/export fixtures for paragraphs, headings and tables, and verify unsafe HTML is removed and unsupported math is warned.
- [x] Run the focused tests and confirm the absent rich-document adapter is the failure.
- [x] Use Mammoth, Tiptap, and html-to-docx for the approved common-content scope; keep import warnings visible.
- [x] Implement safe import into a rich editor and DOCX Save As; never overwrite the source DOCX/ODT after conversion.
- [x] Implement legacy DOC/ODT conversion fallback through the main-process LibreOffice wrapper with actionable failure messages.
- [x] Verify in-memory DOCX round-trip fixtures, typecheck, and production build. LibreOffice is not installed in this environment, so the external ODT conversion path is not runtime-verified here.

### Task 4: PDF preview, annotations, and OCR copy

**Files:**
- Create: `src/renderer/PdfDocumentEditor.tsx`
- Create: `src/domain/pdfAnnotations.ts`
- Create: `tests/pdfAnnotations.test.ts`
- Modify: `src/renderer/DocumentWorkspace.tsx`
- Modify: `src/main/preload.cjs` only if native Save As is not reusable.
- Modify: `package.json` and `package-lock.json` only for a PDF annotation writer.

**Interfaces:**
- `PdfAnnotation` stores page index, normalized page coordinates, annotation kind (`highlight` or `note`), text, and color.
- `applyPdfAnnotations(bytes, annotations)` returns a new PDF byte array and never mutates the original source bytes.

- [x] Add tests proving normalized coordinates, clamping, movement, rotated-viewport mapping, annotation serialization, and unchanged output when no marks exist.
- [x] Run focused tests and verify failures are due to missing geometry/annotation behavior.
- [x] Add PDF.js page rendering, page navigation, zoom, text search/selection, and in-session move/delete/highlight/note controls.
- [x] Export annotations to a PDF copy; preserve the source and retain editor state after save failure.
- [x] Add local OCR action that creates a separate editable Markdown copy without modifying the PDF source.
- [x] Verify annotation geometry and PDF output, typecheck, and production build.

### Task 5: Workspace integration, format capability display, and regression checks

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/DocumentWorkspace.tsx`
- Modify: `src/renderer/styles.css`
- Modify: `src/domain/fileCompatibility.ts`
- Modify: `src/renderer/FileViewer.tsx`
- Modify: `tests/app.smoke.test.tsx`; focused codec and annotation tests live under `tests/`.

- [x] Add integration coverage for workspace switching, document capability modes, unsaved-state/close prompts, and safe file parsing.
- [x] Run targeted tests, the full `npm test` suite (104 passing), typecheck, and production build; resolve pre-existing stale expectations and drag-event robustness.
- [x] Review responsive editor/preview and independent-scroll CSS plus PDF page navigation; live LibreOffice conversion remains environment-dependent.
- [x] Update README with supported formats, fidelity limits, and local/online OCR behavior.

### Task 6: Integrate existing remote history and publish the complete project

**Files:**
- Review all workspace files; stage only project source, tests, docs, configuration, lockfile, and intentional assets.

- [x] Inspect project status, ignore rules, local memory folder, OCR assets, and candidate filenames; local memory/build/dependency/temp folders are excluded.
- [x] Ensure local `main` is based on `origin/main`; preserve both README history and local project content without force-pushing.
- [x] Review the staged diff and ensure build outputs, dependencies, temporary directories, secrets, and test artifacts are excluded.
- [ ] Create one complete-project commit with a descriptive message.
- [ ] Push `main` to `origin` without force; verify the remote commit hash and clean committed working tree.
