import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FileViewer, { type ViewerFile } from '../src/renderer/FileViewer';

const textFile: ViewerFile = {
  path: 'C:/docs/notes.md',
  name: 'notes.md',
  size: 2048,
  encoding: 'text',
  text: '$$E=mc^2$$\n\\begin{equation}a^2+b^2=c^2\\end{equation}'
};

function renderViewer(files: ViewerFile[], overrides: Partial<Parameters<typeof FileViewer>[0]> = {}) {
  return render(
    <FileViewer
      files={files}
      index={0}
      onIndexChange={() => undefined}
      onClose={() => undefined}
      onImport={() => undefined}
      onCopy={() => undefined}
      onOpenExternal={() => undefined}
      onShowInFolder={() => undefined}
      {...overrides}
    />
  );
}

describe('file viewer', () => {
  afterEach(() => cleanup());

  it('previews text files with size and import actions', () => {
    renderViewer([textFile]);

    expect(screen.getByText('Markdown')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByText(/E=mc\^2\$/)).toBeInTheDocument();
    expect(screen.getByText('导入此文件的公式')).toBeInTheDocument();
    expect(screen.getByText('复制全文')).toBeInTheDocument();
  });

  it('hides formula actions for non-text files and shows size hint for large ones', () => {
    renderViewer([{ path: 'C:/img/a.png', name: 'a.png', size: 22 * 1024 * 1024, encoding: 'too-large' }]);

    expect(screen.getByText('图片')).toBeInTheDocument();
    expect(screen.getByText('22.0 MB')).toBeInTheDocument();
    expect(screen.queryByText('导入此文件的公式')).not.toBeInTheDocument();
    expect(screen.getByText(/文件超过 20 MB/)).toBeInTheDocument();
  });

  it('navigates between multiple files', () => {
    const onIndexChange = vi.fn();
    const second: ViewerFile = { path: 'C:/img/b.png', name: 'b.png', size: 10, encoding: 'base64', mime: 'image/png', data: 'aGk=' };

    renderViewer([textFile, second], { onIndexChange });

    fireEvent.click(screen.getByLabelText('下一个文件'));
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('shows a zoom control for images', () => {
    renderViewer([{ path: 'C:/img/b.png', name: 'b.png', size: 10, encoding: 'base64', mime: 'image/png', data: 'aGk=' }]);

    expect(screen.getByLabelText('放大')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('放大'));
    expect(screen.getByText('120%')).toBeInTheDocument();
  });
});
