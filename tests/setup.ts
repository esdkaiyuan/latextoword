import { expect } from 'vitest';
import '@testing-library/jest-dom/vitest';

// jsdom 缺少布局与主题查询相关的浏览器 API，供组件冒烟测试使用
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false
  })) as typeof window.matchMedia;
}

if (!('ResizeObserver' in window)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = (() => [] as unknown as DOMRectList) as typeof Range.prototype.getClientRects;
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = (() => new DOMRect()) as typeof Range.prototype.getBoundingClientRect;
}

// tabster（Fluent 焦点管理）在模块作用域直接使用 NodeFilter，jsdom 未挂到 global 上
const globalScope = globalThis as { NodeFilter?: unknown };
if (!globalScope.NodeFilter) {
  globalScope.NodeFilter = (window as unknown as { NodeFilter?: unknown }).NodeFilter ?? {
      SHOW_ALL: 0xffffffff,
      SHOW_ELEMENT: 0x1,
      SHOW_TEXT: 0x4,
      SHOW_COMMENT: 0x80,
      SHOW_DOCUMENT: 0x100
    };
}

void expect;
