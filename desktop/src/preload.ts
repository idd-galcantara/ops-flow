import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('opsFlowDesktop', {
  isDesktop: true,
  platform: process.platform,
});