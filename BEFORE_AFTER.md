# Before and after: FDSCREEN fixes

## Verdict

**Before:** a demo that could capture a screen to WebM, with several advertised features broken and a few settings buttons that crashed on click.

**After:** the same product, with the capture path, settings, shortcuts, security flags, and Screen + Camera mix aligned with what the UI already promised.

This was not a run-in-browser web app, so checks were syntax (`node --check` on all JS) plus source review of the recording pipeline. Please smoke-test on your machine: pick a screen, record ~10s, pause/resume, save WebM, try Screen + Camera, try MP4 if you have ffmpeg.

---

## Before

| Area | What was wrong |
|---|---|
| Settings | Save / Reset / Test / Camera Access overwrote their own methods with DOM nodes. Clicking them called a button, not a function. |
| Screen + Camera | Two video tracks in one `MediaStream`. `MediaRecorder` keeps one video track, so the webcam never landed in the file. The preview also lived in the main window, which was minimized. |
| Security | `webSecurity: false`. Source names and toasts went into `innerHTML`. |
| Sources | After a timeout, fake IDs (`screen:0:0`) were shown. Starting a recording then failed. Filters also dropped any window named toolbar / overlay / controller. |
| Shortcuts | Settings listed Ctrl+Shift global hotkeys. Nothing ever called `register-shortcuts`. |
| MP4 | The file was labeled `.mp4` while Chromium still wrote WebM. `fluent-ffmpeg` was unused. |
| Camera quality | Dropdown values were `720` / `1080`; code compared to `'720p'` / `'1080p'`. |
| Save path | Entire recording sat in RAM, then the whole buffer was sent over IPC and written with `writeFileSync`. |
| Main process | Production injected debug `executeJavaScript`, and commented PowerShell still referenced `ps` after spawn was disabled. |
| UI leftovers | Test Functions button, unused in-page floating controller, `test-preload.js`, no `.gitignore`. |

---

## After

| Area | What changed |
|---|---|
| Settings | Button refs are `saveSettingsBtn` / `resetSettingsBtn` / etc. Save and Reset persist to `localStorage` correctly. Test Functions removed. |
| Screen + Camera | Hidden videos + canvas compositor (`captureStream`) draw the webcam as a PiP (position/shape from settings) into the recorded file. |
| Security | `webSecurity: true`, sandbox on renderer windows, source labels and toasts use `textContent`. |
| Sources | Empty state if capture fails. No fake sources. Filter only drops the floating controller window. |
| Shortcuts | Registers `Ctrl/Cmd+Shift+R/P/S/C` at startup. Local Ctrl+R/P/S still work when the app is focused. |
| MP4 | Always capture WebM to disk. On save, if MP4 is selected, run ffmpeg (H.264 + AAC). If ffmpeg is missing, save `.webm` and warn. |
| Camera quality | Presets match the dropdown (`480` / `720` / `1080`). |
| Save path | Chunks append to a temp file while recording. Save copies that file (or converts it). Preview still uses a blob of the session. |
| Main process | Debug injection and DWM PowerShell removed. Floating controller is a small always-on-top window with content protection. |
| Hygiene | `.gitignore` added, `test-preload.js` removed, debug HTML script removed. |

---

## Files touched

- `src/main.js` — rewritten
- `src/preload.js` — rewritten
- `src/renderer.js` — rewritten
- `src/floating-controller.html` / `floating-controller-preload.js`
- `src/index.html` — settings, shortcuts, dead UI
- `.gitignore`
- `README.md` — MP4 / security notes
- deleted `src/test-preload.js`

---

## Still out of scope

- Bundling ffmpeg inside the installer (uses PATH only)
- macOS/Linux icons (`assets/icon.icns` / `icon.png` still missing; Windows `icon.ico` is present)
- Automated tests
- Font Awesome still loads from a CDN, so icons need network unless you vendor the CSS
- Camera PiP in the recording follows settings position/shape, not a free-drag of the overlay window
