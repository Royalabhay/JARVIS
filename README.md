# Sara Voice Assistant

Sara is a voice-first Chrome side panel with an optional local Windows companion. The side panel scales from a narrow browser rail to a full desktop workspace. Speak in English or Hindi, type a request, or choose a quick action.

## What it can do

### Chrome
- Open YouTube, Google, Gmail, WhatsApp Web, Instagram, LinkedIn, GitHub, and ChatGPT.
- Search Google, switch tabs, reload the current tab, and choose from the open tabs list.
- Close one tab only after you confirm the action.

### Windows companion
- Open Notepad, Calculator, and File Explorer.
- Show the desktop, switch between windows, raise/lower/toggle volume, open Task Manager, and open the screenshot snipping tool.
- Lock Windows only after you confirm.

Sara accepts named actions from an allowlist. It does not execute spoken shell commands, click arbitrary screen coordinates, submit forms, or enter credentials. This is a safe personal assistant foundation, not unrestricted computer control.

## Install the Chrome side panel

1. In Chrome, open `chrome://extensions` and turn on **Developer mode**.
2. Choose **Load unpacked** and select the project folder containing `manifest.json`.
3. Click Sara’s extension icon, then pin its side panel if you want quick access.
4. Open **Settings** to copy the extension ID and choose English or Hindi.

Chrome 114 or newer is required for the side panel.

## Connect Windows

The desktop companion needs Python 3 and runs in a visible console window.

1. In Sara **Settings**, copy your Extension ID.
2. In the project folder, open PowerShell and run `./setup_windows.ps1`. Paste the Extension ID when prompted and copy the generated token into Sara Settings.
3. Save Settings and allow Sara’s optional local connection permission when Chrome asks.
4. Double-click `run_agent.bat` and keep its window open while using Windows actions.
5. Reopen Sara. The status at the top should say **Desktop ready**.

To disconnect, clear the token in Settings, save, and close the companion window. The companion binds only to `127.0.0.1`, requires the exact extension origin and a random token, and accepts only fixed action names.

## Example commands

- “Gmail kholo” / “open Gmail”
- “Search for good dosa places” / “खोजो आज की खबरें”
- “Next tab” / “अगला टैब”
- “Open Calculator” / “Calculator kholo”
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

## GitHub

The project is being developed in [Royalabhay/JARVIS](https://github.com/Royalabhay/JARVIS) on the Sara feature branch and draft PR. Review that PR before merging.
