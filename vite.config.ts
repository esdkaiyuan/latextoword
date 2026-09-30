import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['@fluentui/react-icons']
  },
  server: { port: 5173 },
  build: { outDir: 'dist-renderer' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Fluent UI 的嵌套依赖在 Node 解析下会指向不存在的入口，交给 Vite 处理才能加载
    server: { deps: { inline: [/@fluentui/] } }
  }
});
