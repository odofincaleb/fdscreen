const CAMERA_PRESETS = {
  '480': { width: 640, height: 480 },
  '720': { width: 1280, height: 720 },
  '1080': { width: 1920, height: 1080 }
};

class ScreenRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.selectedSource = null;
    this.isRecording = false;
    this.isPaused = false;
    this.startTime = null;
    this.pausedTime = 0;
    this.timerInterval = null;
    this.cameraStream = null;
    this.recordingMode = 'screen';
    this.recordingFilePath = null;
    this.composite = null;
    this.previewObjectUrl = null;
    this.liveCameraOverlay = null;
    this.cameraBoundsInterval = null;
    this.cameraSettings = {
      deviceId: '',
      quality: '720',
      frameRate: 30,
      position: 'top-right',
      shape: 'circle'
    };

    this.initializeElements();
    this.bindEvents();
    this.loadSettings();
    this.loadSources();
    this.detectCameraDevices();
    this.makeCameraDraggable();
    this.registerGlobalShortcuts();
  }

  initializeElements() {
    this.sourceGrid = document.getElementById('sourceGrid');
    this.startBtn = document.getElementById('startBtn');
    this.pauseBtn = document.getElementById('pauseBtn');
    this.resumeBtn = document.getElementById('resumeBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.countdownOverlay = document.getElementById('countdownOverlay');
    this.countdownNumber = document.getElementById('countdownNumber');
    this.statusIndicator = document.getElementById('statusIndicator');
    this.statusText = document.getElementById('statusText');
    this.recordingTimer = document.getElementById('recordingTimer');
    this.systemAudio = document.getElementById('systemAudio');
    this.microphoneAudio = document.getElementById('microphoneAudio');
    this.screenMode = document.getElementById('screenMode');
    this.cameraMode = document.getElementById('cameraMode');
    this.bothMode = document.getElementById('bothMode');
    this.cameraPreview = document.getElementById('cameraPreview');
    this.cameraVideo = document.getElementById('cameraVideo');
    this.cameraDevice = document.getElementById('cameraDevice');
    this.cameraQuality = document.getElementById('cameraQuality');
    this.cameraFrameRate = document.getElementById('cameraFrameRate');
    this.cameraPosition = document.getElementById('cameraPosition');
    this.cameraShape = document.getElementById('cameraShape');
    this.previewSection = document.getElementById('previewSection');
    this.seekBar = document.getElementById('seekBar');
    this.currentTimeDisplay = document.getElementById('currentTime');
    this.totalTimeDisplay = document.getElementById('totalTime');
    this.playPauseBtn = document.getElementById('playPauseBtn');
    this.rewindBtn = document.getElementById('rewindBtn');
    this.forwardBtn = document.getElementById('forwardBtn');
    this.previewVideo = document.getElementById('previewVideo');
    this.saveBtn = document.getElementById('saveBtn');
    this.discardBtn = document.getElementById('discardBtn');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.settingsModal = document.getElementById('settingsModal');
    this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
    this.videoQuality = document.getElementById('videoQuality');
    this.frameRate = document.getElementById('frameRate');
    this.outputFormat = document.getElementById('outputFormat');
    this.saveSettingsBtn = document.getElementById('saveSettings');
    this.resetSettingsBtn = document.getElementById('resetSettings');
    this.refreshCamerasBtn = document.getElementById('refreshCameras');
    this.requestCameraPermissionBtn = document.getElementById('requestCameraPermission');
    this.testCameraBtn = document.getElementById('testCameraBtn');
    this.testMicBtn = document.getElementById('testMicBtn');
    this.testSystemAudioBtn = document.getElementById('testSystemAudioBtn');
    this.stopMediaTestsBtn = document.getElementById('stopMediaTestsBtn');
    this.testCameraPreview = document.getElementById('testCameraPreview');
    this.testCameraStatus = document.getElementById('testCameraStatus');
    this.testMicStatus = document.getElementById('testMicStatus');
    this.testSystemStatus = document.getElementById('testSystemStatus');
    this.micMeterFill = document.getElementById('micMeterFill');
    this.systemMeterFill = document.getElementById('systemMeterFill');
    this.toastContainer = document.getElementById('toastContainer');
    this.saveProgressOverlay = document.getElementById('saveProgressOverlay');
    this.saveProgressFill = document.getElementById('saveProgressFill');
    this.saveProgressLabel = document.getElementById('saveProgressLabel');
    this.saveProgressPercent = document.getElementById('saveProgressPercent');
  }

  bindEvents() {
    this.startBtn.addEventListener('click', () => this.startCountdown());
    this.pauseBtn.addEventListener('click', () => this.pauseRecording());
    this.resumeBtn.addEventListener('click', () => this.resumeRecording());
    this.stopBtn.addEventListener('click', () => this.stopRecording());
    this.saveBtn.addEventListener('click', () => this.saveRecording());
    this.discardBtn.addEventListener('click', () => this.discardRecording());
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    this.rewindBtn.addEventListener('click', () => this.rewindVideo());
    this.forwardBtn.addEventListener('click', () => this.forwardVideo());
    this.seekBar.addEventListener('input', () => this.seekVideo());

    this.previewVideo.addEventListener('loadedmetadata', () => this.updateVideoControls());
    this.previewVideo.addEventListener('timeupdate', () => this.updateSeekBar());
    this.previewVideo.addEventListener('ended', () => {
      this.playPauseBtn.textContent = '▶️';
    });

    this.settingsBtn.addEventListener('click', () => this.settingsModal.classList.add('show'));
    this.closeSettingsBtn.addEventListener('click', () => {
      this.stopMediaTests();
      this.settingsModal.classList.remove('show');
    });
    this.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) {
        this.stopMediaTests();
        this.settingsModal.classList.remove('show');
      }
    });

    [this.screenMode, this.cameraMode, this.bothMode].forEach((el) => {
      el?.addEventListener('change', () => this.updateRecordingMode());
    });

    this.cameraDevice?.addEventListener('change', () => this.updateCameraSettings());
    this.cameraQuality?.addEventListener('change', () => this.updateCameraSettings());
    this.cameraFrameRate?.addEventListener('change', () => this.updateCameraSettings());
    this.cameraPosition?.addEventListener('change', () => this.updateCameraSettings());
    this.cameraShape?.addEventListener('change', () => this.updateCameraSettings());
    this.refreshCamerasBtn?.addEventListener('click', () => this.detectCameraDevices());
    this.requestCameraPermissionBtn?.addEventListener('click', () => this.requestCameraPermission());
    this.testCameraBtn?.addEventListener('click', () => this.testCamera());
    this.testMicBtn?.addEventListener('click', () => this.testMicrophone());
    this.testSystemAudioBtn?.addEventListener('click', () => this.testSystemAudio());
    this.stopMediaTestsBtn?.addEventListener('click', () => this.stopMediaTests());

    this.videoQuality.addEventListener('change', () => this.persistSettings());
    this.frameRate.addEventListener('change', () => this.persistSettings());
    this.outputFormat.addEventListener('change', () => this.persistSettings());
    this.saveSettingsBtn?.addEventListener('click', () => {
      this.persistSettings();
      this.showToast('Settings saved', 'success');
    });
    this.resetSettingsBtn?.addEventListener('click', () => this.resetSettings());

    this.bindKeyboardShortcuts();

    if (window.electronAPI?.onShortcutTriggered) {
      window.electronAPI.onShortcutTriggered((action) => this.handleShortcut(action));
    }
    if (window.electronAPI?.onFloatingControllerAction) {
      window.electronAPI.onFloatingControllerAction((action) => this.handleFloatingControllerAction(action));
    }
    if (window.electronAPI?.onSaveProgress) {
      window.electronAPI.onSaveProgress((data) => this.updateSaveProgress(data));
    }
    if (window.electronAPI?.onFloatingCameraShapeChanged) {
      window.electronAPI.onFloatingCameraShapeChanged((shape) => {
        this.cameraSettings.shape = shape || 'square';
        if (this.cameraShape) {
          this.cameraShape.value = this.cameraSettings.shape;
        }
        this.updateCameraShape();
        this.persistSettings();
      });
    }
    if (window.electronAPI?.onFloatingCameraBounds) {
      window.electronAPI.onFloatingCameraBounds((data) => {
        this.liveCameraOverlay = data;
      });
    }
  }

  startCameraBoundsSync() {
    this.stopCameraBoundsSync();
    this.cameraBoundsInterval = setInterval(async () => {
      if (!window.electronAPI?.getFloatingCameraBounds) {
        return;
      }
      try {
        const data = await window.electronAPI.getFloatingCameraBounds();
        if (data?.bounds && data?.displayBounds) {
          this.liveCameraOverlay = data;
        }
      } catch (_err) {
        // ignore
      }
    }, 50);
  }

  stopCameraBoundsSync() {
    if (this.cameraBoundsInterval) {
      clearInterval(this.cameraBoundsInterval);
      this.cameraBoundsInterval = null;
    }
  }

  startFloatingPreviewPipe(sourceVideo) {
    this.stopFloatingPreviewPipe();
    const previewCanvas = document.createElement('canvas');
    const previewCtx = previewCanvas.getContext('2d', { alpha: false });
    this.floatingPreviewTimer = setInterval(() => {
      const video = sourceVideo || this.composite?.cameraVideo || this.cameraVideo;
      if (!video || !video.videoWidth) {
        return;
      }
      const w = 320;
      const h = Math.round((video.videoHeight / video.videoWidth) * w) || 240;
      previewCanvas.width = w;
      previewCanvas.height = h;
      previewCtx.drawImage(video, 0, 0, w, h);
      window.electronAPI?.sendFloatingCameraFrame?.(previewCanvas.toDataURL('image/jpeg', 0.72));
    }, 100);
  }

  stopFloatingPreviewPipe() {
    if (this.floatingPreviewTimer) {
      clearInterval(this.floatingPreviewTimer);
      this.floatingPreviewTimer = null;
    }
  }

  registerGlobalShortcuts() {
    window.electronAPI?.registerShortcuts?.({
      startStop: 'CommandOrControl+Shift+R',
      pause: 'CommandOrControl+Shift+P',
      stop: 'CommandOrControl+Shift+S',
      cameraToggle: 'CommandOrControl+Shift+C'
    });
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }
      if (!e.ctrlKey && !e.metaKey) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'r' && !e.shiftKey) {
        e.preventDefault();
        this.handleShortcut('start-stop');
      } else if (key === 'p' || e.code === 'Space') {
        e.preventDefault();
        this.handleShortcut('pause');
      } else if (key === 's' && !e.shiftKey) {
        e.preventDefault();
        this.handleShortcut('stop');
      }
    });
  }

  handleShortcut(action) {
    if (action === 'start-stop') {
      if (!this.isRecording && !this.isPaused) {
        this.startCountdown();
      } else {
        this.stopRecording();
      }
      return;
    }
    if (action === 'pause') {
      if (this.isRecording && !this.isPaused) {
        this.pauseRecording();
      } else if (this.isPaused) {
        this.resumeRecording();
      }
      return;
    }
    if (action === 'stop') {
      this.stopRecording();
      return;
    }
    if (action === 'camera-toggle') {
      if (this.cameraPreview?.style.display === 'block') {
        this.closeCamera();
      } else {
        this.initializeCamera();
      }
    }
  }

  handleFloatingControllerAction(action) {
    if (action === 'pause-resume' || action === 'pause' || action === 'resume') {
      this.handleShortcut('pause');
    } else if (action === 'stop') {
      this.stopRecording();
    }
  }

  async loadSources() {
    try {
      if (!window.electronAPI?.getSources) {
        throw new Error('Screen capture API is not available');
      }
      const sources = await window.electronAPI.getSources();
      this.displaySources(sources || []);
    } catch (error) {
      this.showToast('Failed to load screen sources: ' + error.message, 'error');
      this.displaySources([]);
    }
  }

  displaySources(sources) {
    if (!this.sourceGrid) {
      return;
    }
    this.sourceGrid.innerHTML = '';

    if (!sources.length) {
      const empty = document.createElement('div');
      empty.className = 'source-item';
      empty.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <p>No recording sources available</p>
          <p style="font-size: 0.8rem; color: #666;">Check screen capture permissions, then reopen the app.</p>
        </div>
      `;
      this.sourceGrid.appendChild(empty);
      return;
    }

    sources.forEach((source) => {
      const sourceItem = document.createElement('div');
      sourceItem.className = 'source-item';
      sourceItem.dataset.sourceId = source.id;

      const img = document.createElement('img');
      img.alt = source.name;
      if (source.thumbnail) {
        img.src = source.thumbnail;
      }

      const label = document.createElement('p');
      label.textContent = source.name;

      sourceItem.append(img, label);
      sourceItem.addEventListener('click', () => this.selectSource(source, sourceItem));
      this.sourceGrid.appendChild(sourceItem);
    });
  }

  selectSource(source, element) {
    document.querySelectorAll('.source-item').forEach((item) => item.classList.remove('selected'));
    element.classList.add('selected');
    this.selectedSource = source;
    if (!this.isRecording) {
      this.startBtn.disabled = false;
    }
    this.showToast(`Selected: ${source.name}`, 'success');
  }

  startCountdown() {
    if (this.recordingMode !== 'camera' && !this.selectedSource) {
      this.showToast('Please select a recording source first', 'warning');
      return;
    }
    if (this.recordingMode !== 'screen' && !this.cameraDevice?.value && !this.cameraSettings.deviceId) {
      this.showToast('Select a camera in Settings first', 'warning');
      return;
    }

    this.countdownOverlay.classList.add('active');
    let count = 3;
    this.countdownNumber.textContent = String(count);

    const countdownInterval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        this.countdownNumber.textContent = String(count);
      } else {
        clearInterval(countdownInterval);
        this.countdownOverlay.classList.remove('active');
        this.startRecording();
      }
    }, 1000);
  }

  getDesktopConstraints(includeSystemAudio) {
    const height = parseInt(this.videoQuality.value, 10) || 1080;
    const fps = parseInt(this.frameRate.value, 10) || 30;
    const sourceId = this.selectedSource.id;
    return {
      audio: includeSystemAudio
        ? {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId
            }
          }
        : false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          minWidth: 1280,
          maxWidth: Math.round(height * 16 / 9),
          minHeight: 720,
          maxHeight: height,
          minFrameRate: fps,
          maxFrameRate: fps
        }
      }
    };
  }

  async getLoopbackAudioStream() {
    const sources = await window.electronAPI.getSources();
    const screenSource = (sources || []).find((source) => String(source.id).startsWith('screen:'))
      || this.selectedSource;
    if (!screenSource) {
      throw new Error('No screen source for system audio');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: screenSource.id
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: screenSource.id,
          maxWidth: 16,
          maxHeight: 16,
          maxFrameRate: 1
        }
      }
    });
    stream.getVideoTracks().forEach((track) => track.stop());
    return stream;
  }

  async mixAudioTracks(streams) {
    const liveTracks = [];
    streams.filter(Boolean).forEach((stream) => {
      stream.getAudioTracks().forEach((track) => {
        if (track.readyState === 'live') {
          track.enabled = true;
          liveTracks.push(track);
        }
      });
    });
    if (!liveTracks.length) {
      return [];
    }
    if (liveTracks.length === 1) {
      return [liveTracks[0]];
    }

    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const dest = ctx.createMediaStreamDestination();
    liveTracks.forEach((track) => {
      const source = ctx.createMediaStreamSource(new MediaStream([track]));
      source.connect(dest);
    });
    this.audioContext = ctx;
    if (!this.keepAliveAudio) {
      this.keepAliveAudio = new Audio();
      this.keepAliveAudio.muted = true;
    }
    this.keepAliveAudio.srcObject = dest.stream;
    await this.keepAliveAudio.play().catch(() => {});
    return dest.stream.getAudioTracks();
  }

  async captureDesktopStream(wantSystemAudio) {
    if (window.electronAPI?.setCaptureSource) {
      await window.electronAPI.setCaptureSource({
        id: this.selectedSource.id,
        systemAudio: wantSystemAudio
      });
    }
    if (navigator.mediaDevices.getDisplayMedia) {
      try {
        const height = parseInt(this.videoQuality.value, 10) || 1080;
        const fps = parseInt(this.frameRate.value, 10) || 30;
        return await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: Math.round(height * 16 / 9) },
            height: { ideal: height },
            frameRate: { ideal: fps }
          },
          audio: wantSystemAudio
        });
      } catch (err) {
        console.warn('getDisplayMedia failed, falling back to getUserMedia', err);
      }
    }
    const isWindowSource = String(this.selectedSource.id).startsWith('window:');
    return navigator.mediaDevices.getUserMedia(
      this.getDesktopConstraints(wantSystemAudio && !isWindowSource)
    );
  }

  async getMicrophoneStream() {
    if (!this.microphoneAudio.checked) {
      return null;
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (_err) {
      this.showToast('Microphone access denied', 'warning');
      return null;
    }
  }

  async startHiddenVideo(stream) {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    // Keep decode path hot even when the main window is parked off-screen.
    video.style.cssText = 'position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;';
    document.body.appendChild(video);
    video.srcObject = stream;
    await video.play();
    if (!video.videoWidth) {
      await new Promise((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
    }
    return video;
  }

  pipRect(canvasWidth, canvasHeight, videoWidth, videoHeight) {
    const isCircle = this.cameraSettings.shape === 'circle';
    const live = this.liveCameraOverlay;
    if (live?.bounds && live?.displayBounds && live.displayBounds.width > 0 && live.displayBounds.height > 0) {
      const { bounds, displayBounds } = live;
      const scaleX = canvasWidth / displayBounds.width;
      const scaleY = canvasHeight / displayBounds.height;
      let w = Math.round(bounds.width * scaleX);
      let h = Math.round(bounds.height * scaleY);
      if (isCircle) {
        const side = Math.max(24, Math.round((w + h) / 2));
        w = side;
        h = side;
      }
      let x = Math.round((bounds.x - displayBounds.x) * scaleX);
      let y = Math.round((bounds.y - displayBounds.y) * scaleY);
      x = Math.max(0, Math.min(canvasWidth - w, x));
      y = Math.max(0, Math.min(canvasHeight - h, y));
      return { x, y, w: Math.max(24, w), h: Math.max(24, h) };
    }

    const pipW = Math.round(canvasWidth * 0.22);
    const pipH = isCircle ? pipW : Math.round(pipW * (videoHeight / Math.max(videoWidth, 1)));
    const margin = Math.round(canvasWidth * 0.03);
    const pos = this.cameraSettings.position;
    let x = canvasWidth - pipW - margin;
    let y = margin;
    if (pos === 'top-left') {
      x = margin;
    } else if (pos === 'bottom-right') {
      y = canvasHeight - pipH - margin;
    } else if (pos === 'bottom-left') {
      x = margin;
      y = canvasHeight - pipH - margin;
    } else if (pos === 'center') {
      x = Math.round((canvasWidth - pipW) / 2);
      y = Math.round((canvasHeight - pipH) / 2);
    }
    return { x, y, w: pipW, h: pipH };
  }

  async createCompositeStream(screenStream, cameraStream) {
    const screenVideo = await this.startHiddenVideo(screenStream);
    const cameraVideo = await this.startHiddenVideo(cameraStream);
    const canvas = document.createElement('canvas');
    canvas.width = screenVideo.videoWidth || 1920;
    canvas.height = screenVideo.videoHeight || 1080;
    canvas.style.cssText = 'position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    const fps = parseInt(this.frameRate.value, 10) || 30;
    const canvasStream = canvas.captureStream(fps);
    const captureTrack = canvasStream.getVideoTracks()[0];

    const draw = () => {
      if (!this.composite?.active) {
        return;
      }
      if (screenVideo.readyState >= 2) {
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
      }
      if (cameraVideo.readyState >= 2 && cameraVideo.videoWidth > 0) {
        const pip = this.pipRect(canvas.width, canvas.height, cameraVideo.videoWidth, cameraVideo.videoHeight);
        ctx.save();
        if (this.cameraSettings.shape === 'circle') {
          const r = Math.min(pip.w, pip.h) / 2;
          ctx.beginPath();
          ctx.arc(pip.x + pip.w / 2, pip.y + pip.h / 2, r, 0, Math.PI * 2);
          ctx.clip();
        } else if (this.cameraSettings.shape === 'rounded') {
          const r = Math.min(24, pip.w / 6);
          ctx.beginPath();
          ctx.moveTo(pip.x + r, pip.y);
          ctx.arcTo(pip.x + pip.w, pip.y, pip.x + pip.w, pip.y + pip.h, r);
          ctx.arcTo(pip.x + pip.w, pip.y + pip.h, pip.x, pip.y + pip.h, r);
          ctx.arcTo(pip.x, pip.y + pip.h, pip.x, pip.y, r);
          ctx.arcTo(pip.x, pip.y, pip.x + pip.w, pip.y, r);
          ctx.closePath();
          ctx.clip();
        }
        ctx.drawImage(cameraVideo, pip.x, pip.y, pip.w, pip.h);
        ctx.restore();
      }
      if (captureTrack && typeof captureTrack.requestFrame === 'function') {
        try {
          captureTrack.requestFrame();
        } catch (_err) {
          // ignore
        }
      }
    };

    this.composite = {
      active: true,
      timer: null,
      canvas,
      screenVideo,
      cameraVideo,
      screenStream,
      cameraStream,
      captureTrack
    };

    // setInterval survives occlusion better than rAF alone.
    this.composite.timer = setInterval(draw, Math.max(16, Math.round(1000 / fps)));
    draw();
    this.startFloatingPreviewPipe(cameraVideo);

    return new MediaStream(canvasStream.getVideoTracks());
  }

  stopComposite() {
    if (!this.composite) {
      return;
    }
    this.composite.active = false;
    if (this.composite.timer) {
      clearInterval(this.composite.timer);
    }
    if (this.composite.raf) {
      cancelAnimationFrame(this.composite.raf);
    }
    this.stopFloatingPreviewPipe();
    this.composite.screenStream?.getVideoTracks().forEach((track) => track.stop());
    if (this.composite.screenVideo?.parentNode) {
      this.composite.screenVideo.srcObject = null;
      this.composite.screenVideo.remove();
    }
    if (this.composite.cameraVideo?.parentNode) {
      this.composite.cameraVideo.srcObject = null;
      this.composite.cameraVideo.remove();
    }
    if (this.composite.canvas?.parentNode) {
      this.composite.canvas.remove();
    }
    this.composite = null;
  }

  async startRecording() {
    if (this.recordingMode !== 'camera' && !this.selectedSource) {
      this.showToast('Please select a recording source first', 'warning');
      return;
    }

    try {
      let screenStream = null;
      let cameraStream = null;

      const wantSystemAudio = this.systemAudio.checked && this.recordingMode !== 'camera';
      const isWindowSource = !!(this.selectedSource && String(this.selectedSource.id).startsWith('window:'));

      if (this.recordingMode === 'screen' || this.recordingMode === 'both') {
        screenStream = await this.captureDesktopStream(wantSystemAudio);
      }

      if (this.recordingMode === 'camera' || this.recordingMode === 'both') {
        await this.initializeCamera();
        cameraStream = this.cameraStream;
        if (!cameraStream) {
          throw new Error('Camera is not available');
        }
      }

      let loopbackStream = null;
      if (wantSystemAudio && (isWindowSource || !screenStream?.getAudioTracks().length)) {
        try {
          loopbackStream = await this.getLoopbackAudioStream();
        } catch (_err) {
          this.showToast('System audio could not be captured from this source', 'warning');
        }
      }

      const micStream = await this.getMicrophoneStream();
      let finalStream;

      if (this.recordingMode === 'both') {
        finalStream = await this.createCompositeStream(screenStream, cameraStream);
      } else if (this.recordingMode === 'camera') {
        finalStream = new MediaStream(cameraStream.getVideoTracks().map((track) => track.clone()));
      } else {
        finalStream = new MediaStream(screenStream.getVideoTracks());
      }

      const audioTracks = await this.mixAudioTracks([screenStream, loopbackStream, micStream]);
      audioTracks.forEach((track) => finalStream.addTrack(track));
      this.loopbackStream = loopbackStream;
      this.micStream = micStream;

      if (!finalStream.getVideoTracks().length) {
        throw new Error('No video track available for recording');
      }
      if (!finalStream.getAudioTracks().length && (wantSystemAudio || this.microphoneAudio.checked)) {
        this.showToast('No audio track was available. Video will be silent.', 'warning');
      }

      await window.electronAPI.beginRecordingFile('webm');
      this.setupMediaRecorder(finalStream);

      this.isRecording = true;
      this.startTime = Date.now();
      this.pausedTime = 0;
      this.updateUI('recording');
      this.startTimer();

      await window.electronAPI.setBackgroundThrottling?.(false);
      await window.electronAPI.showFloatingController();
      if (this.recordingMode === 'camera' || this.recordingMode === 'both') {
        // Keep the compositing camera video alive; only hide the in-app chrome.
        if (this.cameraPreview) {
          this.cameraPreview.style.opacity = '0';
          this.cameraPreview.style.pointerEvents = 'none';
          this.cameraPreview.style.position = 'fixed';
          this.cameraPreview.style.left = '-9999px';
          this.cameraPreview.style.display = 'block';
        }
        await window.electronAPI.showFloatingCamera({
          deviceId: this.cameraSettings.deviceId || this.cameraDevice?.value || '',
          shape: this.cameraSettings.shape || 'square'
        });
        if (this.recordingMode === 'camera') {
          this.startFloatingPreviewPipe(this.cameraVideo);
        }
        if (this.recordingMode === 'both') {
          const initial = await window.electronAPI.getFloatingCameraBounds?.();
          if (initial) {
            this.liveCameraOverlay = initial;
          }
          this.startCameraBoundsSync();
        }
      }
      window.electronAPI.sendRecordingState('started', {
        startTime: this.startTime,
        pausedTime: this.pausedTime
      });
      window.electronAPI.minimizeWindow();
      this.showToast('Recording started', 'success');
    } catch (error) {
      this.stopComposite();
      this.isRecording = false;
      this.updateUI('ready');
      let message = 'Failed to start recording';
      if (error.name === 'NotAllowedError') {
        message = 'Screen recording permission denied.';
      } else if (error.name === 'NotFoundError') {
        message = 'No recording source found.';
      } else if (error.message) {
        message = error.message;
      }
      this.showToast(message, 'error');
    }
  }

  pickMimeType() {
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  setupMediaRecorder(stream) {
    const mimeType = this.pickMimeType();
    const options = mimeType
      ? { mimeType, videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 }
      : { videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 };

    this.mediaRecorder = new MediaRecorder(stream, options);
    this.recordedChunks = [];
    this.chunkWrites = [];

    this.mediaRecorder.addEventListener('error', (event) => {
      this.showToast('Recording error: ' + (event.error?.message || 'unknown'), 'error');
    });

    this.mediaRecorder.addEventListener('dataavailable', (event) => {
      if (!event.data || event.data.size === 0) {
        return;
      }
      this.recordedChunks.push(event.data);
      const write = event.data.arrayBuffer()
        .then((arrayBuffer) => window.electronAPI.appendRecordingChunk(new Uint8Array(arrayBuffer)))
        .catch((err) => console.error('Failed to write recording chunk', err));
      this.chunkWrites.push(write);
    });

    this.mediaRecorder.addEventListener('stop', async () => {
      await Promise.all(this.chunkWrites);
      await this.handleRecordingStop();
    });

    this.mediaRecorder.start(1000);
  }

  pauseRecording() {
    if (!this.mediaRecorder || !this.isRecording || this.isPaused) {
      return;
    }
    this.mediaRecorder.pause();
    this.isPaused = true;
    this.pausedTime += Date.now() - this.startTime;
    this.stopTimer();
    this.updateUI('paused');
    window.electronAPI?.sendRecordingState('paused', {
      startTime: this.startTime,
      pausedTime: this.pausedTime
    });
    this.showToast('Recording paused', 'warning');
  }

  resumeRecording() {
    if (!this.mediaRecorder || !this.isPaused) {
      return;
    }
    this.mediaRecorder.resume();
    this.isPaused = false;
    this.startTime = Date.now();
    this.startTimer();
    this.updateUI('recording');
    window.electronAPI?.sendRecordingState('resumed', {
      startTime: this.startTime,
      pausedTime: this.pausedTime
    });
    this.showToast('Recording resumed', 'success');
  }

  stopRecording() {
    if (!this.mediaRecorder || (!this.isRecording && !this.isPaused)) {
      return;
    }
    // Wall-clock length of this take (used for encode progress, not as a hard cut).
    this.recordingDurationMs = this.isPaused
      ? this.pausedTime
      : (Date.now() - this.startTime + this.pausedTime);
    this.mediaRecorder.stop();
    this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    this.stopComposite();
    this.loopbackStream?.getTracks().forEach((track) => track.stop());
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.loopbackStream = null;
    this.micStream = null;
    if (this.keepAliveAudio) {
      this.keepAliveAudio.pause();
      this.keepAliveAudio.srcObject = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.isRecording = false;
    this.isPaused = false;
    this.stopTimer();
    this.stopCameraBoundsSync();
    this.stopFloatingPreviewPipe();
    this.liveCameraOverlay = null;
    window.electronAPI?.setBackgroundThrottling?.(true);
    window.electronAPI?.sendRecordingState('stopped');
    window.electronAPI?.hideFloatingController();
    window.electronAPI?.hideFloatingCamera();
    if ((this.recordingMode === 'camera' || this.recordingMode === 'both') && this.cameraStream && this.cameraPreview) {
      this.cameraPreview.style.opacity = '1';
      this.cameraPreview.style.pointerEvents = 'auto';
      this.cameraPreview.style.left = '';
      this.cameraPreview.style.display = 'block';
      this.updateCameraPosition();
      this.updateCameraShape();
    }
    this.updateUI('stopped');
    this.showToast('Recording stopped', 'success');
  }

  async handleRecordingStop() {
    const result = await window.electronAPI.finishRecordingFile();
    this.recordingFilePath = result?.path || null;

    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
    }
    this.previewObjectUrl = URL.createObjectURL(blob);
    this.previewVideo.src = this.previewObjectUrl;
    this.previewSection.style.display = 'block';
    this.previewSection.scrollIntoView({ behavior: 'smooth' });
  }

  async saveRecording() {
    try {
      const wantsMp4 = this.outputFormat.value === 'mp4';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screen-recording-${timestamp}.${wantsMp4 ? 'mp4' : 'webm'}`;
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      if (!blob.size) {
        this.showToast('Nothing to save. The recording file is empty.', 'error');
        return;
      }
      // Prefer wall-clock recording length. HTML5 duration on MediaRecorder WebM
      // is often wrong (tiny values) and must never drive a hard -t cut.
      const previewMs = Number.isFinite(this.previewVideo.duration) && this.previewVideo.duration > 1
        ? this.previewVideo.duration * 1000
        : 0;
      const durationMs = Math.max(this.recordingDurationMs || 0, previewMs);
      this.showSaveProgress('Preparing file…', 1);
      const arrayBuffer = await blob.arrayBuffer();
      const result = await window.electronAPI.saveRecording({
        filename,
        sourcePath: this.recordingFilePath,
        convertToMp4: wantsMp4,
        buffer: new Uint8Array(arrayBuffer),
        durationMs
      });

      this.hideSaveProgress();
      if (result.cancelled) {
        return;
      }
      if (result.success) {
        if (result.warning) {
          this.showToast(result.warning, 'warning');
        }
        this.showToast(`Saved: ${result.path}`, 'success');
        if (this.recordingFilePath) {
          await window.electronAPI.deleteRecordingFile(this.recordingFilePath);
          this.recordingFilePath = null;
        }
        this.updateUI('ready');
      } else {
        this.showToast(result.error || 'Failed to save recording', 'error');
      }
    } catch (error) {
      this.hideSaveProgress();
      this.showToast('Failed to save recording', 'error');
    }
  }

  showSaveProgress(label, percent) {
    if (!this.saveProgressOverlay) return;
    this.saveProgressOverlay.classList.add('active');
    this.updateSaveProgress({ label, percent });
  }

  updateSaveProgress(data = {}) {
    if (!this.saveProgressOverlay) return;
    this.saveProgressOverlay.classList.add('active');
    if (this.saveProgressLabel && data.label) {
      this.saveProgressLabel.textContent = data.label;
    }
    const percent = Number.isFinite(data.percent) ? data.percent : 0;
    if (this.saveProgressFill) {
      this.saveProgressFill.style.width = `${percent}%`;
    }
    if (this.saveProgressPercent) {
      this.saveProgressPercent.textContent = `${percent}%`;
    }
  }

  hideSaveProgress() {
    this.saveProgressOverlay?.classList.remove('active');
    if (this.saveProgressFill) this.saveProgressFill.style.width = '0%';
  }

  async discardRecording() {
    this.recordedChunks = [];
    this.previewVideo.src = '';
    this.previewSection.style.display = 'none';
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
    if (this.recordingFilePath) {
      await window.electronAPI.deleteRecordingFile(this.recordingFilePath);
      this.recordingFilePath = null;
    }
    this.updateUI('ready');
    this.showToast('Recording discarded', 'warning');
  }

  updateUI(state) {
    const statusDot = this.statusIndicator.querySelector('.status-dot');
    if (state === 'recording') {
      this.statusText.textContent = 'Recording...';
      statusDot.className = 'status-dot recording';
      this.startBtn.disabled = true;
      this.pauseBtn.disabled = false;
      this.pauseBtn.style.display = 'inline-flex';
      this.resumeBtn.disabled = true;
      this.resumeBtn.style.display = 'none';
      this.stopBtn.disabled = false;
    } else if (state === 'paused') {
      this.statusText.textContent = 'Paused';
      statusDot.className = 'status-dot paused';
      this.pauseBtn.disabled = true;
      this.pauseBtn.style.display = 'none';
      this.resumeBtn.disabled = false;
      this.resumeBtn.style.display = 'inline-flex';
      this.stopBtn.disabled = false;
    } else if (state === 'stopped') {
      this.statusText.textContent = 'Recording Complete';
      statusDot.className = 'status-dot';
      this.startBtn.disabled = this.recordingMode === 'camera' ? false : !this.selectedSource;
      this.pauseBtn.disabled = true;
      this.pauseBtn.style.display = 'inline-flex';
      this.resumeBtn.disabled = true;
      this.resumeBtn.style.display = 'none';
      this.stopBtn.disabled = true;
    } else {
      this.statusText.textContent = 'Ready to Record';
      statusDot.className = 'status-dot';
      this.startBtn.disabled = this.recordingMode === 'camera' ? false : !this.selectedSource;
      this.pauseBtn.disabled = true;
      this.pauseBtn.style.display = 'inline-flex';
      this.resumeBtn.disabled = true;
      this.resumeBtn.style.display = 'none';
      this.stopBtn.disabled = true;
      this.recordingTimer.textContent = '00:00';
    }
  }

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.startTime + this.pausedTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      this.recordingTimer.textContent =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  persistSettings() {
    const settings = {
      videoQuality: this.videoQuality.value,
      frameRate: this.frameRate.value,
      outputFormat: this.outputFormat.value,
      cameraSettings: this.cameraSettings
    };
    localStorage.setItem('screenRecorderSettings', JSON.stringify(settings));
  }

  loadSettings() {
    const settings = JSON.parse(localStorage.getItem('screenRecorderSettings') || '{}');
    if (settings.videoQuality) this.videoQuality.value = settings.videoQuality;
    if (settings.frameRate) this.frameRate.value = settings.frameRate;
    if (settings.outputFormat) this.outputFormat.value = settings.outputFormat;
    if (settings.cameraSettings) {
      this.cameraSettings = { ...this.cameraSettings, ...settings.cameraSettings };
      if (this.cameraSettings.quality === '720p') this.cameraSettings.quality = '720';
      if (this.cameraSettings.quality === '1080p') this.cameraSettings.quality = '1080';
      if (this.cameraDevice && this.cameraSettings.deviceId) this.cameraDevice.value = this.cameraSettings.deviceId;
      if (this.cameraQuality) this.cameraQuality.value = this.cameraSettings.quality;
      if (this.cameraFrameRate) this.cameraFrameRate.value = String(this.cameraSettings.frameRate);
      if (this.cameraPosition) this.cameraPosition.value = this.cameraSettings.position;
      if (this.cameraShape) this.cameraShape.value = this.cameraSettings.shape;
    }
  }

  resetSettings() {
    this.videoQuality.value = '1080';
    this.frameRate.value = '30';
    this.outputFormat.value = 'mp4';
    this.cameraSettings = {
      deviceId: this.cameraDevice?.value || '',
      quality: '720',
      frameRate: 30,
      position: 'top-right',
      shape: 'circle'
    };
    if (this.cameraQuality) this.cameraQuality.value = '720';
    if (this.cameraFrameRate) this.cameraFrameRate.value = '30';
    if (this.cameraPosition) this.cameraPosition.value = 'top-right';
    if (this.cameraShape) this.cameraShape.value = 'circle';
    localStorage.removeItem('screenRecorderSettings');
    this.persistSettings();
    this.showToast('Settings reset to defaults', 'success');
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'check-circle'
      : type === 'error' ? 'exclamation-circle'
        : type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    const iconEl = document.createElement('i');
    iconEl.className = `fas fa-${icon}`;
    const span = document.createElement('span');
    span.textContent = message;
    toast.append(iconEl, span);
    this.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  togglePlayPause() {
    if (this.previewVideo.paused) {
      this.previewVideo.play().then(() => {
        this.playPauseBtn.textContent = '⏸️';
      }).catch(() => {});
    } else {
      this.previewVideo.pause();
      this.playPauseBtn.textContent = '▶️';
    }
  }

  rewindVideo() {
    this.previewVideo.currentTime = Math.max(0, this.previewVideo.currentTime - 10);
  }

  forwardVideo() {
    this.previewVideo.currentTime = Math.min(this.previewVideo.duration || 0, this.previewVideo.currentTime + 10);
  }

  seekVideo() {
    if (!this.previewVideo.duration || Number.isNaN(this.previewVideo.duration)) {
      return;
    }
    this.previewVideo.currentTime = (this.seekBar.value / 100) * this.previewVideo.duration;
  }

  updateSeekBar() {
    if (!this.previewVideo.duration) {
      return;
    }
    this.seekBar.value = (this.previewVideo.currentTime / this.previewVideo.duration) * 100;
    this.currentTimeDisplay.textContent = this.formatTime(this.previewVideo.currentTime);
    this.totalTimeDisplay.textContent = this.formatTime(this.previewVideo.duration);
  }

  updateVideoControls() {
    this.seekBar.max = 100;
    this.seekBar.value = 0;
    this.totalTimeDisplay.textContent = this.formatTime(this.previewVideo.duration || 0);
    this.currentTimeDisplay.textContent = this.formatTime(0);
    this.playPauseBtn.textContent = '▶️';
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  async updateRecordingMode() {
    const selected = document.querySelector('input[name="recordingMode"]:checked');
    this.recordingMode = selected ? selected.value : 'screen';
    if (this.recordingMode === 'camera' || this.recordingMode === 'both') {
      await this.initializeCamera();
      this.startBtn.disabled = false;
    } else {
      this.closeCamera();
      this.startBtn.disabled = !this.selectedSource;
    }
  }

  async initializeCamera() {
    const selectedDeviceId = this.cameraDevice?.value || this.cameraSettings.deviceId;
    if (!selectedDeviceId) {
      this.showToast('Please select a camera device first', 'error');
      return;
    }

    const preset = CAMERA_PRESETS[this.cameraSettings.quality] || CAMERA_PRESETS['720'];
    const constraints = {
      video: {
        deviceId: { exact: selectedDeviceId },
        width: { ideal: preset.width },
        height: { ideal: preset.height },
        frameRate: { ideal: this.cameraSettings.frameRate }
      },
      audio: false
    };

    try {
      if (this.cameraStream) {
        this.cameraStream.getTracks().forEach((track) => track.stop());
      }
      this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.cameraVideo) {
        this.cameraVideo.srcObject = this.cameraStream;
        await this.cameraVideo.play().catch(() => {});
      }
      if (this.cameraPreview) {
        this.cameraPreview.style.display = 'block';
        this.updateCameraPosition();
        this.updateCameraShape();
      }
    } catch (error) {
      this.cameraStream = null;
      this.showToast('Camera access denied or not available', 'error');
    }
  }

  closeCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }
    if (this.cameraPreview) {
      this.cameraPreview.style.display = 'none';
    }
    window.electronAPI?.hideFloatingCamera?.();
  }

  updateCameraSettings() {
    this.cameraSettings.deviceId = this.cameraDevice?.value || '';
    this.cameraSettings.quality = this.cameraQuality?.value || '720';
    this.cameraSettings.frameRate = parseInt(this.cameraFrameRate?.value || '30', 10);
    this.cameraSettings.position = this.cameraPosition?.value || 'top-right';
    this.cameraSettings.shape = this.cameraShape?.value || 'square';
    this.updateCameraPosition();
    this.updateCameraShape();
    this.persistSettings();
    if (this.isRecording && (this.recordingMode === 'camera' || this.recordingMode === 'both')) {
      window.electronAPI?.showFloatingCamera?.({
        deviceId: this.cameraSettings.deviceId,
        shape: this.cameraSettings.shape
      });
    }
  }

  updateCameraPosition() {
    if (!this.cameraPreview) return;
    const positions = {
      'top-right': { top: '100px', right: '20px', left: 'auto', bottom: 'auto', transform: 'none' },
      'top-left': { top: '100px', left: '20px', right: 'auto', bottom: 'auto', transform: 'none' },
      'bottom-right': { bottom: '20px', right: '20px', left: 'auto', top: 'auto', transform: 'none' },
      'bottom-left': { bottom: '20px', left: '20px', right: 'auto', top: 'auto', transform: 'none' },
      center: { top: '50%', left: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)' }
    };
    Object.assign(this.cameraPreview.style, positions[this.cameraSettings.position] || positions['top-right']);
  }

  updateCameraShape() {
    if (!this.cameraPreview || !this.cameraVideo) return;
    const shape = this.cameraSettings.shape || 'square';
    const circle = shape === 'circle';
    this.cameraPreview.style.borderRadius = circle ? '50%' : shape === 'rounded' ? '20px' : '8px';
    this.cameraPreview.style.width = circle ? '200px' : '300px';
    this.cameraPreview.style.height = circle ? '200px' : '200px';
    this.cameraPreview.style.overflow = 'hidden';
    this.cameraPreview.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
    this.cameraVideo.style.width = '100%';
    this.cameraVideo.style.height = '100%';
    this.cameraVideo.style.objectFit = 'cover';
    this.cameraVideo.style.borderRadius = this.cameraPreview.style.borderRadius;
  }

  startLevelMeter(stream, fillEl) {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      if (fillEl) {
        fillEl.style.width = `${Math.min(100, Math.round(rms * 220))}%`;
      }
      this.mediaTestRaf = requestAnimationFrame(tick);
    };
    this.mediaTestAudioContext = ctx;
    ctx.resume().catch(() => {});
    this.mediaTestRaf = requestAnimationFrame(tick);
  }

  stopMediaTests() {
    if (this.mediaTestRaf) {
      cancelAnimationFrame(this.mediaTestRaf);
      this.mediaTestRaf = null;
    }
    (this.mediaTestStreams || []).forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    this.mediaTestStreams = [];
    if (this.mediaTestAudioContext) {
      this.mediaTestAudioContext.close().catch(() => {});
      this.mediaTestAudioContext = null;
    }
    if (this.testCameraPreview) {
      this.testCameraPreview.srcObject = null;
    }
    if (this.micMeterFill) this.micMeterFill.style.width = '0%';
    if (this.systemMeterFill) this.systemMeterFill.style.width = '0%';
    if (this.testCameraStatus) this.testCameraStatus.textContent = '';
    if (this.testMicStatus) this.testMicStatus.textContent = '';
    if (this.testSystemStatus) this.testSystemStatus.textContent = '';
  }

  async testCamera() {
    try {
      this.stopMediaTests();
      await this.initializeCamera();
      if (!this.cameraStream) {
        throw new Error('No camera stream');
      }
      const previewStream = new MediaStream(this.cameraStream.getVideoTracks().map((track) => track.clone()));
      this.mediaTestStreams = [previewStream];
      this.testCameraPreview.srcObject = previewStream;
      await this.testCameraPreview.play().catch(() => {});
      this.testCameraStatus.textContent = 'Camera is working.';
    } catch (_err) {
      this.testCameraStatus.textContent = 'Camera failed. Allow camera access and pick a device.';
    }
  }

  async testMicrophone() {
    try {
      this.stopMediaTests();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false
      });
      this.mediaTestStreams = [stream];
      this.startLevelMeter(stream, this.micMeterFill);
      this.testMicStatus.textContent = 'Speak now. The green bar should move.';
    } catch (_err) {
      this.testMicStatus.textContent = 'Microphone failed. Check Windows privacy settings.';
    }
  }

  async testSystemAudio() {
    try {
      this.stopMediaTests();
      let sourceId = this.selectedSource?.id;
      if (!sourceId) {
        const sources = await window.electronAPI.getSources();
        sourceId = (sources || []).find((source) => String(source.id).startsWith('screen:'))?.id;
      }
      if (!sourceId) {
        throw new Error('No screen source');
      }
      await window.electronAPI.setCaptureSource({ id: sourceId, systemAudio: true });
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      this.mediaTestStreams = [stream];
      if (!stream.getAudioTracks().length) {
        this.testSystemStatus.textContent = 'No system audio track. Windows loopback is not available.';
        return;
      }
      this.startLevelMeter(stream, this.systemMeterFill);
      this.testSystemStatus.textContent = 'Play sound on the PC. The green bar should move.';
    } catch (_err) {
      this.testSystemStatus.textContent = 'System audio test failed. Select a screen source first, then retry.';
    }
  }

  async requestCameraPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((track) => track.stop());
      await this.detectCameraDevices();
      this.showToast('Camera access granted', 'success');
    } catch (_err) {
      this.showToast('Camera access denied', 'error');
    }
  }

  async detectCameraDevices() {
    if (!this.cameraDevice) return;
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      let videoDevices = devices.filter((device) => device.kind === 'videoinput');
      if (videoDevices.length === 0 || !videoDevices[0].label) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach((track) => track.stop());
          devices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = devices.filter((device) => device.kind === 'videoinput');
        } catch (_permErr) {
          // Permission denied; labels may stay empty.
        }
      }

      this.cameraDevice.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select Camera...';
      this.cameraDevice.appendChild(placeholder);

      videoDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Camera ${index + 1}`;
        this.cameraDevice.appendChild(option);
      });

      if (videoDevices.length > 0) {
        const preferred = this.cameraSettings.deviceId && videoDevices.some((d) => d.deviceId === this.cameraSettings.deviceId)
          ? this.cameraSettings.deviceId
          : videoDevices[0].deviceId;
        this.cameraDevice.value = preferred;
        this.cameraSettings.deviceId = preferred;
      }
    } catch (error) {
      this.showToast('Camera detection failed: ' + error.message, 'error');
    }
  }

  makeCameraDraggable() {
    if (!this.cameraPreview) return;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    this.cameraPreview.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(this.cameraPreview.style.left, 10) || 0;
      startTop = parseInt(this.cameraPreview.style.top, 10) || 0;
      const onMove = (ev) => {
        if (!dragging) return;
        this.cameraPreview.style.left = `${startLeft + (ev.clientX - startX)}px`;
        this.cameraPreview.style.top = `${startTop + (ev.clientY - startY)}px`;
        this.cameraPreview.style.right = 'auto';
        this.cameraPreview.style.bottom = 'auto';
        this.cameraPreview.style.transform = 'none';
      };
      const onUp = () => {
        dragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.screenRecorder = new ScreenRecorder();
});
