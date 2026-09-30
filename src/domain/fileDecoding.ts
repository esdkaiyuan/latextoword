export type DecodedText = { text: string; encoding: string; warning?: string };

export function decodeBase64File(data: string): Uint8Array {
  const binary = atob(data);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decode(bytes: Uint8Array, label: string, offset = 0): string {
  return new TextDecoder(label, { fatal: true }).decode(bytes.subarray(offset));
}

export function decodeTextFile(bytes: Uint8Array): DecodedText {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: decode(bytes, 'utf-8', 3), encoding: 'UTF-8 BOM' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: decode(bytes, 'utf-16le', 2), encoding: 'UTF-16 LE' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: decode(bytes, 'utf-16be', 2), encoding: 'UTF-16 BE' };
  }
  try {
    return { text: decode(bytes, 'utf-8'), encoding: 'UTF-8' };
  } catch {
    try {
      return { text: decode(bytes, 'gb18030'), encoding: 'GB18030', warning: '文件不是 UTF-8，已按 GB18030 解码' };
    } catch {
      return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'UTF-8（含替代字符）', warning: '文件编码无法准确识别，部分字符可能显示异常' };
    }
  }
}
