import { escapeXml } from './mathml';
import { mathmlToOmml } from './omml';

export type DocxFormula = {
  name: string;
  mathml: string;
  displayMode: 'inline' | 'block';
  fontFamily: string;
  fontSizePt: number;
};

export type DocxPart = { path: string; content: string };

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function contentTypes(): string {
  return `${XML_DECLARATION}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
}

function packageRelationships(): string {
  return `${XML_DECLARATION}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
}

function documentRelationships(): string {
  return `${XML_DECLARATION}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function styles(): string {
  return `${XML_DECLARATION}
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
}

function textParagraph(text: string, options: { bold?: boolean; halfPointSize?: number } = {}): string {
  const properties = [
    options.bold ? '<w:b/>' : '',
    options.halfPointSize ? `<w:sz w:val="${options.halfPointSize}"/>` : ''
  ].join('');
  const runProperties = properties ? `<w:rPr>${properties}</w:rPr>` : '';
  return `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function formulaParagraph(formula: DocxFormula): string {
  const omml = mathmlToOmml(formula.mathml, formula.fontFamily, formula.fontSizePt);
  const body = formula.displayMode === 'block' ? `<m:oMathPara>${omml}</m:oMathPara>` : omml;
  return `<w:p><w:pPr><w:spacing w:after="200"/></w:pPr>${body}</w:p>`;
}

export function buildDocumentXml(title: string, formulas: DocxFormula[], includeNames: boolean, fontSizePt = 14): string {
  const paragraphs: string[] = [textParagraph(title, { bold: true, halfPointSize: Math.round(fontSizePt * 2) + 8 })];
  for (const formula of formulas) {
    if (includeNames && formula.name) paragraphs.push(textParagraph(formula.name, { bold: true }));
    paragraphs.push(formulaParagraph(formula));
  }
  return `${XML_DECLARATION}
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>${paragraphs.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="851" w:footer="992" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

/** 生成一份最小可用的 docx 包（OOXML），主进程只需把它压缩成 zip。 */
export function buildDocxParts(title: string, formulas: DocxFormula[], includeNames = true): DocxPart[] {
  return [
    { path: '[Content_Types].xml', content: contentTypes() },
    { path: '_rels/.rels', content: packageRelationships() },
    { path: 'word/_rels/document.xml.rels', content: documentRelationships() },
    { path: 'word/styles.xml', content: styles() },
    { path: 'word/document.xml', content: buildDocumentXml(title, formulas, includeNames) }
  ];
}
