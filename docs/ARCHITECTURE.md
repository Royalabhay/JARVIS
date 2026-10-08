# Sara Voice Assistant: architecture and working model

## Current working model

```text
User taps microphone once to start a visible voice session
                    ↓
Responsive Chrome side panel
      ├─ continuous speech recognition until spoken stop command
      ├─ English/Hindi command parser; optional “Sara” wake prefix
      ├─ multi-step plan queue; voice yes/no confirmation for guarded actions
      └─ spoken response + recent activity
          ↓ typed actions only
MV3 service worker
      ├─ Chrome tabs API → open sites, search, switch/reload/close tabs
      └─ optional 127.0.0.1 companion connection
                    ↓ random token + extension-origin check
Python Windows companion (visible console, user-started)
      ├─ fixed app-launch list
      └─ fixed Windows shortcuts / volume keys / lock
```

The popup remains useful as a compact surface, while the Chrome Side Panel API gives Sara a persistent wider workspace when the user opens it from the toolbar. Responsive styles adapt the workspace to the available width and to reduced-motion settings.

## Action model

The voice recognizer returns text while the user-started session is visibly active. A deterministic command parser maps supported phrases to a small typed action set. “Then” and Hindi equivalents queue multiple supported steps in order. The service worker checks the action type and validates names before use. The Windows companion accepts only the same named actions, ignores request-supplied paths and executable strings, and never passes user text to a shell. The user can say “confirm” or “cancel” to resolve a high-impact action; “stop listening” halts the session.

### Supported browser actions

- Open a fixed list of HTTPS websites and Google search queries.
- Show and switch among tabs in the current Chrome window.
- Reload the active tab.
- Close one active tab only after a confirmation click.

### Supported Windows actions

- Open only Notepad, Calculator, and File Explorer.
- Use fixed Windows shortcuts for show desktop, Alt+Tab, Task Manager, and Snipping Tool.
- Raise, lower, and toggle mute using Windows media keys.
- Lock Windows only after a confirmation click.

Free-form shell commands, arbitrary paths, arbitrary coordinates, form submission, password entry, and background recording are intentionally unavailable. This implementation does not use an LLM planner; unknown phrases are rejected instead of guessed.

## Local companion security

- The HTTP listener binds only to IPv4 loopback (`127.0.0.1:43821`). It does not bind to LAN or the public internet.
- The setup script pins the expected `chrome-extension://<id>` Origin and creates a 256-bit random access token stored under `%LOCALAPPDATA%\SaraVoice`.
- Each request requires the exact Origin and token. CORS preflight grants only `GET`, `POST`, `OPTIONS`, `Content-Type`, and `X-Sara-Token` for the pinned extension origin.
- Sara requests `http://127.0.0.1/*` as an optional host permission only when the user saves a desktop token.
- The server limits request bodies, accepts JSON only, returns no-cache responses, and never logs request bodies or token headers.
- The companion runs only when the user starts `run_agent.bat`; it has no service, startup task, installer, or hidden listener.
- To disconnect, remove the token in Sara Settings and close the companion console.

## Trust boundaries and limitations

Chrome's voice recognition can be server-based. Sara does not record or save audio or transcripts, but users should review Chrome's speech and privacy settings; voice recognition may not be available offline. Typed commands work without speech recognition. Spoken replies use the browser's speech synthesizer.

The current version handles a curated set of commands. It is not a general visual agent and cannot inspect arbitrary desktop windows, click arbitrary controls, or infer workflows from page text. To add broader automation safely, a later version should introduce Windows UI Automation with an accessible-control tree, per-action target preview, expiring confirmation, cancellation, audit history, and undo where possible. A model planner should emit validated JSON only and remain separated from the OS adapter.

## Build and release path

1. **This build:** responsive Chrome UI, Hindi/English command phrases, side-panel tab list, fixed Windows app/shortcut actions, local pairing token, approvals, settings, and install documentation.
2. **UI Automation extension:** accessible control search and action previews for the foreground application; role/name targeting before coordinate fallback.
3. **Voice and intent improvements:** verify platform speech behavior, support on-device recognition where available, and add an optional model-backed planner with user-managed credentials and strict schema validation.
4. **Production hardening:** signed Windows installer, managed updates, accessibility and permissions testing, security review, data-retention choices, and end-user documentation.
