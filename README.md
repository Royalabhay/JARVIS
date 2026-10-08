# Sara Voice Desktop Assistant

A voice-first Chrome extension prototype for Hindi and English browser commands. It runs locally as an unpacked extension and uses a strict command allowlist. Closing the current tab always asks for confirmation.

## Try it in Chrome

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this project folder.
3. Pin **Sara Voice Assistant** to the toolbar.
4. Click the extension and tap the microphone. Allow microphone access when Chrome asks.
5. Try: “open YouTube”, “Gmail kholo”, “search for weather in Delhi”, “next tab”, “pichhla tab”, “reload”, or “tab band karo”.

Speech recognition depends on Chrome and its configured speech service. Typed commands work without microphone access.

## What this prototype can do

- Open a small allowlisted set of sites and run Google searches in new tabs.
- Switch to the next or previous tab in the current window.
- Reload the active tab.
- Close the active tab only after a visible confirmation.

It does not control other desktop apps, read page contents, click arbitrary page elements, run shell commands, or operate the whole computer. Those capabilities need a signed desktop companion and narrow user-granted permissions; see [the architecture](docs/ARCHITECTURE.md).
