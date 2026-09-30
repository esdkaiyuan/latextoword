/// <reference types="vite/client" />
import type { ProjectFile } from '../domain/project';

declare global {
  interface Window {
    desktop?: {
      window: {
        setTheme(themeId: string): void;
        quit(): void;
        toggleFullscreen(): Promise<boolean>;
      };
      project: {
        open(): Promise<{ project: unknown; recent: string[] } | null>;
        openPath(filePath: string): Promise<{ project: unknown; recent: string[] }>;
        recent(): Promise<string[]>;
        save(project: ProjectFile): Promise<{ path: string; recent: string[] } | null>;
      };
      files: {
        pick(): Promise<string[]>;
        convertLegacyOffice(payload: { name: string; bytes: Uint8Array }): Promise<{ name: string; bytes: Uint8Array }>;
        read(filePath: string): Promise<{
          path: string;
          name: string;
          size: number;
          encoding: 'text' | 'base64' | 'binary' | 'too-large';
          mime?: string;
          data?: string;
          text?: string;
          truncated?: boolean;
        }>;
        openExternal(filePath: string): Promise<string>;
        showInFolder(filePath: string): Promise<void>;
      };
      documents: {
        open(): Promise<{ path: string; name: string; size: number; bytes: Uint8Array } | null>;
        save(payload: { path: string; bytes: Uint8Array }): Promise<{ path: string; name: string }>;
        saveAs(payload: { defaultName: string; mode: 'source' | 'rich-text' | 'pdf-annotation'; bytes: Uint8Array }): Promise<{ path: string; name: string } | null>;
        convertToDocx(payload: { name: string; bytes: Uint8Array }): Promise<{ name: string; bytes: Uint8Array }>;
        exportDocx(payload: { title: string; html: string }): Promise<Uint8Array>;
      };
      ocr: {
        mathpixStatus(): Promise<{ configured: boolean }>;
        localStatus(): Promise<{ ready: boolean; downloading: boolean }>;
        saveMathpixCredentials(credentials: { appId: string; appKey: string }): Promise<{ configured: boolean }>;
        removeMathpixCredentials(): Promise<{ configured: boolean }>;
        recognizeOnline(payload: { name: string; kind: 'document' | 'image'; bytes: Uint8Array; jobId?: string }): Promise<{ text: string; warnings: string[] }>;
        recognizeLocal(payload: { name: string; kind: 'pdf' | 'image'; bytes: Uint8Array; jobId?: string }): Promise<{ text: string; warnings: string[] }>;
        onProgress(callback: (progress: { jobId: string; name: string; stage: string; percent: number }) => void): () => void;
      };
      clipboard: {
        copyOfficeMath(payload: { latex: string; mathml: string }): Promise<void>;
        write(payload: { text?: string; html?: string; image?: string }): Promise<void>;
        read(): Promise<{ text: string; html: string }>;
      };
      exports: {
        createDocx(payload: {
          parts: Array<{ path: string; content: string }>;
          defaultName?: string;
        }): Promise<string | null>;
        saveImage(payload: { kind: 'png' | 'svg'; svg?: string; dataUrl?: string; defaultName?: string }): Promise<string | null>;
      };
    };
  }
}

export {};
