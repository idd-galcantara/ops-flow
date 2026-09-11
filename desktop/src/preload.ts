import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('opsFlowDesktop', {
  isDesktop: true,
  platform: process.platform,
  selectKubeconfig: (): Promise<unknown> => ipcRenderer.invoke('select-kubeconfig'),
  loadPresets: (): Promise<unknown> => ipcRenderer.invoke('load-presets'),
  savePresets: (presets: unknown): Promise<void> => ipcRenderer.invoke('save-presets', presets),
});