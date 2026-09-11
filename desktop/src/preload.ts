import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('opsFlowDesktop', {
  isDesktop: true,
  platform: process.platform,
  selectKubeconfig: (): Promise<unknown> => ipcRenderer.invoke('select-kubeconfig'),
});