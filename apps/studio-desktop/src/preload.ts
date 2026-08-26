import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('horizonDesktop', {
  openProject: () => ipcRenderer.invoke('project:open'),
  openComposition: () => ipcRenderer.invoke('project:open-composition'),
  readCompositionFile: (filePath: string) => ipcRenderer.invoke('composition:read-file', filePath),
  revealCompositionFile: (filePath: string) => ipcRenderer.invoke('composition:reveal-file', filePath),
  saveProject: (project: unknown, saveAs = false) => ipcRenderer.invoke('project:save', project, saveAs),
  openImage: () => ipcRenderer.invoke('asset:open-image'),
  openAudio: () => ipcRenderer.invoke('audio:open-preview'),
  openPreset: () => ipcRenderer.invoke('preset:open'),
  savePreset: (preset: unknown) => ipcRenderer.invoke('preset:save', preset),
  publishVault: (request: unknown) => ipcRenderer.invoke('publish:vault', request),
  listVault: () => ipcRenderer.invoke('vault:list'),
  openVaultProject: (slug: string) => ipcRenderer.invoke('vault:open-project', slug),
  readVaultProject: (slug: string) => ipcRenderer.invoke('vault:read-project', slug),
  revealVault: (slug: string) => ipcRenderer.invoke('vault:reveal', slug),
  uninstallVault: (slug: string) => ipcRenderer.invoke('vault:uninstall', slug),
  publishBundle: (request: unknown) => ipcRenderer.invoke('publish:bundle', request),
  openRuntime: () => ipcRenderer.invoke('window:open-runtime'),
  setUiScale: (scale: number) => ipcRenderer.invoke('ui:set-scale', scale)
});
