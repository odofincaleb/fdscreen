const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, globalShortcut, session, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Keep timers + media decoding alive while the recorder window is parked off-screen.
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch(
  'disable-features',
  'WebRtcAllowWgcScreenCapturer,WebRtcAllowWgcWindowCapturer'
);

if (process.platform === 'win32') {
  app.setAppUserModelId('com.screenrecorder.app');
}

let mainWindow = null;
let floatingController = null;
let floatingCamera = null;
let floatingCameraShape = 'square';
let recordingWriteStream = null;
let recordingTempPath = null;
let preferredCaptureSourceId = null;
let captureWantSystemAudio = false;
let powerSaveId = null;
let mainWindowRestoreBounds = null;
let floatingCameraDragOffset = null;

function cameraWindowSize(shape) {
  if (shape === 'circle') {
    return { width: 220, height: 220 };
  }
  return { width: 300, height: 200 };
}

function positionFloatingCamera(win, shape = floatingCameraShape) {
  const { screen } = require('electron');
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const size = cameraWindowSize(shape);
  win.setBounds({
    x: screenWidth - size.width - 24,
    y: screenHeight - size.height - 80,
    width: size.width,
    height: size.height
  });
}

function resolveAppIcon() {
  const candidates = [
    path.join(__dirname, 'assets', 'icon.ico'),
    path.join(__dirname, 'assets', 'icon.png'),
    path.join(__dirname, '..', 'assets', 'icon.ico'),
    path.join(__dirname, '..', 'assets', 'icon.png')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;
}

function createWindow() {
  const icon = resolveAppIcon();
  mainWindow = new BrowserWindow({
    width: 420,
    height: 640,
    show: false,
    icon,
    title: 'FDSCREEN',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false
    }
  });

  if (icon) {
    try {
      mainWindow.setIcon(icon);
    } catch (_err) {
      // ignore
    }
  }

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.webContents.setBackgroundThrottling(false);
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    closeFloatingController();
    closeFloatingCamera();
    stopRecordingKeepAlive();
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function startRecordingKeepAlive() {
  if (powerSaveId == null) {
    powerSaveId = powerSaveBlocker.start('prevent-app-suspension');
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.setBackgroundThrottling(false);
  // Minimize freezes <video> frame decode on Windows. Park off-screen instead.
  if (!mainWindowRestoreBounds) {
    mainWindowRestoreBounds = mainWindow.getBounds();
  }
  try {
    mainWindow.setOpacity(0);
  } catch (_err) {
    // ignore
  }
  mainWindow.setSkipTaskbar(true);
  mainWindow.setBounds({
    x: -32000,
    y: -32000,
    width: Math.max(100, mainWindowRestoreBounds.width || 420),
    height: Math.max(100, mainWindowRestoreBounds.height || 640)
  });
  if (!mainWindow.isVisible()) {
    mainWindow.showInactive();
  }
}

function stopRecordingKeepAlive() {
  if (powerSaveId != null && powerSaveBlocker.isStarted(powerSaveId)) {
    powerSaveBlocker.stop(powerSaveId);
  }
  powerSaveId = null;
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindowRestoreBounds = null;
    return;
  }
  if (mainWindowRestoreBounds) {
    mainWindow.setBounds(mainWindowRestoreBounds);
    mainWindowRestoreBounds = null;
  }
  try {
    mainWindow.setOpacity(1);
  } catch (_err) {
    // ignore
  }
  mainWindow.setSkipTaskbar(false);
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
}

function isFloatingControllerSource(source) {
  const name = (source.name || '').toLowerCase();
  const id = (source.id || '').toLowerCase();
  const exactTitles = new Set([
    'recording controller',
    'screen recorder floating controller',
    'floating controller',
    'camera overlay'
  ]);

  return (
    exactTitles.has(name) ||
    name === 'fdscreen floating controller' ||
    id.includes('screen-recorder-floating-controller') ||
    id.includes('fdscreen-floating-camera') ||
    (source.bounds && source.bounds.width === 200 && source.bounds.height === 50) ||
    (source.bounds && source.bounds.width === 220 && source.bounds.height === 220) ||
    (source.bounds && source.bounds.width === 300 && source.bounds.height === 200)
  );
}

ipcMain.handle('set-capture-source', (_event, payload = {}) => {
  preferredCaptureSourceId = payload.id || null;
  captureWantSystemAudio = payload.systemAudio === true;
  return { ok: true };
});

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 }
  });

  return sources
    .filter((source) => !isFloatingControllerSource(source))
    .map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
});

