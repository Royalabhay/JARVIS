# Sara / JARVIS architecture map

## Existing repository (PR #1)

This section records the PR branch before this implementation began.

```text
popup.html + popup.js
  ├─ visible voice session + deterministic phrase parser
  ├─ simple multi-step queue + confirmation UI
  └─ recent action log
       │ typed SARA_ACTION messages
       ▼
service-worker.js
  ├─ Chrome tabs API (current window, fixed website list)
  └─ optional authenticated HTTP request to 127.0.0.1:43821
       │ exact extension Origin + random token
       ▼
windows-agent/agent.py
  ├─ fixed Notepad / Calculator / Explorer launch actions
  └─ fixed shortcuts, media keys, and confirmation-gated lock
```

`manifest.json` grants `tabs`, `sidePanel`, and `storage`, plus optional loopback host permission. `setup_windows.ps1` pairs the extension ID and local token. There are no test files or runtime dependencies in the PR branch. `README.md` and `docs/ARCHITECTURE.md` describe the MVP and its boundaries.

## Incremental target architecture

```text
Voice / typed command
       │
       ▼
popup.js — phrase normalization, intent planner, plan status, approvals
       │ versioned, validated action objects (never shell text)
       ▼
service-worker.js — Chrome state and browser actions across windows
       │ authenticated, origin-pinned loopback protocol
       ▼
windows-agent/agent.py — request gateway, permission checks, bounded audit
       ├── applications.py — Start Menu app registry + validated app IDs
       ├── filesystem.py — scoped search, metadata, opaque result IDs, open/reveal
       ├── windows.py — window discovery, focus, and window-state operations
       └── ui_automation.py — optional semantic UIA inspection/actions
```

## Trust boundaries

- Natural-language text is converted into a small action schema before execution. It is never treated as code or a path to execute.
- Chrome APIs own browser state. Stable IDs are runtime references, scoped with window IDs and revalidated immediately before use.
- The desktop gateway accepts only known action types and bounded parameters. Application launch resolves a user request against a discovered registry. File open resolves an opaque search-result ID against a fresh catalog rooted in approved user folders.
- Read-only context/search operations can run automatically. Closing tabs, destructive file changes, locking, and semantic UI activation require explicit confirmation. No delete or arbitrary shell action is introduced by the initial expansion.
- The existing loopback bind, random token, exact extension origin, and no-secret logging remain mandatory.

## Implementation sequence

1. Preserve the current MVP and record this architecture map.
2. Add a versioned shared action schema, validation tests, and sequential-plan failure handling.
3. Add application discovery, safe file search/open/reveal, foreground-window context, and desktop-agent tests.
4. Expand Chrome context and tab actions to multiple windows, plus title/URL-based tab selection.
5. Add a permission/confirmation policy and bounded audit metadata.
6. Add Windows UI Automation behind an optional adapter and semantic target validation; keep coordinate automation out of the primary path.
7. Update user and developer docs, run the full available test suite, and update PR #1 without merging it.

The planner in the current MVP is deterministic. A model-backed planner is a later, optional layer and must output only the shared action schema; no model may call operating-system APIs directly.
