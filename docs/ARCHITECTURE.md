# Sara Voice Assistant: architecture and working model

See [ARCHITECTURE_MAP.md](ARCHITECTURE_MAP.md) for the existing-to-target component map.

## Current working model

```text
Voice / typed request
       ↓
popup.js — English/Hindi phrase parser, versioned action plan, approvals, activity UI
       ↓ validated action object (shared/action-schema.json)
service-worker.js — multi-window Chrome tabs + action routing
       ├─ Chrome APIs for browser actions
       └─ exact-origin + token-authenticated request to 127.0.0.1:43821
              ↓
windows-agent/agent.py — schema gate, rate limit, bounded metadata audit
       ├─ applications.py — discover/resolve Start Menu shortcuts by name
       ├─ filesystem.py — scoped search and opaque file-result validation
       ├─ windows.py — enumerate/focus/manage windows and read foreground context
       └─ ui_automation.py — optional semantic UI Automation adapter
```

The planner is deterministic today. It converts recognized phrases to versioned actions; no LLM is allowed to produce shell commands or call OS APIs. Multi-step execution stops at the first failed step. Browser, installed-app and file-search targets are resolved to concrete IDs or catalog entries by their executor immediately before use.

## Supported actions

### Chrome

- Open allowlisted sites, secure HTTPS URLs, and Google searches.
- List tabs across normal Chrome windows and identify each tab's window.
- Switch to a tab by runtime ID or a unique title/URL phrase, focusing its containing window.
- Move to the previous/next tab, reload the active tab, and close only after confirmation.

Incognito windows are excluded from cross-window discovery. Runtime tab/window IDs are refreshed and checked before acting; IDs are not persisted.

### Windows

- Open fixed built-in apps, discover Start Menu shortcut names, launch one unambiguous registry result, or focus an already-open window by its title.
- Search files in Desktop, Documents, Downloads, Pictures, Videos, and Music; return bounded metadata and opaque result IDs; open or reveal a selected result after checking its ID, current path, root, and file type again.
- Read the foreground window and enumerate visible windows; focus/minimize/maximize/restore by validated window ID or a unique title query.
- Inspect accessible foreground controls with UI Automation. Activating a unique, visible, enabled button, tab, menu item, or checkbox requires confirmation.
- Use fixed shortcuts/media keys and confirmation-gated Windows lock.

The file service excludes executable and script formats, does not follow directory symlinks, limits each scan by time and entry count, and does not search Windows/system folders or every drive. Search roots and the limit are documented in `windows-agent/filesystem.py`.

## Shared action contract

`shared/action-schema.json` names the supported version-1 action types and fields. The extension runs `shared/action-schema.js` validation before planning/execution. The Windows gateway loads the JSON contract and rejects unknown versions/types, missing required fields, and extra fields. Desktop operations are then checked for type/length/scope/ID validity by their owning module. The Windows agent never accepts an arbitrary path or executable command from the planner.

## Permissions and security

- The HTTP listener binds only to `127.0.0.1:43821`; it is not exposed to the LAN or internet.
- Pairing pins the exact `chrome-extension://<id>` Origin and a 256-bit random token in `%LOCALAPPDATA%\SaraVoice`.
- Requests require exact Origin and token. CORS allows only the pinned extension and the documented methods/headers.
- The agent accepts JSON-only requests with a size limit and rate-limits action POSTs. The bounded JSONL audit stores timestamp, action type, and success/failure, never tokens, voice recordings, or raw file query text.
- The companion is started visibly by the user and does not install a service or auto-start task.
- Destructive and sensitive actions are absent or confirmation-gated. UI activation is semantic; screen coordinates are not used.

## Setup and development

1. Load the repository unpacked from `chrome://extensions` and open Sara Settings.
2. Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\setup_windows.ps1`, save its token in Settings, and grant the optional localhost permission. The process-scoped bypass avoids changing the machine's PowerShell policy.
3. Start `run_agent.bat` and keep its console open.
4. For UI Automation, install `windows-agent/requirements.txt` into the same Python environment.
5. Run service tests with `python -m unittest discover -s tests`.

Speech recognition may send audio to the service configured by Chrome. Sara itself does not persist recordings or transcripts. A visible mic tap starts voice; the spoken stop command ends it.

## Remaining roadmap

- Add richer application registry sources and selected-result UI for app ambiguity.
- Add recent-file filters and broader folder searching while retaining scoped roots and bounded scans.
- Add UIA value/text patterns with target previews and a confirmation policy for medium/high-impact controls.
- Add optional Chrome history access behind an explicit permission request.
- Add an optional model-backed planner only after schema/policy coverage; no model may directly call the Windows API.
- Harden setup/release with a signed installer, dependency pinning, accessibility checks, and full Windows/Chrome security testing.