function closeRecordingStream() {
  return new Promise((resolve) => {
    if (!recordingWriteStream) {
      resolve();
      return;
    }
    recordingWriteStream.end(() => {
      recordingWriteStream = null;
      resolve();
    });
  });
}

ipcMain.handle('begin-recording-file', async (_event, extension) => {
  await closeRecordingStream();
  const ext = extension === 'mp4' ? 'webm' : (extension || 'webm');
  recordingTempPath = path.join(os.tmpdir(), `fdscreen-${Date.now()}.${ext}`);
  recordingWriteStream = fs.createWriteStream(recordingTempPath);
  return { path: recordingTempPath };
});

ipcMain.handle('append-recording-chunk', async (_event, buffer) => {
  if (!recordingWriteStream) {
    throw new Error('No active recording file');
  }
  const data = Buffer.from(buffer);
  await new Promise((resolve, reject) => {
    recordingWriteStream.write(data, (err) => (err ? reject(err) : resolve()));
  });
  return { ok: true };
});

ipcMain.handle('finish-recording-file', async () => {
  await closeRecordingStream();
  return { path: recordingTempPath, exists: !!(recordingTempPath && fs.existsSync(recordingTempPath)) };
});

ipcMain.handle('delete-recording-file', async (_event, filePath) => {
  const target = filePath || recordingTempPath;
  await closeRecordingStream();
  if (target && fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
  if (target === recordingTempPath) {
    recordingTempPath = null;
  }
  return { success: true };
});

function unpackAsarPath(binaryPath) {
  if (!binaryPath) {
    return null;
  }
  return binaryPath.includes('app.asar')
    ? binaryPath.replace('app.asar', 'app.asar.unpacked')
    : binaryPath;
}

function getBundledFfmpegPath() {
  try {
    const bundled = unpackAsarPath(require('ffmpeg-static'));
    if (bundled && fs.existsSync(bundled)) {
      return bundled;
    }
  } catch (_err) {
    // Package missing in some unpackaged layouts.
  }
  return null;
}

function sendSaveProgress(percent, label) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('save-progress', {
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      label: label || 'Saving…'
    });
  }
}

function parseFfmpegTimeToMs(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) {
    return Number(value) / 1000;
  }
  const parts = value.split(':').map(Number);
  if (parts.length === 3) {
    return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;
  }
  return 0;
}

