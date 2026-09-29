const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  setCaptureSource: (payload) => ipcRenderer.invoke('set-capture-source', payload),
  showFloatingController: () => ipcRenderer.invoke('show-floating-controller'),
  hideFloatingController: () => ipcRenderer.invoke('hide-floating-controller'),
  showFloatingCamera: (config) => ipcRenderer.invoke('show-floating-camera', config),
  hideFloatingCamera: () => ipcRenderer.invoke('hide-floating-camera'),
  getFloatingCameraBounds: () => ipcRenderer.invoke('get-floating-camera-bounds'),
  sendFloatingCameraFrame: (dataUrl) => {
    ipcRenderer.send('floating-camera-frame', dataUrl);
  },
  setBackgroundThrottling: (enabled) => ipcRenderer.invoke('set-background-throttling', enabled),
  onFloatingCameraBounds: (callback) => {
    ipcRenderer.on('floating-camera-bounds', (_event, data) => callback(data));
  },
  onFloatingCameraShapeChanged: (callback) => {
    ipcRenderer.on('floating-camera-shape-changed', (_event, shape) => callback(shape));
  },
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  sendRecordingState: (state, data) => ipcRenderer.invoke('send-recording-state', state, data),
  beginRecordingFile: (extension) => ipcRenderer.invoke('begin-recording-file', extension),
  appendRecordingChunk: (buffer) => ipcRenderer.invoke('append-recording-chunk', buffer),
  finishRecordingFile: () => ipcRenderer.invoke('finish-recording-file'),
  deleteRecordingFile: (filePath) => ipcRenderer.invoke('delete-recording-file', filePath),
  saveRecording: (payload) => ipcRenderer.invoke('save-recording', payload),
  onSaveProgress: (callback) => {
    ipcRenderer.on('save-progress', (_event, data) => callback(data));
  },
  registerShortcuts: (shortcuts) => ipcRenderer.invoke('register-shortcuts', shortcuts),
  unregisterShortcuts: () => ipcRenderer.invoke('unregister-shortcuts'),
  onShortcutTriggered: (callback) => {
    ipcRenderer.on('shortcut-triggered', (_event, action) => callback(action));
  },
  onFloatingControllerAction: (callback) => {
    ipcRenderer.on('floating-controller-action', (_event, action) => callback(action));
  },
  sendFloatingControllerAction: (action) => {
    ipcRenderer.send('floating-controller-action', action);
  },
  onRecordingStateChange: (callback) => {
    ipcRenderer.on('recording-state-change', (_event, state, data) => callback(state, data));
  }
});
