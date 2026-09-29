const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendFloatingControllerAction: (action) => {
    ipcRenderer.send('floating-controller-action', action);
  },
  onRecordingStateChange: (callback) => {
    ipcRenderer.on('recording-state-change', (_event, state, data) => {
      callback(state, data);
    });
  }
});
