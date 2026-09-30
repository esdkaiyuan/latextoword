import { mathmlToLatex } from './mathmlToLatex';
import { ommlToLatex } from './ommlToLatex';

export type OfficeXmlFormat = 'docx' | 'docm' | 'pptx' | 'pptm' | 'ppsx' | 'xlsx' | 'xlsm' | 'odt' | 'odp' | 'ods' | 'epub';
export type OfficeParts = Map<string, string>;

function local(element: Element): string {
  return element.localName || element.tagName.split(':').at(-1) || '';
}

function elements(node: ParentNode): Element[] {
  return Array.from(node.children);
}

function findDescendants(node: ParentNode, name: string): Element[] {
  return elements(node).flatMap((element) => [ ...(local(element) === name ? [element] : []), ...findDescendants(element, name) ]);
}

function xmlDocument(source: string, label: string): XMLDocument {
  const document = new DOMParser().parseFromString(source, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error(`${label} XML 格式无效`);
  return document;
}

function serialize(element: Element): string {
  return new XMLSerializer().serializeToString(element);
}

function textFrom(element: Element): string {
  return Array.from(element.childNodes).map((node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const child = node as Element;
    const name = local(child);
    if (name === 'oMathPara') {
      const formulas = findDescendants(child, 'oMath');
      return formulas.map((formula) => `\n$$${ommlToLatex(serialize(formula))}$$\n`).join('');
    }
    if (name === 'oMath') return ` \(${ommlToLatex(serialize(child))}\) `;
    if (name === 'math') return ` \(${mathmlToLatex(serialize(child))}\) `;
    if (name === 't') return child.textContent ?? '';
    if (['p', 'h', 'page', 'tr', 'row', 'slide'].includes(name)) return `${elements(child).map((item) => textFrom(item)).join('')}\n`;
    if (['rPr', 'pPr', 'sdtPr', 'sectPr', 'tblPr', 'tcPr'].includes(name)) return '';
    return textFrom(child);
  }).join('');
}

function parseXlsx(parts: OfficeParts): string {
  const sharedSource = parts.get('xl/sharedStrings.xml');
  const shared = sharedSource ? findDescendants(xmlDocument(sharedSource, 'Excel 共享字符串'), 'si').map((item) => findDescendants(item, 't').map((text) => text.textContent ?? '').join('')) : [];
  const sheets = Array.from(parts.entries())
    .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort(([a], [b]) => Number(a.match(/sheet(\d+)/i)?.[1]) - Number(b.match(/sheet(\d+)/i)?.[1]));
  return sheets.map(([name, source], sheetIndex) => {
    const document = xmlDocument(source, name);
    const rows = findDescendants(document, 'row').map((row) => findDescendants(row, 'c').map((cell) => {
      const type = cell.getAttribute('t');
      const value = findDescendants(cell, 'v')[0]?.textContent ?? '';
      const formula = findDescendants(cell, 'f')[0]?.textContent;
      const cellText = type === 's' ? shared[Number(value)] ?? '' : findDescendants(cell, 't').map((item) => item.textContent ?? '').join('') || value;
      return formula ? `${cellText} (${formula})` : cellText;
    }).filter(Boolean).join('\t'));
    return `工作表 ${sheetIndex + 1} (${name})\n${rows.join('\n')}`;
  }).join('\n\n');
}

function parseOds(parts: OfficeParts): string {
  const source = parts.get('content.xml');
  if (!source) throw new Error('ODS 缺少 content.xml');
  const document = xmlDocument(source, 'ODS');
  return findDescendants(document, 'table').map((table, index) => {
    const name = table.getAttribute('table:name') || `工作表 ${index + 1}`;
    return `${name}\n${textFrom(table)}`;
  }).join('\n\n');
}

function parseEpub(parts: OfficeParts): string {
  const container = parts.get('META-INF/container.xml');
  const rawRootFile = container ? findDescendants(xmlDocument(container, 'EPUB 容器'), 'rootfile')[0]?.getAttribute('full-path') : undefined;
  const rootFile = rawRootFile ? decodeURIComponentSafe(rawRootFile) : undefined;
  const opf = rootFile ? parts.get(rootFile) : undefined;
  if (!opf) throw new Error('EPUB 缺少有效的 OPF 目录');
  const doc = xmlDocument(opf, 'EPUB 目录');
  const manifest = new Map(findDescendants(doc, 'item').map((item) => [item.getAttribute('id') ?? '', item.getAttribute('href') ?? '']));
  const base = rootFile!.includes('/') ? rootFile!.slice(0, rootFile!.lastIndexOf('/') + 1) : '';
  const chapters = findDescendants(doc, 'itemref').map((item) => manifest.get(item.getAttribute('idref') ?? '')).filter((item): item is string => Boolean(item));
  return chapters.map((chapter) => {
    const resource = chapter.split(/[?#]/, 1)[0];
    const path = normalizeArchivePath(`${base}${decodeURIComponentSafe(resource)}`);
    const source = parts.get(path);
    return source ? textFrom(xmlDocument(source, `EPUB 章节 ${chapter}`).documentElement) : '';
  }).join('\n\n');
}

function decodeURIComponentSafe(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

function normalizeArchivePath(value: string): string {
  const segments: string[] = [];
  for (const segment of value.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop(); else segments.push(segment);
  }
  return segments.join('/');
}

export function extractOfficeText(format: OfficeXmlFormat, parts: OfficeParts): string {
  if (format === 'xlsx' || format === 'xlsm') return parseXlsx(parts);
  if (format === 'ods') return parseOds(parts);
  if (format === 'epub') return parseEpub(parts);
  const selected = Array.from(parts.entries()).filter(([name]) => {
    if (format === 'docx' || format === 'docm') return /^word\/(document|footnotes|endnotes)\.xml$/i.test(name);
    if (format === 'pptx' || format === 'pptm' || format === 'ppsx') return /^ppt\/slides\/slide\d+\.xml$/i.test(name);
    return name === 'content.xml';
  }).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  if (!selected.length) throw new Error(`${format.toUpperCase()} 中没有可解析的正文 XML`);
  return selected.map(([name, source]) => textFrom(xmlDocument(source, name).documentElement)).join('\n\n');
}
