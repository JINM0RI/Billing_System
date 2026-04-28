import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('desktopApp', {
  version: '1.0.0',
});
