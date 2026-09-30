import { findNode, nodeText, parseXml, type XmlNode } from './mathml';

const GREEK: Record<string, string> = {
  α: '\\alpha ', β: '\\beta ', γ: '\\gamma ', δ: '\\delta ', ε: '\\epsilon ', ζ: '\\zeta ', η: '\\eta ',
  θ: '\\theta ', ι: '\\iota ', κ: '\\kappa ', λ: '\\lambda ', μ: '\\mu ', ν: '\\nu ', ξ: '\\xi ',
  π: '\\pi ', ρ: '\\rho ', σ: '\\sigma ', τ: '\\tau ', υ: '\\upsilon ', φ: '\\phi ', χ: '\\chi ',
  ψ: '\\psi ', ω: '\\omega ', ϑ: '\\vartheta ', ϕ: '\\varphi ', ϖ: '\\varpi ', ϱ: '\\varrho ', ς: '\\varsigma ',
  Γ: '\\Gamma ', Δ: '\\Delta ', Θ: '\\Theta ', Λ: '\\Lambda ', Ξ: '\\Xi ',
  Π: '\\Pi ', Σ: '\\Sigma ', Υ: '\\Upsilon ', Φ: '\\Phi ', Ψ: '\\Psi ', Ω: '\\Omega '
};

const OPERATORS: Record<string, string> = {
  '−': '-', '–': '-', '*': '*', '∗': '\\ast ', '⋅': '\\cdot ', '·': '\\cdot ', '×': '\\times ', '÷': '\\div ',
  '±': '\\pm ', '∓': '\\mp ', '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ', '≈': '\\approx ', '≡': '\\equiv ',
  '→': '\\to ', '←': '\\gets ', '⇒': '\\Rightarrow ', '⇐': '\\Leftarrow ', '↔': '\\leftrightarrow ',
  '⇔': '\\Leftrightarrow ', '⟶': '\\longrightarrow ', '↦': '\\mapsto ', '∈': '\\in ', '∉': '\\notin ',
  '∋': '\\ni ', '⊂': '\\subset ', '⊆': '\\subseteq ', '⊃': '\\supset ', '⊇': '\\supseteq ',
  '∪': '\\cup ', '∩': '\\cap ', '∅': '\\emptyset ', '∞': '\\infty ', '∂': '\\partial ', '∇': '\\nabla ',
  '…': '\\dots ', '⋯': '\\cdots ', '⋮': '\\vdots ', '⋱': '\\ddots ', '′': "'", '″': "''", '‴': "'''",
  '°': '^{\\circ}', '∝': '\\propto ', '⊥': '\\perp ', '∥': '\\|', '¬': '\\neg ', '∧': '\\wedge ', '∨': '\\vee ',
  '∀': '\\forall ', '∃': '\\exists ', '∄': '\\nexists ', '∴': '\\therefore ', '∵': '\\because ',
  'ℝ': '\\mathbb{R}', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}', 'ℚ': '\\mathbb{Q}', 'ℂ': '\\mathbb{C}',
  '∑': '\\sum', '∏': '\\prod', '∐': '\\coprod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint',
  '∮': '\\oint', '∯': '\\oiint', '∰': '\\oiiint', '⋂': '\\bigcap', '⋃': '\\bigcup',
  '⋀': '\\bigwedge', '⋁': '\\bigvee', '⨀': '\\bigodot', '⨁': '\\bigoplus', '⨂': '\\bigotimes', '⨄': '\\biguplus',
  'lim': '\\lim', 'max': '\\max', 'min': '\\min', 'sup': '\\sup', 'inf': '\\inf',
  'limsup': '\\limsup', 'liminf': '\\liminf', 'sin': '\\sin', 'cos': '\\cos', 'tan': '\\tan',
  'log': '\\log', 'ln': '\\ln', 'exp': '\\exp', 'det': '\\det', 'deg': '\\deg', 'gcd': '\\gcd',
  'mod': '\\bmod', 'sinh': '\\sinh', 'cosh': '\\cosh', 'tanh': '\\tanh', 'arcsin': '\\arcsin', 'arctan': '\\arctan'
};

const FENCES: Record<string, string> = {
  '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}', '|': '|', '‖': '\\|',
  '⟨': '\\langle ', '⟩': '\\rangle ', '⌊': '\\lfloor ', '⌋': '\\rfloor ', '⌈': '\\lceil ', '⌉': '\\rceil ',
  '⟪': '\\langle\\!\\langle ', '⟫': '\\rangle\\!\\rangle '
};

