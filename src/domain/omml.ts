import { escapeXml, findNode, nodeText, parseXml, type XmlNode } from './mathml';

export { escapeXml };

const NARY_CHARS = new Set(['∑', '∏', '∐', '⋂', '⋃', '⋀', '⋁', '⨀', '⨁', '⨂', '⨄', '∫', '∬', '∭', '⨌', '∮', '∯', '∰']);
const ACCENT_CHARS = new Set(['^', '~', 'ˆ', '˜', '˙', '¨', '˙', '→', '⇀', '⃗', '⃀']);
const OVER_BARS = new Set(['‾', '¯', 'ˉ', '̄', '⏞', '⌢', '￣']);
const UNDER_BARS = new Set(['_', 'ˍ', '̱', '⏟', '⌣']);

function elements(node: XmlNode): XmlNode[] {
  return node.children.filter((child) => child.name !== '#text');
}

function childAt(node: XmlNode, index: number): XmlNode | undefined {
  return elements(node)[index];
}

function run(text: string, font: string, fontSizePt: number, italic = false): string {
  if (!text) return '';
  const italicStyle = italic ? '<w:i/>' : '';
  const size = Number.isFinite(fontSizePt) ? Math.round(Math.max(1, Math.min(400, fontSizePt)) * 2) : 28;
  const fonts = `<w:rFonts w:ascii="${escapeXml(font)}" w:hAnsi="${escapeXml(font)}"/>`;
  return `<m:r><m:rPr><m:ctrlPr><w:rPr>${fonts}<w:sz w:val="${size}"/>${italicStyle}</w:rPr></m:ctrlPr></m:rPr><m:t xml:space="preserve">${escapeXml(text)}</m:t></m:r>`;
}

function nary(character: string, sub: string, sup: string, operand: string): string {
  return `<m:nary><m:naryPr><m:chr m:val="${escapeXml(character)}"/><m:limLoc m:val="undOvr"/></m:naryPr><m:sub>${sub}</m:sub><m:sup>${sup}</m:sup><m:e>${operand}</m:e></m:nary>`;
}

function bar(position: 'top' | 'bot', content: string): string {
  return `<m:bar><m:barPr><m:pos m:val="${position}"/></m:barPr><m:e>${content}</m:e></m:bar>`;
}

function accent(character: string, content: string): string {
  return `<m:acc><m:accPr><m:chr m:val="${escapeXml(character)}"/></m:accPr><m:e>${content}</m:e></m:acc>`;
}

function convertScripts(node: XmlNode): [XmlNode | undefined, XmlNode | undefined, XmlNode | undefined] {
  return [childAt(node, 0), childAt(node, 1), childAt(node, 2)];
}

