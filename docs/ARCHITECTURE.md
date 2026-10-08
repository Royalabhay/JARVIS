# Architecture: voice-controlled desktop assistant

## Working model today

The current MVP is a Chrome Manifest V3 extension:

```text
Microphone / typed command
        ↓
Popup UI (SpeechRecognition + command parser)
        ↓ fixed, validated action messages
Service worker (site allowlist + Chrome tabs API)
        ↓
Chrome tabs in the current window
```

The popup owns language selection, transcript, and confirmation prompts. It turns only known phrases into structured actions. The service worker revalidates every action and performs only browser operations in the allowlist. It never evaluates generated JavaScript or shell text. Tab closure is gated by a second explicit click.

## Full-computer target design

```text
┌────────────────────┐
│ Desktop UI / hotkey │  Push-to-talk, transcript, stop button, approval cards
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ Voice gateway      │  Speech-to-text; Hindi/English locale; optional wake phrase
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ Intent planner     │  Converts request to typed action plan; no direct tool access
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ Policy + approvals │  Risk tiers, target preview, scope, timeout, cancellation
└──────┬─────────────┘
       ├───────────────┐
       ↓               ↓
┌───────────────┐  ┌────────────────────┐
│ Chrome bridge │  │ Local desktop agent│
│ Extension API │  │ UI Automation APIs │
└──────┬────────┘  └─────────┬──────────┘
       └────────────┬────────┘
                    ↓
             Audit log + result
```

### Components

1. **Desktop shell**: Windows-first tray app with push-to-talk, visible listening state, emergency stop, and settings. Use a signed native app (for example Tauri) as the long-running process.
2. **Speech layer**: Stream microphone audio only while listening. Support a replaceable speech provider, Hindi (`hi-IN`) and Indian English (`en-IN`), transcript correction, and a typed fallback. Store no raw audio by default.
3. **Planner**: Produce a JSON plan from an intent catalog, such as `open_app`, `open_url`, `switch_window`, `browser_search`, or `click_accessible_element`. The model suggests; it does not execute arbitrary code.
4. **Policy broker**: Validate every plan against a locally defined schema and per-action policy. Require preview + confirmation for sending messages, submitting forms, payments, deleting files, closing many tabs, installing software, or changing settings. Refuse credential entry, security-control bypass, and unrestricted shell execution.
5. **Chrome extension**: Own browser tab metadata and approved navigation/actions through Chrome's extension APIs. Add content-script accessibility actions only for the active, user-approved tab and only after showing the target.
6. **Native messaging host**: A locally installed, signed host registered with Chrome. Use a versioned message protocol, validate sender origin, bind the host to the extension ID, and expose only named methods. Never accept arbitrary paths, commands, or code from the browser.
7. **Desktop adapter**: Use Windows UI Automation (accessibility tree first; coordinate input only as a fallback), process launching for explicitly allowlisted apps, and a user-visible foreground window. Add narrow per-capability toggles.
8. **Audit and recovery**: Record intent, planned action, user approval, result, and undo option. Redact sensitive fields; keep logs local and configurable. Every long action must support cancellation and a timeout.

## Trust boundaries and guardrails

- A web page can contain hostile text. Treat page content as data, never as instructions to the planner.
- The planner has no raw OS, filesystem, browser-debugging, or network tool. It emits a typed plan consumed by the local policy broker.
- Separate read-only, reversible, and high-impact actions. Ask before high-impact steps; open sites in tabs rather than submit data silently.
- Display the exact action and target before approval. Expire approvals quickly and cancel if the target changes.
- Keep secrets out of prompts, transcripts, and logs. Do not capture microphone audio until the user explicitly starts listening.
- Ship with no hidden background recording and no unrestricted “do anything” mode.

## Suggested build phases

1. **MVP (implemented):** allowlisted browser navigation/search, tab switching/reload, confirmed single-tab close, English/Hindi command entry.
2. **Chrome companion:** improve voice reliability and add active-tab accessibility actions with per-page confirmation.
3. **Windows agent:** tray UI, hotkey push-to-talk, app launch and window focus via UI Automation; explicit capability settings.
4. **Planning and memory:** add an LLM behind the policy broker, task previews, short-lived context, local redacted audit history, and safe recovery/undo.
5. **Hardening:** signed installer, secure native messaging registration, protocol/version checks, update channel, threat model, manual accessibility testing, and permission review.

## GitHub repository setup

The prototype is prepared for the connected `Royalabhay/JARVIS` repository on a dedicated feature branch. Review the draft pull request before merging. Do not put provider API keys, transcript samples, or machine-specific paths in source control.
