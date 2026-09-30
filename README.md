# 公式工作台

离线 LaTeX → Word 公式桌面工作台，支持公式集合、预设模板、实时预览、批量导入、字体字号调整，以及复制为 Microsoft 365 可编辑公式。

## 开发

```bash
npm install
npm run dev
```

## 验证

```bash
npm test
npm run build
```

DOCX 导出由应用自行生成 OOXML：先把 MathML 转成 Word 原生 **OMML**（粘贴后可在 Word 里继续编辑），再打包成 `.docx`，**不依赖 pandoc 或任何外部程序**。

当前版本以 Microsoft 365 为 Word 目标，复制链路写入 MathML 原生格式并提供文本 / HTML / PNG 回退。字体用于本地预览、图片导出与 DOCX 的数学字体设置，Word 端若缺少对应字体可能自动替换。

常用快捷键：`Ctrl/Cmd + S` 保存、`Ctrl/Cmd + O` 打开、`Ctrl/Cmd + N` 新建、`Ctrl/Cmd + Z/Y` 撤销/重做、`Ctrl/Cmd + Enter` 复制 Word 公式。模板面板中的“新建模板”会将个人模板保存在本机浏览器存储中。

## 使用要点

### 整份文档工作区

标题栏可在「公式工作台」和「文档工作区」间切换。文档工作区与公式项目分开保存，支持完整打开、编辑、预览和保存，不会把整份文档内容混入公式项目。

- **源码编辑**：Markdown、TXT、LaTeX、HTML、RTF、CSV/TSV、RST/Org 和科研脚本可全文编辑并保存。Markdown 实时渲染标题、段落、代码块及 `$…$` / `$$…$$` 数学公式；LaTeX 预览支持常见章节标题与数学环境，完整宏包排版仍需 TeX 编译器。HTML 预览会禁用脚本和远程资源。
- **Word / ODT**：DOCX、DOCM、ODT 与旧版 DOC 可进入富文本编辑器，支持常见标题、段落、列表、表格、链接和图片，右侧同步预览；保存为新的 DOCX。旧格式先尝试本地 LibreOffice 转换。复杂页面布局、修订记录、宏、特殊域和嵌入对象可能简化；首次保存使用「另存为」，不会覆盖原件，格式提示会在编辑区上方显示。
- **PDF**：按原分页查看，支持页面导航、缩放、文字搜索和选择、拖拽高亮、文字批注；选中批注可移动或删除。「另存为」生成带批注副本，不重排或改写原 PDF 正文。扫描版可本机 OCR 并生成单独的 Markdown 可编辑副本，原 PDF 保持不变。
- **其他格式**：PPTX、XLSX、EPUB、Jupyter Notebook 和图片等保留只读预览或公式提取入口；格式面板会如实区分可编辑、批注、只读和转换能力，不会把公式提取误当成整份文档编辑。
- **保存与隐私**：文本文件保留扩展名、UTF-8/UTF-16 BOM；GB18030 等旧编码编辑后转为 UTF-8 并提示。文档默认只在本机处理；在线 OCR 仍需单独确认整份文件上传。

文档工作区快捷键：`Ctrl/Cmd + O` 打开文档，`Ctrl/Cmd + S` 保存；未保存切换文档或返回公式工作台时会询问。对格式转换或 OCR 产生的副本使用「另存为」即可保留原件。

