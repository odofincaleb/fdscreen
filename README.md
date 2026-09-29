# FDSCREEN - Desktop Screen Recorder

A modern, feature-rich desktop screen recording application built with Electron. Capture your screen with high quality video and audio recording capabilities.

## Features

- 🎥 **High-Quality Recording**: Support for 720p, 1080p, 1440p, and 4K recording
- 🖥️ **Multiple Sources**: Record entire screen or specific windows
- 🎵 **Audio Recording**: System audio and microphone support
- ⏯️ **Recording Controls**: Start, pause, resume, and stop functionality
- ⌨️ **Keyboard Shortcuts**: Quick access with Ctrl+R (record), Ctrl+P (pause/resume), Ctrl+S (stop)
- ⏱️ **Countdown Timer**: 3-second visual countdown before recording starts
- 🔽 **Auto-Minimize**: App automatically minimizes when recording begins
- 🎨 **Modern UI**: Clean, intuitive interface with real-time status updates
- 💾 **Multiple Formats**: Export as WebM or MP4 with automatic codec detection
- ⚙️ **Customizable Settings**: Adjustable video quality, frame rate, and output format
- 📁 **Easy File Management**: Built-in save dialog with custom naming

## Keyboard Shortcuts

- **Ctrl + R**: Start Recording
- **Ctrl + P**: Pause/Resume Recording  
- **Ctrl + Space**: Pause/Resume Recording (alternative)
- **Ctrl + S**: Stop Recording

## Installation

### Prerequisites
- Node.js (version 16 or higher)
- npm or yarn package manager

### Setup
1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application
- **Development mode**: `npm run dev`
- **Production mode**: `npm start`

### Building for Distribution
- **Windows**: `npm run build:win`
- **macOS**: `npm run build:mac`
- **Linux**: `npm run build:linux`
- **All platforms**: `npm run build`

## Usage

### Getting Started
1. Launch the application
2. Select a recording source from the available screens and windows
3. Configure audio settings (system audio and/or microphone)
4. Adjust recording settings if needed (Settings button)
5. Click "Start Recording" to begin

### Recording Controls
- **Start**: Begin recording the selected source
- **Pause/Resume**: Pause and resume recording without stopping
- **Stop**: End the recording session

### Settings
Access the settings panel to customize:
- **Video Quality**: 720p, 1080p, 1440p, or 4K
- **Frame Rate**: 24, 30, or 60 FPS
- **Output Format**: MP4 (bundled ffmpeg) or WebM

### Saving Recordings
After stopping a recording:
1. Preview the recorded video
2. Click "Save Recording" to choose save location
3. Or click "Discard" to delete the recording

## Technical Details

### Built With
- **Electron**: Cross-platform desktop app framework
- **HTML5 Media APIs**: Screen capture and recording
- **Modern CSS**: Responsive design with animations
- **Vanilla JavaScript**: No external UI frameworks

### File Structure
```
screen_recorder/
├── src/
│   ├── main.js          # Main Electron process
│   ├── preload.js       # Secure API bridge
│   ├── index.html       # Application UI
│   ├── styles.css       # Application styles
│   ├── renderer.js      # UI logic and recording functionality
│   ├── floating-controller.html
│   └── floating-controller-preload.js
├── assets/
│   └── icon.png         # Application icon
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

### Security Features
- Context isolation enabled
- Node integration disabled in renderer
- Chromium web security enabled
- Secure IPC communication via preload script

### MP4 export
Recordings are captured as WebM, then converted to MP4 with a bundled ffmpeg binary (H.264 + AAC). Choose WebM in Settings if you want to skip conversion. A Windows installer unpacks `ffmpeg-static` next to the asar so the binary can run.

## Troubleshooting

### Common Issues
1. **No recording sources available**: Ensure the app has screen recording permissions
2. **Audio not recording**: Check system audio settings and permissions
3. **Poor video quality**: Adjust video quality settings or check system performance

### System Requirements
- **Windows**: Windows 10 or later
- **macOS**: macOS 10.14 or later
- **Linux**: Ubuntu 18.04 or equivalent

### Permissions
The application requires:
- Screen recording permissions
- Microphone access (if microphone recording is enabled)
- File system access for saving recordings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the package.json file for details.

## Support

For issues and feature requests, please create an issue in the project repository.