function spawnFfmpeg(inputPath, outputPath, includeAudio, durationMs) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getBundledFfmpegPath();
    if (!ffmpegPath) {
      reject(new Error('Bundled ffmpeg was not found'));
      return;
    }

    // Do not pass -t or -shortest. MediaRecorder WebM often has broken/short
    // stream durations; those flags were cutting ~1+ minute clips to <1s.
    const args = [
      '-y',
      '-hide_banner',
      '-fflags', '+genpts+igndts+discardcorrupt',
      '-analyzeduration', '20000000',
      '-probesize', '20000000',
      '-i', inputPath,
      '-map', '0:v:0'
    ];
    if (includeAudio) {
      args.push('-map', '0:a:0?');
    }
    args.push(
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-fps_mode', 'vfr'
    );
    if (includeAudio) {
      args.push('-c:a', 'aac', '-ar', '48000', '-ac', '2');
    } else {
      args.push('-an');
    }
    args.push(outputPath);

    const child = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe']
    });
    let settled = false;
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    let stderr = '';
    const progressBasisMs = durationMs > 1000 ? durationMs : 0;
    const timeoutMs = progressBasisMs > 0
      ? Math.max(90000, progressBasisMs * 3 + 60000)
      : 300000;
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch (_err) {
        // ignore
      }
      finish(() => reject(new Error('MP4 encoding timed out')));
    }, timeoutMs);

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      const time = stderr.match(/time=(\d+:\d+:\d+\.\d+)/g);
      if (time && progressBasisMs > 0) {
        const ms = parseFfmpegTimeToMs(time[time.length - 1].replace('time=', ''));
        sendSaveProgress(Math.min(97, (ms / progressBasisMs) * 100), 'Encoding MP4…');
      } else if (time) {
        // No reliable duration — pulse progress so the UI does not look stuck.
        sendSaveProgress(50, 'Encoding MP4…');
      }
    });
    child.on('error', (err) => {
      finish(() => reject(err));
    });
    child.on('close', (code) => {
      const size = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
      if (code === 0 && size > 0) {
        finish(() => {
          sendSaveProgress(100, 'Finishing…');
          resolve(outputPath);
        });
        return;
      }
      if (fs.existsSync(outputPath) && size === 0) {
        try { fs.unlinkSync(outputPath); } catch (_err) { /* ignore */ }
      }
      const detail = stderr.trim().split('\n').slice(-8).join(' ');
      finish(() => reject(new Error(detail || `ffmpeg exited with code ${code}`)));
    });
  });
}

async function runFfmpeg(inputPath, outputPath, durationMs) {
  try {
    return await spawnFfmpeg(inputPath, outputPath, true, durationMs);
  } catch (_first) {
    return spawnFfmpeg(inputPath, outputPath, false, durationMs);
  }
}

