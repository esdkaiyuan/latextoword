import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../src/renderer/App';
import { DRAFT_STORAGE_KEY } from '../src/domain/persistence';

describe('workbench shell', () => {
  // 未开启 vitest globals，需手动卸载，否则自动保存的定时器会在环境销毁后触发
  afterEach(() => cleanup());
  beforeEach(() => localStorage.clear());

  it('opens the global palette with Ctrl+K and filters across the project', () => {
    render(<App />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = screen.getByLabelText('全局搜索');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '欧拉' } });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText('欧拉恒等式').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('项目')).toBeInTheDocument();
  });

  it('multi-selects formulas with ctrl click and shows the batch bar', () => {
    const { container } = render(<App />);
    const projectList = container.querySelector('.project-formula-list') as HTMLElement;

    fireEvent.click(within(projectList).getByText('二次方程'), { ctrlKey: true });

    expect(screen.getByText('已选 1 条')).toBeInTheDocument();
    expect(screen.getByText('同步样式')).toBeInTheDocument();
  });

  it('switches the workspace between horizontal and vertical split', () => {
    const { container } = render(<App />);
    const workspace = container.querySelector('.workspace') as HTMLElement;
    expect(workspace.dataset.orientation).toBe('horizontal');

    fireEvent.click(screen.getByText('视图'));
    fireEvent.click(screen.getByText('上下分屏'));

    expect(workspace.dataset.orientation).toBe('vertical');
    expect(screen.getByText('左右分屏')).toBeInTheDocument();
  });

  it('switches between formula and whole-document workspaces', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: /文档工作区/ }));
    expect(screen.getByRole('heading', { name: '在工作台中编辑整份文档' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '公式工作台' }));
    expect(screen.getByRole('tab', { name: '公式工作台' })).toHaveAttribute('aria-selected', 'true');
  });

  it('imports multiple files at once and skips duplicate formulas', async () => {
    const { container } = render(<App />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    // jsdom 的 File 没有 .text()，用最小文件对象代替，与导入逻辑用到的字段一致
    const makeFile = (name: string, content: string) => ({
      name,
      type: 'text/plain',
      size: content.length,
      arrayBuffer: async () => new TextEncoder().encode(content).buffer
    }) as unknown as File;
    const notes = makeFile('notes.txt', '$$E=mc^2$$\n$$x_1+x_2=7$$');
    const duplicate = makeFile('dup.md', '$$E=mc^2$$');

    Object.defineProperty(input, 'files', { value: [notes, duplicate], configurable: true });
    fireEvent.change(input);

    const review = await screen.findByRole('dialog', { name: '复核识别结果' });
    fireEvent.click(within(review).getByRole('button', { name: /导入已选/ }));
    await waitFor(() => expect(screen.getByText(/导入完成：新增 1 条，重复跳过 2 条/)).toBeInTheDocument(), { timeout: 3000 });
  });

  it('reorders project formulas by dragging', () => {
    const { container } = render(<App />);
    const list = container.querySelector('.project-formula-list') as HTMLElement;
    const items = list.querySelectorAll('.formula-item');
    const [first, second] = [items[0] as HTMLElement, items[1] as HTMLElement];
    const originalFirst = first.querySelector('.formula-item-title')?.textContent;

    fireEvent.dragStart(first);
    fireEvent.dragOver(second);
    fireEvent.drop(second);

    const updated = list.querySelectorAll('.formula-item');
    expect(updated[0].querySelector('.formula-item-title')?.textContent).not.toBe(originalFirst);
  });

  it('closes the template drawer with Escape', () => {
    const { container } = render(<App />);
    const tabs = container.querySelector('.ribbon-tabs') as HTMLElement;

    fireEvent.click(within(tabs).getByText('模板'));
    expect(container.querySelector('.template-drawer')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('.template-drawer')).toBeNull();
  });

  it('autosaves the project to local storage', async () => {
    render(<App />);

    await waitFor(
      () => expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toContain('二次方程'),
      { timeout: 3000 }
    );
  });
});