function convert(node: XmlNode, font: string, fontSizePt: number): string {
  const content = (target: XmlNode | undefined) => (target ? convert(target, font, fontSizePt) : '');

  switch (node.name) {
    case '#text':
      return '';
    case 'semantics': {
      const body = childAt(node, 0);
      return body ? content(body) : '';
    }
    case 'annotation':
      return '';
    case 'mi': {
      const text = nodeText(node);
      const normal = node.attributes.mathvariant === 'normal';
      return run(text, font, fontSizePt, !normal && /^[a-zA-Z]$/.test(text));
    }
    case 'mn':
    case 'mo':
    case 'mtext':
      return run(nodeText(node), font, fontSizePt);
    case 'mspace':
      return '';
    case 'msup': {
      const [base, sup] = convertScripts(node);
      return `<m:sSup><m:e>${content(base)}</m:e><m:sup>${content(sup)}</m:sup></m:sSup>`;
    }
    case 'msub': {
      const [base, sub] = convertScripts(node);
      return `<m:sSub><m:e>${content(base)}</m:e><m:sub>${content(sub)}</m:sub></m:sSub>`;
    }
    case 'msubsup': {
      const [base, sub, sup] = convertScripts(node);
      return `<m:sSubSup><m:e>${content(base)}</m:e><m:sub>${content(sub)}</m:sub><m:sup>${content(sup)}</m:sup></m:sSubSup>`;
    }
    case 'mfrac': {
      const [numerator, denominator] = convertScripts(node);
      const type = node.attributes.linethickness === '0' ? 'noBar' : node.attributes.bevelled === 'true' ? 'skw' : 'bar';
      return `<m:f><m:fPr><m:type m:val="${type}"/></m:fPr><m:num>${content(numerator)}</m:num><m:den>${content(denominator)}</m:den></m:f>`;
    }
    case 'msqrt': {
      const body = childAt(node, 0);
      return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${content(body)}</m:e></m:rad>`;
    }
    case 'mroot': {
      const [body, degree] = convertScripts(node);
      return `<m:rad><m:radPr><m:degHide m:val="0"/></m:radPr><m:deg>${content(degree)}</m:deg><m:e>${content(body)}</m:e></m:rad>`;
    }
    case 'mover':
    case 'munder':
    case 'munderover': {
      const [base, first, second] = convertScripts(node);
      const baseText = base ? nodeText(base).trim() : '';
      if (NARY_CHARS.has(baseText)) {
        if (node.name === 'mover') return nary(baseText, '', content(first), '');
        if (node.name === 'munder') return nary(baseText, content(first), '', '');
        return nary(baseText, content(first), content(second), '');
      }
      const marker = node.name === 'munder' ? nodeText(first ?? { name: '', attributes: {}, children: [], text: '' }).trim() : nodeText(second ?? first ?? { name: '', attributes: {}, children: [], text: '' }).trim();
      const body = content(base);
      if (node.name === 'mover' || node.name === 'munderover') {
        if (OVER_BARS.has(marker)) return bar('top', node.name === 'munderover' ? bar('bot', body) : body);
        if (ACCENT_CHARS.has(marker)) return accent(marker, body);
      }
      if (node.name === 'munder' && UNDER_BARS.has(marker)) return bar('bot', body);
      const upper = node.name === 'munder' ? '' : content(node.name === 'mover' ? first : second);
      const lower = node.name === 'mover' ? '' : content(first);
      const wrapped = upper ? `<m:limUpp><m:e>${body}</m:e><m:lim>${upper}</m:lim></m:limUpp>` : body;
      return lower ? `<m:limLow><m:e>${wrapped}</m:e><m:lim>${lower}</m:lim></m:limLow>` : wrapped;
    }
    case 'mtable': {
      const rows = elements(node).filter((row) => row.name === 'mtr');
      const body = rows
        .map((row) => `<m:mr>${elements(row).filter((cell) => cell.name === 'mtd').map((cell) => `<m:e>${convert(cell, font, fontSizePt)}</m:e>`).join('')}</m:mr>`)
        .join('');
      return `<m:m>${body}</m:m>`;
    }
    case 'mrow': {
      const items = elements(node);
      const tableIndex = items.findIndex((item) => item.name === 'mtable');
      const opening = items[0];
      const closing = items[items.length - 1];
      // KaTeX 把矩阵的左右括号拆成两个 fence 的 <mo>，这里还原成 OMML 的定界符
      if (tableIndex > 0 && tableIndex === items.length - 2 && opening?.attributes.fence === 'true' && closing?.attributes.fence === 'true') {
        const inner = items.slice(1, -1).map((item) => convert(item, font, fontSizePt)).join('');
        return `<m:d><m:dPr><m:begChr m:val="${escapeXml(nodeText(opening))}"/><m:endChr m:val="${escapeXml(nodeText(closing))}"/></m:dPr><m:e>${inner}</m:e></m:d>`;
      }
      return node.children.map((item) => convert(item, font, fontSizePt)).join('');
    }
    case 'mtr':
    case 'mtd':
      return node.children.map((item) => convert(item, font, fontSizePt)).join('');
    default: {
      if (node.children.length) return node.children.map((item) => convert(item, font, fontSizePt)).join('');
      return run(nodeText(node), font, fontSizePt);
    }
  }
}

/** 把 KaTeX 输出的 MathML 转成 Word 原生 OMML，未识别的元素降级为其子节点，保证不丢内容。 */
export function mathmlToOmml(mathml: string, font = 'Cambria Math', fontSizePt = 14): string {
  const root = parseXml(mathml);
  const math = findNode(root, 'math') ?? root;
  const body = math.name === 'math'
    ? math.children.map((item) => convert(item, font, fontSizePt)).join('')
    : convert(math, font, fontSizePt);
  return `<m:oMath>${body}</m:oMath>`;
}
