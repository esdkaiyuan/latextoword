import { scanMathSource, sourceKindForFileName, type ImportedFormula } from './batchImport';
import { decodeTextFile } from './fileDecoding';
import { detectFileFormat, isOnlineOcrSupported, type ImportMode } from './fileCompatibility';
import { extractDocumentText } from './documentImport';
import { parseProject, type ProjectFile } from './project';

export type ImportFileEntry = { name: string; type?: string; size?: number; readBytes: () => Promise<Uint8Array> };
export type ExtractedImport = { formulas: ImportedFormula[]; project?: ProjectFile; warnings: string[]; format: string };
export type OnlineRecognizer = (name: string, kind: 'document' | 'image', bytes: Uint8Array) => Promise<string>;
export type LocalRecognizer = (name: string, kind: 'pdf' | 'image', bytes: Uint8Array) => Promise<string>;
export type LegacyOfficeConverter = (name: string, bytes: Uint8Array) => Promise<{ name: string; bytes: Uint8Array }>;

export async function extractImportedFile(file: ImportFileEntry, mode: ImportMode, recognizeOnline?: OnlineRecognizer, recognizeOffline?: LocalRecognizer, convertLegacy?: LegacyOfficeConverter): Promise<ExtractedImport> {
  if ((file.size ?? 0) > 100 * 1024 * 1024) throw new Error('文件超过 100 MB 安全上限');
  let bytes = await file.readBytes();
  let name = file.name;
  let detection = detectFileFormat(name, file.type ?? '', bytes);
  if (detection.category === 'unsupported') throw new Error(detection.warning ?? '不支持的文件格式');
  if (detection.category === 'project') {
    const project = parseProject(JSON.parse(decodeTextFile(bytes).text));
    return { project, formulas: [], warnings: [], format: detection.label };
  }

  const needsLegacyConversion = ['doc', 'ppt', 'pps', 'xls', 'xlsb'].includes(detection.format) && !(mode === 'online' && isOnlineOcrSupported(file.name));
  const warnings: string[] = [];
  if (needsLegacyConversion) {
    if (!convertLegacy) throw new Error('旧版 Office 转换需要桌面版');
    const converted = await convertLegacy(file.name, bytes);
    bytes = converted.bytes;
    name = converted.name;
    detection = detectFileFormat(name, file.type ?? '', bytes);
    warnings.push('已用 LibreOffice 转换为可解析格式');
  }

  const onlineSupported = isOnlineOcrSupported(file.name);
  let text = '';
  if (mode === 'online' && onlineSupported) {
    if (!recognizeOnline) throw new Error('桌面模式下才能使用联网识别');
    text = await recognizeOnline(file.name, detection.category === 'image' ? 'image' : 'document', bytes);
  } else if (detection.category === 'text' && detection.format !== 'rtf') {
    const decoded = decodeTextFile(bytes);
    text = decoded.text;
    if (decoded.warning) warnings.push(decoded.warning);
    if (mode === 'online' && !onlineSupported) warnings.push('此格式由本机解析，未上传联网服务');
  } else if (detection.category === 'image') {
    if (!recognizeOffline) throw new Error('桌面模式下才能自动下载离线 OCR 模型');
    if (mode === 'online' && !onlineSupported) warnings.push('联网服务不接收此图片格式，已在本机 OCR，文件未上传');
    text = await recognizeOffline(file.name, 'image', bytes);
  } else {
    const parsed = await extractDocumentText(detection.format, bytes);
    text = parsed.text;
    warnings.push(...parsed.warnings);
    for (const image of parsed.embeddedImages) {
      if (!recognizeOffline) {
        warnings.push('文档含嵌入图片，需桌面本地 OCR 才能检查图片公式');
        break;
      }
      const recognized = await recognizeOffline(image.name, 'image', image.bytes);
      if (recognized.trim()) text += `\n\n${recognized}`;
    }
    if (detection.format === 'pdf' && (mode === 'offline' || parsed.ocrPages.length > 0)) {
      if (!recognizeOffline) throw new Error('桌面模式下才能自动下载离线 OCR 模型');
      text = await recognizeOffline(file.name, 'pdf', bytes);
    } else if (parsed.ocrPages.length) warnings.push(`扫描页面待 OCR：${parsed.ocrPages.join('、')}`);
    if (mode === 'online' && !onlineSupported) warnings.push('此格式由本机解析，未上传联网服务');
  }

  const kind = detection.category === 'text' ? sourceKindForFileName(file.name) : 'markdown';
  const result = scanMathSource(text, kind);
  if (result.warnings.length) warnings.push(...result.warnings.map((warning) => warning.message));
  return { formulas: result.items, warnings, format: detection.label };
}
