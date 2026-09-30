const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  window: {
    setTheme: (themeId) => ipcRenderer.send('window:set-theme', themeId),
    quit: () => ipcRenderer.send('window:quit'),
    toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
    onBeforeClose: (callback) => {
      const listener = () => callback((shouldClose) => ipcRenderer.send('window:close-response', shouldClose));
      ipcRenderer.on('window:before-close', listener);
      return () => ipcRenderer.removeListener('window:before-close', listener);
    }
  },
  project: {
    open: () => ipcRenderer.invoke('project:open'),
    openPath: (filePath) => ipcRenderer.invoke('project:open-path', filePath),
    recent: () => ipcRenderer.invoke('project:recent'),
    save: (project) => ipcRenderer.invoke('project:save', { project, title: project.title })
  },
  files: {
    pick: () => ipcRenderer.invoke('file:pick'),
    read: (filePath) => ipcRenderer.invoke('file:read', filePath),
    convertLegacyOffice: (payload) => ipcRenderer.invoke('file:convert-legacy-office', payload),
    openExternal: (filePath) => ipcRenderer.invoke('file:open-external', filePath),
    showInFolder: (filePath) => ipcRenderer.invoke('file:show-in-folder', filePath)
  },
  documents: {
    open: () => ipcRenderer.invoke('document:open'),
    save: (payload) => ipcRenderer.invoke('document:save', payload),
    saveAs: (payload) => ipcRenderer.invoke('document:save-as', payload),
    convertToDocx: (payload) => ipcRenderer.invoke('document:convert-to-docx', payload),
    exportDocx: (payload) => ipcRenderer.invoke('document:export-docx', payload)
  },
  ocr: {
    mathpixStatus: () => ipcRenderer.invoke('ocr:mathpix-status'),
    localStatus: () => ipcRenderer.invoke('ocr:local-status'),
    saveMathpixCredentials: (credentials) => ipcRenderer.invoke('ocr:mathpix-save', credentials),
    removeMathpixCredentials: () => ipcRenderer.invoke('ocr:mathpix-remove'),
    recognizeOnline: (payload) => ipcRenderer.invoke('ocr:mathpix-recognize', payload),
    recognizeLocal: (payload) => ipcRenderer.invoke('ocr:local-recognize', payload),
    onProgress: (callback) => {
      const listener = (_, progress) => callback(progress);
      ipcRenderer.on('ocr:progress', listener);
      return () => ipcRenderer.removeListener('ocr:progress', listener);
    }
  },
  clipboard: {
    copyOfficeMath: (payload) => ipcRenderer.invoke('clipboard:copy-office-math', payload),
    write: (payload) => ipcRenderer.invoke('clipboard:write', payload),
    read: () => ipcRenderer.invoke('clipboard:read')
  },
  exports: {
    createDocx: (payload) => ipcRenderer.invoke('export:create-docx', payload),
    saveImage: (payload) => ipcRenderer.invoke('export:save-image', payload)
  }
});