ipcMain.handle('save-recording', async (_event, payload) => {
  const filename = payload?.filename || 'recording.webm';
  const sourcePath = payload?.sourcePath;
  const buffer = payload?.buffer;
  const convertToMp4 = payload?.convertToMp4 === true;
  const durationMs = Number(payload?.durationMs) || 0;

  const ext = path.extname(filename).replace('.', '') || 'webm';
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename,
    filters: [
      ext === 'mp4'
        ? { name: 'MP4 Videos', extensions: ['mp4'] }
        : { name: 'WebM Videos', extensions: ['webm'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (canceled || !filePath) {
    return { success: false, cancelled: true };
  }

  try {
    sendSaveProgress(2, 'Preparing file…');
    let inputPath = sourcePath;
    let tempFromBuffer = null;

    if (!inputPath || !fs.existsSync(inputPath) || fs.statSync(inputPath).size === 0) {
      if (buffer) {
        tempFromBuffer = path.join(os.tmpdir(), `fdscreen-save-${Date.now()}.webm`);
        fs.writeFileSync(tempFromBuffer, Buffer.from(buffer));
        inputPath = tempFromBuffer;
      }
    }

    if (!inputPath || !fs.existsSync(inputPath) || fs.statSync(inputPath).size === 0) {
      return { success: false, error: 'Recording file is missing or empty' };
    }

    const wantsMp4 = convertToMp4 || filePath.toLowerCase().endsWith('.mp4');
    if (wantsMp4) {
      const tempMp4 = path.join(os.tmpdir(), `fdscreen-${Date.now()}.mp4`);
      try {
        await runFfmpeg(inputPath, tempMp4, durationMs);
        sendSaveProgress(100, 'Copying MP4…');
        fs.copyFileSync(tempMp4, filePath);
        fs.unlinkSync(tempMp4);
        const size = fs.statSync(filePath).size;
        if (size === 0) {
          throw new Error('Encoded MP4 was empty');
        }
      } catch (err) {
        console.error('MP4 conversion failed:', err);
        if (fs.existsSync(tempMp4)) {
          try { fs.unlinkSync(tempMp4); } catch (_err) { /* ignore */ }
        }
        if (fs.existsSync(filePath) && fs.statSync(filePath).size === 0) {
          try { fs.unlinkSync(filePath); } catch (_err) { /* ignore */ }
        }
        const fallback = filePath.replace(/\.mp4$/i, '.webm');
        fs.copyFileSync(inputPath, fallback);
        return {
          success: true,
          path: fallback,
          warning: `MP4 conversion failed. Saved WebM instead: ${fallback}`
        };
      }
    } else {
      sendSaveProgress(50, 'Copying WebM…');
      fs.copyFileSync(inputPath, filePath);
      sendSaveProgress(100, 'Done');
    }

    if (tempFromBuffer && fs.existsSync(tempFromBuffer)) {
      fs.unlinkSync(tempFromBuffer);
    }

    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

function sendShortcut(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('shortcut-triggered', action);
  }
}

ipcMain.handle('register-shortcuts', (_event, shortcuts = {}) => {
  globalShortcut.unregisterAll();
  try {
    const map = [
      [shortcuts.startStop, 'start-stop'],
      [shortcuts.pause, 'pause'],
      [shortcuts.stop, 'stop'],
      [shortcuts.cameraToggle, 'camera-toggle']
    ];
    for (const [accel, action] of map) {
      if (accel) {
        globalShortcut.register(accel, () => sendShortcut(action));
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('unregister-shortcuts', () => {
  globalShortcut.unregisterAll();
  return { success: true };
});

function positionFloatingController(win) {
  const { screen } = require('electron');
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  win.setBounds({
    x: screenWidth - 250,
    y: 50,
    width: 200,
    height: 50
  });
}

function createFloatingController() {
  closeFloatingController();

  floatingController = new BrowserWindow({
    width: 200,
    height: 50,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: true,
    hasShadow: false,
    show: false,
    title: 'Screen Recorder Floating Controller',
    webPreferences: {
      preload: path.join(__dirname, 'floating-controller-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  try {
    floatingController.setContentProtection(true);
    floatingController.setAlwaysOnTop(true, 'screen-saver');
  } catch (_err) {
    // Content protection is platform-dependent.
  }

  floatingController.loadFile(path.join(__dirname, 'floating-controller.html'));

  floatingController.once('ready-to-show', () => {
    positionFloatingController(floatingController);
    floatingController.showInactive();
    try {
      floatingController.setContentProtection(true);
      floatingController.setAlwaysOnTop(true, 'screen-saver');
    } catch (_err) {
      // ignore
    }
  });

  floatingController.on('closed', () => {
    floatingController = null;
  });
}

function closeFloatingController() {
  if (floatingController && !floatingController.isDestroyed()) {
    floatingController.destroy();
  }
  floatingController = null;
}

ipcMain.handle('show-floating-controller', async () => {
  if (!floatingController || floatingController.isDestroyed()) {
    createFloatingController();
    await new Promise((resolve) => {
      if (!floatingController) {
        resolve();
        return;
      }
      floatingController.once('ready-to-show', resolve);
      setTimeout(resolve, 1500);
    });
  }
  if (floatingController && !floatingController.isDestroyed()) {
    positionFloatingController(floatingController);
    floatingController.showInactive();
    try {
      floatingController.setContentProtection(true);
      floatingController.setAlwaysOnTop(true, 'screen-saver');
    } catch (_err) {
      // ignore
    }
  }
});

ipcMain.handle('hide-floating-controller', () => {
  if (floatingController && !floatingController.isDestroyed()) {
    floatingController.hide();
  }
});

function notifyFloatingCameraBounds() {
  if (!floatingCamera || floatingCamera.isDestroyed() || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  const { screen } = require('electron');
  const bounds = floatingCamera.getBounds();
  const display = screen.getDisplayMatching(bounds);
  mainWindow.webContents.send('floating-camera-bounds', {
    bounds,
    displayBounds: display.bounds
  });
}

function closeFloatingCamera() {
  if (floatingCamera && !floatingCamera.isDestroyed()) {
    try {
      floatingCamera.webContents.send('floating-camera-config', { stop: true });
    } catch (_err) {
      // ignore
    }
    floatingCamera.destroy();
  }
  floatingCamera = null;
}

function createFloatingCamera(config = {}) {
  closeFloatingCamera();
  floatingCameraShape = config.shape || 'square';
  const size = cameraWindowSize(floatingCameraShape);

  floatingCamera = new BrowserWindow({
    width: size.width,
    height: size.height,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: true,
    hasShadow: false,
    show: false,
    title: 'Camera Overlay',
    webPreferences: {
      preload: path.join(__dirname, 'floating-camera-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false
    }
  });

  try {
    floatingCamera.setContentProtection(true);
    floatingCamera.setAlwaysOnTop(true, 'screen-saver');
    floatingCamera.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch (_err) {
    // ignore
  }

  floatingCamera.loadFile(path.join(__dirname, 'floating-camera.html'));

  floatingCamera.once('ready-to-show', () => {
    positionFloatingCamera(floatingCamera, floatingCameraShape);
    floatingCamera.show();
    try {
      floatingCamera.setContentProtection(true);
      floatingCamera.setAlwaysOnTop(true, 'screen-saver');
      floatingCamera.webContents.setBackgroundThrottling(false);
    } catch (_err) {
      // ignore
    }
    floatingCamera.webContents.send('floating-camera-config', {
      deviceId: config.deviceId || '',
      shape: floatingCameraShape
    });
    notifyFloatingCameraBounds();
  });

  floatingCamera.on('move', notifyFloatingCameraBounds);
  floatingCamera.on('moved', notifyFloatingCameraBounds);
  floatingCamera.on('resize', notifyFloatingCameraBounds);
  floatingCamera.on('resized', notifyFloatingCameraBounds);

  floatingCamera.on('closed', () => {
    floatingCamera = null;
    floatingCameraDragOffset = null;
  });
}

ipcMain.handle('show-floating-camera', async (_event, config = {}) => {
  floatingCameraShape = config.shape || floatingCameraShape || 'square';
  if (!floatingCamera || floatingCamera.isDestroyed()) {
    createFloatingCamera(config);
    await new Promise((resolve) => {
      if (!floatingCamera) {
        resolve();
        return;
      }
      floatingCamera.once('ready-to-show', resolve);
      setTimeout(resolve, 1500);
    });
  } else {
    const size = cameraWindowSize(floatingCameraShape);
    const bounds = floatingCamera.getBounds();
    floatingCamera.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: size.width,
      height: size.height
    });
    floatingCamera.show();
    try {
      floatingCamera.setContentProtection(true);
      floatingCamera.setAlwaysOnTop(true, 'screen-saver');
      floatingCamera.webContents.setBackgroundThrottling(false);
    } catch (_err) {
      // ignore
    }
    floatingCamera.webContents.send('floating-camera-config', {
      deviceId: config.deviceId || '',
      shape: floatingCameraShape
    });
    notifyFloatingCameraBounds();
  }
});

ipcMain.handle('hide-floating-camera', () => {
  if (floatingCamera && !floatingCamera.isDestroyed()) {
    try {
      floatingCamera.webContents.send('floating-camera-config', { stop: true });
    } catch (_err) {
      // ignore
    }
    floatingCamera.hide();
  }
});

ipcMain.handle('set-floating-camera-shape', (_event, shape) => {
  floatingCameraShape = shape || 'square';
  if (floatingCamera && !floatingCamera.isDestroyed()) {
    const size = cameraWindowSize(floatingCameraShape);
    const bounds = floatingCamera.getBounds();
    floatingCamera.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: size.width,
      height: size.height
    });
    notifyFloatingCameraBounds();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('floating-camera-shape-changed', floatingCameraShape);
    }
  }
  return { shape: floatingCameraShape };
});

ipcMain.handle('get-floating-camera-bounds', () => {
  if (!floatingCamera || floatingCamera.isDestroyed()) {
    return null;
  }
  const { screen } = require('electron');
  const bounds = floatingCamera.getBounds();
  const display = screen.getDisplayMatching(bounds);
  return {
    bounds,
    displayBounds: display.bounds
  };
});

ipcMain.on('floating-camera-frame', (_event, dataUrl) => {
  if (floatingCamera && !floatingCamera.isDestroyed() && dataUrl) {
    floatingCamera.webContents.send('floating-camera-frame', dataUrl);
  }
});

ipcMain.handle('set-background-throttling', (_event, enabled) => {
  if (enabled === false) {
    startRecordingKeepAlive();
  } else {
    stopRecordingKeepAlive();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.setBackgroundThrottling(true);
    }
  }
  return { ok: true };
});

ipcMain.handle('minimize-window', () => {
  // Kept for API compatibility; parking off-screen is handled by keep-alive.
  startRecordingKeepAlive();
});

ipcMain.on('floating-camera-drag-start', (_event, point = {}) => {
  if (!floatingCamera || floatingCamera.isDestroyed()) {
    return;
  }
  const bounds = floatingCamera.getBounds();
  const cursorX = typeof point.screenX === 'number' ? point.screenX : bounds.x;
  const cursorY = typeof point.screenY === 'number' ? point.screenY : bounds.y;
  floatingCameraDragOffset = {
    x: cursorX - bounds.x,
    y: cursorY - bounds.y
  };
});

ipcMain.on('floating-camera-drag-move', (_event, point = {}) => {
  if (!floatingCamera || floatingCamera.isDestroyed() || !floatingCameraDragOffset) {
    return;
  }
  if (typeof point.screenX !== 'number' || typeof point.screenY !== 'number') {
    return;
  }
  floatingCamera.setPosition(
    Math.round(point.screenX - floatingCameraDragOffset.x),
    Math.round(point.screenY - floatingCameraDragOffset.y)
  );
  notifyFloatingCameraBounds();
});

ipcMain.on('floating-camera-drag-end', () => {
  floatingCameraDragOffset = null;
  notifyFloatingCameraBounds();
});

ipcMain.on('floating-controller-action', (_event, action) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('floating-controller-action', action);
  }
  if (action === 'stop') {
    if (floatingController && !floatingController.isDestroyed()) {
      floatingController.hide();
    }
    if (floatingCamera && !floatingCamera.isDestroyed()) {
      try {
        floatingCamera.webContents.send('floating-camera-config', { stop: true });
      } catch (_err) {
        // ignore
      }
      floatingCamera.hide();
    }
  }
});

ipcMain.handle('send-recording-state', (_event, state, data) => {
  if (floatingController && !floatingController.isDestroyed()) {
    floatingController.webContents.send('recording-state-change', state, data);
  }
  if (state === 'stopped' && floatingCamera && !floatingCamera.isDestroyed()) {
    try {
      floatingCamera.webContents.send('floating-camera-config', { stop: true });
    } catch (_err) {
      // ignore
    }
    floatingCamera.hide();
  }
});

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['media', 'display-capture', 'audioCapture', 'videoCapture'].includes(permission));
  });
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 1, height: 1 }
    });
    const video = sources.find((source) => source.id === preferredCaptureSourceId) || sources[0];
    callback({
      video,
      audio: captureWantSystemAudio ? 'loopback' : undefined
    });
  });
  createWindow();
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  closeFloatingController();
  closeFloatingCamera();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopRecordingKeepAlive();
  closeFloatingController();
  closeFloatingCamera();
});
