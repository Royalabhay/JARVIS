# Sara Voice Assistant

Sara is a voice-first Chrome side panel with an optional local Windows companion. The side panel scales from a narrow browser rail to a full desktop workspace. Speak in English or Hindi, type a request, or choose a quick action.

## What it can do

### Chrome
- Open YouTube, Google, Gmail, WhatsApp Web, Instagram, LinkedIn, GitHub, and ChatGPT.
- Open HTTPS websites, search Google, and find/switch tabs across normal Chrome windows.
- Reload the active tab, inspect tabs across normal windows, and close the current tab only after confirmation.

### Windows companion
- Open Notepad, Calculator, File Explorer, and common user folders; discover/launch Start Menu apps by name; focus matching open windows.
- Search Desktop, Documents, Downloads, Pictures, Videos, and Music for safe document/media files; open or reveal validated results.
- Read foreground-window context and inspect accessible UI Automation controls.
- Show the desktop, switch between windows, raise/lower/toggle volume, open Task Manager, and open the screenshot snipping tool.
- Lock Windows only after you confirm.

Sara converts voice/text to versioned action objects and validates them before browser or Windows execution. It does not execute spoken shell commands, accept arbitrary executable paths, click arbitrary screen coordinates, submit forms, or enter credentials. Files are searched only in the named user folders above; executable/script/shortcut file types are excluded from file opening. UI control activation uses semantic names and requires confirmation.

## Install the Chrome side panel

1. In Chrome, open `chrome://extensions` and turn on **Developer mode**.
2. Choose **Load unpacked** and select the project folder containing `manifest.json`.
3. Click Sara’s extension icon, then pin its side panel if you want quick access.
4. Open **Settings** to copy the extension ID and choose English or Hindi.

Chrome 114 or newer is required for the side panel.

## Connect Windows

The desktop companion needs Python 3.10+ and runs in a visible console window. Optional semantic UI inspection/activation uses `uiautomation`.

1. In Sara **Settings**, copy your Extension ID.
2. In the project folder, open PowerShell and run `powershell -NoProfile -ExecutionPolicy Bypass -File .\setup_windows.ps1`. This permits the setup script for that one PowerShell process without changing your computer's execution-policy setting. Paste the Extension ID when prompted and copy the generated token into Sara Settings.
3. Save Settings, allow Sara’s optional local connection permission, and allow a Chrome local-network prompt if it appears. Keep the Settings page open for the connection check.
4. Double-click `run_agent.bat` and keep its window open while using Windows actions.
5. Reopen Sara. The status at the top should say **Desktop ready**.
6. For Windows UI Automation, install the optional adapter dependency from the repository folder: `python -m pip install -r windows-agent/requirements.txt`.

To disconnect, clear the token in Settings, save, and close the companion window. The companion binds only to `127.0.0.1`, requires the exact extension origin and a random token, and accepts only fixed action names.

## Example commands

- “Gmail kholo” / “open Gmail”
- “Search for good dosa places” / “खोजो आज की खबरें”
- “Next tab” / “अगला टैब”
- “Open Calculator” / “Calculator kholo”
- “Open Photoshop” / “Switch to Chrome”
- “Switch to my Gmail tab” / “Find the tab where GitHub is open”
- “Find file invoice.pdf” / “Open file invoice.pdf”
- “Open the latest PDF in Downloads”
- “Show installed apps” / “Show windows” / “What app is open?”
- “Switch to window Notepad” / “Minimize window Calculator” / “Restore window File Explorer”
- “Inspect window” / “Click button Save” (Sara confirms before activating a UI control.)
- “Show desktop” / “डेस्कटॉप दिखाओ”
- “Volume up” / “आवाज़ बढ़ाओ”
- “Lock computer” — Sara asks for confirmation first.
- “Open Gmail and then show desktop” — Sara runs supported steps in order.
- “Confirm” / “haan” or “cancel” / “nahi” — answer an approval prompt by voice.
- “Sara, stop listening” — pause the voice session.

Tap the microphone once to start a visible hands-free voice session. After that, give commands and answer approvals by voice; say “stop listening” to pause. Sara does not listen in the background before you start a session. Typed commands and on-screen confirmations remain available.

## Speech privacy

Sara does not save audio or transcripts. Chrome’s built-in speech recognition may send audio to the speech service used by Chrome, depending on the browser and configuration; recognition may not work offline. Check Chrome’s current speech and privacy settings before using the microphone. Speech replies use the browser’s speech synthesizer.

The Windows token is saved in Chrome extension storage on this computer and in `%LOCALAPPDATA%\SaraVoice\agent-config.json`. Do not share it. The companion has no internet listener and does not auto-start.

## Architecture and security

See [docs/ARCHITECTURE_MAP.md](docs/ARCHITECTURE_MAP.md) for the component map and trust boundaries, and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the working model and supported actions. The shared action contract is in `shared/action-schema.json`. Python service tests run with `python -m unittest discover -s tests`.

The Windows companion listens only on `127.0.0.1`, authenticates the exact extension origin and random token, rejects unknown/version-mismatched actions, rate-limits action requests, and writes a bounded local audit containing action type and success/failure only. Application launch resolves names against Start Menu shortcuts; a voice command cannot provide an executable path. File result IDs are generated by the companion and revalidated against scoped user folders before opening.

## GitHub

The project is being developed in [Royalabhay/JARVIS](https://github.com/Royalabhay/JARVIS) on the Sara feature branch and draft PR. Review that PR before merging.