- **文件模块**：新建项目（可命名）、打开 / 保存 `.ltw` 项目，保存与打开的项目会进入**最近项目**列表，点击即可重开。
- **查看文件**：文件模块新增「查看文件」，可一次选择多个文件预览——图片（缩放）、PDF（内嵌）、网页（沙箱 iframe）、Markdown / 文本 / 代码（等宽原文，超 2MB 截断）；Office/EPUB 文件可直接提取公式。支持多文件切换，并可一键导入公式、复制全文、用系统程序打开、显示所在文件夹。
- **批量导入与格式兼容**：支持 TXT/CSV/TSV、Markdown/MDX、Quarto/R Markdown、reStructuredText、Org、Python/R/MATLAB/Julia/Sage 脚本、LaTeX、HTML、RTF、LTW/JSON 项目、Jupyter Notebook、DOC/DOCX/DOCM、PPT/PPTX/PPTM/PPS/PPSX、XLS/XLSX/XLSM/XLSB、ODT/ODP/ODS、EPUB、PDF 和 PNG/JPG/TIFF/BMP/WebP 等图片。可多选、导入整个文件夹或将文件拖入窗口。导入根据扩展名和文件签名判断格式；编码自动识别 UTF-8、UTF-16 与 GB18030。
- **识别模式**：文件模块中可切换“自动 / 本地离线 / 联网识别”。DOCX/PPTX/ODF/EPUB 会提取正文及原生数学对象；XLSX/ODS 提取工作表文字与单元格表达式；PDF 先提取文字层。扫描版 PDF、图片及办公文档内嵌图片中的公式走 OCR。
- **本地 OCR**：第一次识别图片或扫描 PDF 时，会自动下载隔离的 Python 3.12、CPU 版 Pix2Text 依赖和所需模型，进度会显示在窗口内，文件和模型都保存在应用数据目录，不修改系统 Python。准备完成后可以断网识别；离线模式不会上传文件。OCR 环境和模型较大，需预留磁盘空间。
- **联网 OCR**：可在文件模块的“设置”中配置自己的 Mathpix `app_id / app_key`；凭据由桌面主进程通过操作系统加密后保存。联网识别前会列出文件并再次确认整份上传，支持 PDF、DOC/DOCX、PPTX、ODT、EPUB 和 PNG/JPG/TIFF/BMP/WebP；结果以 Mathpix Markdown 提取。处理完后应用会请求删除远端任务。Mathpix 服务账号及其额度需用户自行准备。
- **旧版 Office**：离线导入 `.doc / .ppt / .xls` 时需要安装 LibreOffice 供应用转换；若未安装会给出提示。联网模式下 DOC 可直接识别，PPT/XLS 仍需本地 LibreOffice 转换。PDF 和 Office 导入上限为 100 MB，图片离线 OCR 上限为 50 MB；DOCX/ZIP 部件及解压体积另有安全限制。

- **自动保存**：编辑停止 600ms 后写入本机草稿，下次启动自动恢复，状态栏显示最近一次自动保存时间；草稿保留 7 天。
- **复制格式**：开始 / 导出选项卡可切换 `Word 公式`（MathML，Word 内可编辑）、`HTML`、`LaTeX`、`PNG 图片`，`Ctrl/Cmd + Enter` 按当前格式复制；选择会记住。
- **粘贴公式（反向导入）**：开始选项卡的「粘贴公式」或 `Ctrl/⌘ + Shift + V`，把从 **Word / 网页复制的公式**（MathML，含 Word 的 `mml:` 前缀与 `mfenced` 写法）一键转回 LaTeX；剪贴板里是 LaTeX 源码时直接导入。支持分式、上下标、根式、n 元算符（∑∫∏ 带上下限）、lim 类函数、重音与上下划线、矩阵与定界符、希腊字母与常用符号。
- **图片导出**：导出选项卡可将当前公式另存为 SVG 或 PNG（白底、3 倍分辨率，KaTeX 字体已内嵌，离线可用）。
- **编辑器**：基于 CodeMirror 6 —— LaTeX 语法高亮、括号自动配对、`Ctrl/Cmd + Space` 补全符号与组合模板（如输入“分式”或 `\fr`）、KaTeX 解析错误直接以波浪线标出。
- **全局搜索**：`Ctrl/Cmd + K` 打开命令面板，跨项目公式、内置公式库、符号、组合模板搜索，`↑↓` 选择、`Enter` 插入或跳转。
- **批量操作**：公式列表中 `Ctrl/⌘ + 点击` 多选，出现批量工具条，可批量复制 LaTeX、只导出选中项为 DOCX、把当前公式的字体字号同步到选中项、批量删除；**拖拽**列表项可调整顺序。
- **宏定义**：侧栏「宏」模块可增删 LaTeX 宏（如 `\R` → `\mathbb{R}`），预览、图片导出、DOCX 与编辑器错误检查都会统一应用，宏随项目文件保存。
- **编辑 ↔ 预览同步**：编辑器与预览区**双向滚动同步**，状态栏显示光标行列；切换公式时两侧同时回到顶部，打字时预览保持滚动位置不跳动。
- **分屏布局**：视图选项卡可切换**左右 / 上下分屏**，拖拽中间分割条可调整宽度或高度，布局选择会被记住。
- **新建项目**：默认带一整页示例公式（9 个分类各 4 条，共 36 条），打开即可浏览和复用。
- **浮层操作**：命令面板、公式模板抽屉、主题色弹层都支持 `Esc` 关闭，模板抽屉与主题弹层点击外部也会关闭。预览可选 Cambria Math、STIX Two Math、Libertinus Math、Noto Sans Math、Latin Modern Math、Times New Roman、Arial 和宋体；STIX Two、Libertinus、Noto Sans Math 已随应用打包供预览使用。预览的字号即用户设定的 pt，超长公式只在预览时做视觉缩放，不影响导出结果。
