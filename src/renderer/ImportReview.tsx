import { useState } from 'react';
import { Button } from '@fluentui/react-components';
import { Check, Square, X } from 'lucide-react';
import { renderLatex } from '../domain/mathPreview';
import type { FormulaItem } from '../domain/project';

type Props = {
  formulas: FormulaItem[];
  report: string[];
  macros: Record<string, string>;
  onApply: (formulas: FormulaItem[]) => void;
  onClose: () => void;
};

export default function ImportReview({ formulas, report, macros, onApply, onClose }: Props) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(formulas.map((formula) => formula.id)));
  const selected = formulas.filter((formula) => selectedIds.has(formula.id));
  const allSelected = selected.length === formulas.length;

  function toggle(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(formulas.map((formula) => formula.id)));
  }

  return (
    <div className="import-review-backdrop" role="dialog" aria-modal="true" aria-label="复核识别结果">
      <section className="import-review">
        <header><div><strong>复核导入结果</strong><small>识别结果可先预览和取消勾选，再写入公式集合</small></div><Button appearance="subtle" icon={<X size={16} />} onClick={onClose} aria-label="关闭" /></header>
        <div className="import-review-reports">{report.map((item) => <span key={item}>{item}</span>)}</div>
        <div className="import-review-toolbar"><button onClick={toggleAll}>{allSelected ? <Check size={14} /> : <Square size={14} />}{allSelected ? '取消全选' : '全选'}</button><span>已选 {selected.length} / {formulas.length} 条</span></div>
        <div className="import-review-list">
          {formulas.map((formula) => {
            const rendered = renderLatex(formula.latex, formula.displayMode, macros);
            return <label className={`import-review-item ${selectedIds.has(formula.id) ? 'selected' : ''}`} key={formula.id}>
              <input type="checkbox" checked={selectedIds.has(formula.id)} onChange={() => toggle(formula.id)} />
              <div className="import-review-item-content"><strong>{formula.name}</strong><div className="import-review-math">{rendered.ok ? <div dangerouslySetInnerHTML={{ __html: rendered.html }} /> : <code>{formula.latex}</code>}</div><code className="import-review-source">{formula.latex}</code></div>
            </label>;
          })}
        </div>
        <footer><Button appearance="subtle" onClick={onClose}>取消导入</Button><Button appearance="primary" disabled={!selected.length} onClick={() => onApply(selected)}>导入已选 {selected.length} 条</Button></footer>
      </section>
    </div>
  );
}