const NARY = new Set(Object.values(OPERATORS).filter((latex) => /^(\\sum|\\prod|\\coprod|\\int|\\iint|\\iiint|\\oint|\\oiint|\\oiiint|\\big[a-z]+)$/.test(latex)));
const LIMIT_NAMES = new Set(['lim', 'max', 'min', 'sup', 'inf', 'limsup', 'liminf']);
const ACCENTS: Record<string, string> = { '^': '\\hat', 'ˆ': '\\hat', '~': '\\tilde', '˜': '\\tilde', '˙': '\\dot', '¨': '\\ddot', '⃗': '\\vec', 'ˇ': '\\check', '˘': '\\breve', '´': '\\acute' };
const OVER_BARS = new Set(['‾', '¯', 'ˉ', '̄', '⌢', '￣']);
const UNDER_BARS = new Set(['_', 'ˍ', '̱', '⌣']);
const OVER_BRACES = new Set(['⏞']);
const UNDER_BRACES = new Set(['⏟']);

function elements(node: XmlNode): XmlNode[] {
  return node.children.filter((child) => child.name !== '#text');
}

function childAt(node: XmlNode, index: number): XmlNode | undefined {
  return elements(node)[index];
}

function escapeText(value: string): string {
  return value.replace(/([#%&_${}])/g, '\\$1').replace(/([~^\\])/g, '\\$1');
}

function operatorLatex(text: string): string {
  if (OPERATORS[text]) return OPERATORS[text];
  return escapeText(text);
}

/** n 元算符/lim 类函数作为上下标基底时，直接跟 _^，不需要花括号包住基底。 */
function baseCommand(base: XmlNode | undefined): string | null {
  if (!base) return null;
  const text = nodeText(base).trim();
  if (base.name === 'mo' && NARY.has(OPERATORS[text] ?? '')) return OPERATORS[text];
  if (LIMIT_NAMES.has(text)) return OPERATORS[text] ?? `\\${text}`;
  return null;
}

function convert(node: XmlNode): string {
  switch (node.name) {
    case '#text':
    case 'annotation':
      return '';
    case 'semantics': {
      const body = childAt(node, 0);
      return body ? convert(body) : '';
    }
    case 'mi': {
      const text = nodeText(node);
      if (GREEK[text]) return GREEK[text];
      if (OPERATORS[text]) return OPERATORS[text];
      return text;
    }
    case 'mn':
      return nodeText(node);
    case 'mo':
      return operatorLatex(nodeText(node));
    case 'mtext':
      return `\\text{${escapeText(nodeText(node))}}`;
    case 'mspace':
      return '\\ ';
    case 'mfrac': {
      const [numerator, denominator] = [childAt(node, 0), childAt(node, 1)];
      return `\\frac{${numerator ? convert(numerator) : ''}}{${denominator ? convert(denominator) : ''}}`;
    }
    case 'msqrt':
      return `\\sqrt{${elements(node).map(convert).join('')}}`;
    case 'mroot': {
      const [body, degree] = [childAt(node, 0), childAt(node, 1)];
      return `\\sqrt[${degree ? convert(degree) : ''}]{${body ? convert(body) : ''}}`;
    }
    case 'msup': {
      const [base, sup] = [childAt(node, 0), childAt(node, 1)];
      const command = baseCommand(base);
      if (command) return `${command}^{${sup ? convert(sup) : ''}}`;
      return `{${base ? convert(base) : ''}}^{${sup ? convert(sup) : ''}}`;
    }
    case 'msub': {
      const [base, sub] = [childAt(node, 0), childAt(node, 1)];
      const command = baseCommand(base);
      if (command) return `${command}_{${sub ? convert(sub) : ''}}`;
      return `{${base ? convert(base) : ''}}_{${sub ? convert(sub) : ''}}`;
    }
    case 'msubsup': {
      const [base, sub, sup] = [childAt(node, 0), childAt(node, 1), childAt(node, 2)];
      const command = baseCommand(base);
      if (command) return `${command}_{${sub ? convert(sub) : ''}}^{${sup ? convert(sup) : ''}}`;
      return `{${base ? convert(base) : ''}}_{${sub ? convert(sub) : ''}}^{${sup ? convert(sup) : ''}}`;
    }
    case 'mover':
    case 'munder':
    case 'munderover': {
      const [base, first, second] = [childAt(node, 0), childAt(node, 1), childAt(node, 2)];
      const baseText = base ? nodeText(base).trim() : '';
      const marker = nodeText((node.name === 'mover' ? first : node.name === 'munderover' ? second : first) ?? base ?? node).trim();
      const content = base ? convert(base) : '';
      if (NARY.has(OPERATORS[baseText] ?? '')) {
        const command = OPERATORS[baseText];
        const sub = node.name === 'mover' ? '' : convert(first ?? node);
        const sup = node.name === 'munder' ? '' : convert((node.name === 'mover' ? first : second) ?? node);
        return `${command}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''}`;
      }
      if (LIMIT_NAMES.has(baseText)) {
        const command = OPERATORS[baseText] ?? `\\${baseText}`;
        const sub = node.name === 'mover' ? '' : convert(first ?? node);
        const sup = node.name === 'munderover' ? convert(second ?? node) : '';
        return `${command}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''}`;
      }
      if (ACCENTS[marker]) return `${ACCENTS[marker]}{${content}}`;
      if (OVER_BRACES.has(marker)) return `\\overbrace{${content}}`;
      if (UNDER_BRACES.has(marker)) return `\\underbrace{${content}}`;
      if ((node.name === 'mover' || node.name === 'munderover') && OVER_BARS.has(marker)) return `\\bar{${content}}`;
      if ((node.name === 'munder' || node.name === 'munderover') && UNDER_BARS.has(marker)) return `\\underline{${content}}`;
      if (node.name === 'mover' && marker === '→') return `\\overrightarrow{${content}}`;
      return content;
    }
    case 'mtable': {
      const rows = elements(node).filter((row) => row.name === 'mtr');
      const body = rows
        .map((row) => elements(row).filter((cell) => cell.name === 'mtd').map((cell) => convert(cell)).join(' & '))
        .join(' \\\\ ');
      return `\\begin{matrix}${body}\\end{matrix}`;
    }
    case 'mfenced': {
      const open = FENCES[node.attributes.open ?? '('] ?? (node.attributes.open && node.attributes.open !== '.' ? escapeText(node.attributes.open) : '');
      const close = FENCES[node.attributes.close ?? ')'] ?? (node.attributes.close && node.attributes.close !== '.' ? escapeText(node.attributes.close) : '');
      const separator = (node.attributes.separators ?? ',')[0] ?? ',';
      const content = elements(node).map(convert).join(escapeText(separator));
      return `\\left${open || '.'}${content}\\right${close || '.'}`;
    }
    case 'mrow': {
      const items = elements(node);
      const opening = items[0];
      const closing = items[items.length - 1];
      const openText = opening ? nodeText(opening).trim() : '';
      const closeText = closing ? nodeText(closing).trim() : '';
      // 括号对（KaTeX 用 fence 属性标记，Word 常直接给 mo）还原成 \left \right
      if (items.length >= 3 && opening?.name === 'mo' && closing?.name === 'mo' && FENCES[openText] && FENCES[closeText] && (opening.attributes.fence === 'true' || items.length === 3)) {
        return `\\left${FENCES[openText]}${items.slice(1, -1).map(convert).join('')}\\right${FENCES[closeText]}`;
      }
      return node.children.map((item) => convert(item)).join('');
    }
    case 'mphantom':
      return `\\phantom{${node.children.map(convert).join('')}}`;
    case 'maction': {
      const body = childAt(node, 0);
      return body ? convert(body) : '';
    }
    default:
      return node.children.map((item) => convert(item)).join('');
  }
}

/** 把剪贴板/文件里的 MathML（KaTeX 或 Word 产出）转回 LaTeX。 */
export function mathmlToLatex(mathml: string): string {
  if (!mathml.trim()) return '';
  const root = parseXml(mathml);
  const math = findNode(root, 'math') ?? root;
  const body = math.name === 'math'
    ? elements(math).map(convert).join('')
    : convert(math);
  return body.trim();
}

/** 从 Word 的 HTML 剪贴板碎片中截出 MathML 片段（兼容 mml: 前缀）。 */
export function extractMathml(source: string): string | null {
  const open = /<(\w+:)?math[\s>]/i.exec(source);
  if (!open) return null;
  const prefix = open[1] ?? '';
  const start = open.index;
  const closing = source.toLowerCase().indexOf(`</${prefix.toLowerCase()}math>`, start);
  if (closing < 0) return source.slice(start);
  return source.slice(start, closing + prefix.length + 7);
}
