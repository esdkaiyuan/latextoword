import { autocompletion, closeBrackets, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { linter, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';
import { renderLatex } from '../domain/mathPreview';
import { MATH_SYMBOLS, MATH_TEMPLATES } from '../domain/mathSymbols';

const latexParser = StreamLanguage.define({
  name: 'latex',
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^%[^\n]*/)) return 'comment';
    if (stream.match(/^\\[a-zA-Z@]+/)) return 'keyword';
    if (stream.match(/^\\[^a-zA-Z]/)) return 'operator';
    if (stream.match(/^[{}[\]()]/)) return 'bracket';
    if (stream.match(/^[&_^~]/)) return 'operator';
    if (stream.match(/^\d+(\.\d+)?/)) return 'number';
    if (stream.match(/^[a-zA-Z]+/)) return 'variable';
    stream.next();
    return null;
  },
  tokenTable: {
    comment: tags.comment,
    keyword: tags.keyword,
    operator: tags.operator,
    bracket: tags.bracket,
    number: tags.number,
    variable: tags.variableName
  }
});

// 颜色交给 CSS 变量控制，才能跟随主题切换
const latexHighlight = HighlightStyle.define([
  { tag: tags.comment, class: 'cm-lx-comment' },
  { tag: tags.keyword, class: 'cm-lx-keyword' },
  { tag: tags.operator, class: 'cm-lx-operator' },
  { tag: tags.bracket, class: 'cm-lx-bracket' },
  { tag: tags.number, class: 'cm-lx-number' },
  { tag: tags.variableName, class: 'cm-lx-variable' }
]);

const completions: Completion[] = [
  ...MATH_TEMPLATES.map((template) => ({
    label: template.label,
    detail: template.description,
    apply: template.insert,
    type: 'snippet'
  })),
  ...MATH_SYMBOLS.map((symbol) => ({
    label: symbol.insert.trim(),
    detail: `${symbol.label} · ${symbol.category}`,
    type: 'keyword'
  }))
];

function latexCompletions(context: CompletionContext): CompletionResult | null {
  const command = context.matchBefore(/\\[a-zA-Z@]*/);
  const word = command ?? context.matchBefore(/[^\s\\]{1,20}/);
  if (!word && !context.explicit) return null;
  return { from: word ? word.from : context.pos, options: completions, validFor: /^[^\s]*$/ };
}

export function latex(macros: Record<string, string> = {}): Extension {
  const latexLinter = linter((view) => {
    const text = view.state.doc.toString();
    if (!text.trim()) return [];
    const result = renderLatex(text, 'block', macros);
    if (result.ok || result.position === null) return [];
    const from = Math.max(0, Math.min(result.position, Math.max(0, text.length - 1)));
    const diagnostic: Diagnostic = {
      from,
      to: Math.min(text.length, from + 1),
      severity: 'error',
      message: result.message
    };
    return [diagnostic];
  });

  return [
    latexParser,
    syntaxHighlighting(latexHighlight),
    closeBrackets(),
    autocompletion({ override: [latexCompletions] }),
    latexLinter
  ];
}
