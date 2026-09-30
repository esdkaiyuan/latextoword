import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import type { SearchHit } from '../domain/search';

const KIND_LABEL: Record<SearchHit['kind'], string> = {
  project: '项目',
  library: '公式库',
  symbol: '符号',
  template: '模板'
};

type Props = {
  query: string;
  hits: SearchHit[];
  activeIndex: number;
  onQuery: (query: string) => void;
  onActiveIndex: (index: number) => void;
  onPick: (hit: SearchHit) => void;
  onClose: () => void;
};

export default function CommandPalette({ query, hits, activeIndex, onQuery, onActiveIndex, onPick, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-label="全局搜索面板">
        <div className="palette-input-row">
          <Search size={15} />
          <input
            ref={inputRef}
            value={query}
            placeholder="搜索公式、符号、模板（↑↓ 选择，Enter 插入）"
            aria-label="全局搜索"
            onChange={(event) => { onQuery(event.target.value); onActiveIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                onActiveIndex(Math.min(activeIndex + 1, Math.max(0, hits.length - 1)));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                onActiveIndex(Math.max(activeIndex - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                const hit = hits[activeIndex];
                if (hit) onPick(hit);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
          />
          <span className="palette-hint">Esc 关闭</span>
        </div>
        <div className="palette-results">
          {hits.length === 0 && <div className="palette-empty">没有匹配结果</div>}
          {hits.map((hit, index) => (
            <button
              type="button"
              key={`${hit.kind}-${hit.id}`}
              className={`palette-item ${index === activeIndex ? 'active' : ''}`}
              onMouseEnter={() => onActiveIndex(index)}
              onClick={() => onPick(hit)}
            >
              <span className={`palette-kind kind-${hit.kind}`}>{KIND_LABEL[hit.kind]}</span>
              <span className="palette-title">{hit.title}</span>
              <span className="palette-subtitle">{hit.subtitle}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
