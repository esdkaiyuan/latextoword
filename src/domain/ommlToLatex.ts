function children(node: Element): Element[] {
  return Array.from(node.children);
}

function local(node: Element): string {
  return node.localName || node.tagName.split(':').at(-1) || '';
}

function child(node: Element, name: string): Element | undefined {
  return children(node).find((item) => local(item) === name);
}

function descendants(node: Element, name: string): Element[] {
  return [ ...(local(node) === name ? [node] : []), ...Array.from(node.children).flatMap((item) => descendants(item, name)) ];
}

function value(node: Element | undefined, name: string): string {
  if (!node) return '';
  return child(node, name)?.getAttribute('m:val') ?? child(node, name)?.getAttribute('val') ?? '';
}

function content(node: Element, name: string): string {
  const target = child(node, name);
  return target ? convert(target) : '';
}

function escapeLatexText(text: string): string {
  return text.replace(/([#$%&_{}])/g, '\\$1');
}

function convert(node: Element): string {
  const parts = children(node);
  switch (local(node)) {
    case 'oMath':
    case 'oMathPara':
    case 'e':
    case 'num':
    case 'den':
    case 'sub':
    case 'sup':
    case 'lim':
    case 'mr':
    case 'mtr':
    case 'mtd':
      return parts.map(convert).join('');
    case 't':
      return escapeLatexText(node.textContent ?? '');
    case 'r':
      return descendants(node, 't').map((item) => escapeLatexText(item.textContent ?? '')).join('');
    case 'f':
      return `\\frac{${content(node, 'num')}}{${content(node, 'den')}}`;
    case 'sSup':
      return `${content(node, 'e')}^{${content(node, 'sup')}}`;
    case 'sSub':
      return `${content(node, 'e')}_{${content(node, 'sub')}}`;
    case 'sSubSup':
      return `${content(node, 'e')}_{${content(node, 'sub')}}^{${content(node, 'sup')}}`;
    case 'rad': {
      const expression = content(node, 'e');
      const degree = content(node, 'deg');
      return degree ? `\\sqrt[${degree}]{${expression}}` : `\\sqrt{${expression}}`;
    }
    case 'nary': {
      const props = child(node, 'naryPr');
      const symbol = value(props, 'chr') || '∑';
      const lower = content(node, 'sub');
      const upper = content(node, 'sup');
      const operand = content(node, 'e');
      return `\\${({ '∑': 'sum', '∏': 'prod', '∫': 'int', '∬': 'iint', '∭': 'iiint', '∮': 'oint' } as Record<string, string>)[symbol] ?? 'sum'}${lower ? `_{${lower}}` : ''}${upper ? `^{${upper}}` : ''}${operand ? ` ${operand}` : ''}`;
    }
    case 'd': {
      const props = child(node, 'dPr');
      const open = value(props, 'begChr') || '(';
      const close = value(props, 'endChr') || ')';
      return `\\left${open}${content(node, 'e')}\\right${close}`;
    }
    case 'limUpp':
      return `${content(node, 'e')}^{${content(node, 'lim')}}`;
    case 'limLow':
      return `${content(node, 'e')}_{${content(node, 'lim')}}`;
    case 'bar':
      return `\\overline{${content(node, 'e')}}`;
    case 'acc':
      return `\\hat{${content(node, 'e')}}`;
    case 'm': {
      const rows = parts.map((row) => children(row).map(convert).join(' & '));
      return `\\begin{matrix}${rows.join(' \\\\ ')}\\end{matrix}`;
    }
    default:
      return parts.map(convert).join('');
  }
}

export function ommlToLatex(markup: string): string {
  const document = new DOMParser().parseFromString(markup, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('Word 公式 XML 无法解析');
  const math = Array.from(document.getElementsByTagName('*')).find((item) => local(item) === 'oMath' || local(item) === 'oMathPara');
  if (!math) return '';
  return convert(math).trim();
}
