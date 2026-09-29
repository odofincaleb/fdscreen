const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onFloatingCameraConfig: (callback) => {
    ipcRenderer.on('floating-camera-config', (_event, config) => callback(config));
  },
  onFloatingCameraFrame: (callback) => {
    ipcRenderer.on('floating-camera-frame', (_event, dataUrl) => callback(dataUrl));
  },
  setFloatingCameraShape: (shape) => ipcRenderer.invoke('set-floating-camera-shape', shape),
  hideFloatingCamera: () => ipcRenderer.invoke('hide-floating-camera'),
  startFloatingCameraDrag: (point) => ipcRenderer.send('floating-camera-drag-start', point),
  moveFloatingCameraDrag: (point) => ipcRenderer.send('floating-camera-drag-move', point),
  endFloatingCameraDrag: () => ipcRenderer.send('floating-camera-drag-end')
});
