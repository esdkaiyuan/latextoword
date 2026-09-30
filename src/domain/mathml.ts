export type XmlNode = {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
};

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

function parseAttributes(input: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of input.matchAll(/([^\s=/]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    attributes[match[1].replace(/^[^:]*:/, '')] = decodeEntities(match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function textNode(text: string): XmlNode {
  return { name: '#text', attributes: {}, children: [], text };
}

/**
 * 够用的 XML 解析器：MathML 由 KaTeX 生成，格式固定且一定闭合良好，
 * 这里只处理元素、属性、实体与注释，不追求完整 XML 规范。
 */
export function parseXml(source: string): XmlNode {
  const root: XmlNode = { name: '#root', attributes: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  let index = 0;

  while (index < source.length) {
    const open = source.indexOf('<', index);
    if (open < 0) {
      const tail = decodeEntities(source.slice(index));
      if (tail.trim()) stack[stack.length - 1].children.push(textNode(tail));
      break;
    }
    if (open > index) {
      const text = decodeEntities(source.slice(index, open));
      if (text.trim()) stack[stack.length - 1].children.push(textNode(text));
    }

    if (source.startsWith('<!--', open)) {
      const end = source.indexOf('-->', open);
      index = end < 0 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith('<?', open) || source.startsWith('<!', open)) {
      const end = source.indexOf('>', open);
      index = end < 0 ? source.length : end + 1;
      continue;
    }
    if (source.startsWith('</', open)) {
      const end = source.indexOf('>', open);
      const name = (end < 0 ? source.slice(open + 2) : source.slice(open + 2, end)).trim().replace(/^[^:]*:/, '');
      for (let cursor = stack.length - 1; cursor > 0; cursor -= 1) {
        if (stack[cursor].name === name) {
          stack.length = cursor;
          break;
        }
      }
      index = end < 0 ? source.length : end + 1;
      continue;
    }

    let cursor = open + 1;
    let quote: string | null = null;
    while (cursor < source.length) {
      const char = source[cursor];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        break;
      }
      cursor += 1;
    }
    const raw = source.slice(open + 1, cursor);
    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const split = body.search(/\s/);
    const tagName = (split < 0 ? body : body.slice(0, split)).replace(/^[^:]*:/, '');
    const node: XmlNode = {
      name: tagName,
      attributes: split < 0 ? {} : parseAttributes(body.slice(split)),
      children: [],
      text: ''
    };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing && tagName !== 'annotation') stack.push(node);
    index = cursor + 1;
  }

  return root;
}

export function findNode(node: XmlNode, name: string): XmlNode | null {
  if (node.name === name) return node;
  for (const child of node.children) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return null;
}

/** 节点下的全部文本，用于把 <mi>x</mi> 之类的叶子取成字符串。 */
export function nodeText(node: XmlNode): string {
  if (node.name === '#text') return node.text;
  return node.children.map(nodeText).join('');
}
