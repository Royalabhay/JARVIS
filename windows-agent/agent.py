"""Sara's local Windows companion. Only named, fixed actions are accepted."""
from __future__ import annotations

import ctypes
import hmac
import json
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from action_schema import validate_desktop_action
from applications import discover_applications, find_application, launch_application
from filesystem import FileCatalog, known_roots
from ui_automation import activate_named_control, inspect_foreground
from windows import find_window_by_name, focus_window, focus_window_by_name, foreground_context, list_windows, set_window_state

HOST = "127.0.0.1"
PORT = 43821
MAX_BODY = 2048
CONFIG_PATH = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "SaraVoice" / "agent-config.json"
AUDIT_PATH = CONFIG_PATH.with_name("activity.jsonl")
FILES = FileCatalog()
RATE_LOCK = threading.Lock()
REQUEST_TIMES: list[float] = []
APPS = {
    "open-notepad": ("Notepad opened", "Opening Notepad.", ["notepad.exe"]),
    "open-calculator": ("Calculator opened", "Opening Calculator.", ["calc.exe"]),
    "open-explorer": ("File Explorer opened", "Opening File Explorer.", ["explorer.exe"]),
}

KEYS = {
    "show-desktop": ([0x5B, ord("D")], "Desktop shown", "Showing the desktop."),
    "switch-window": ([0x12, 0x09], "Switched window", "Switching windows."),
    "screenshot": ([0x5B, 0x10, ord("S")], "Screenshot tool opened", "Opening the screenshot tool."),
    "task-manager": ([0x11, 0x10, 0x1B], "Task Manager opened", "Opening Task Manager."),
    "volume-up": ([0xAF], "Volume increased", "Volume up."),
    "volume-down": ([0xAE], "Volume decreased", "Volume down."),
    "volume-mute": ([0xAD], "Volume toggled", "Toggling mute."),
}

KEYEVENTF_KEYUP = 0x0002


def load_config() -> dict:
    try:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(
            f"Sara is not set up yet. Run setup_windows.ps1 first. Details: {exc}"
        ) from exc
    if not isinstance(config.get("token"), str) or len(config["token"]) < 32:
        raise SystemExit("Sara's local token is missing or invalid. Run setup_windows.ps1 again.")
    if not isinstance(config.get("origin"), str) or not config["origin"].startswith("chrome-extension://"):
        raise SystemExit("Sara's extension ID is missing. Run setup_windows.ps1 again.")
    return config


CONFIG = load_config()


class Handler(BaseHTTPRequestHandler):
    server_version = "SaraLocal/1"
    sys_version = ""

    def log_message(self, _format, *_args):
        # Never log command payloads, auth headers, transcripts, or URLs.
        return

    def _origin_ok(self) -> bool:
        return self.headers.get("Origin", "") == CONFIG["origin"]

    def _send(self, status: int, payload: dict, *, cors: bool = True):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if cors and self._origin_ok():
            self.send_header("Access-Control-Allow-Origin", CONFIG["origin"])
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(data)

    def _authorized(self) -> bool:
        candidate = self.headers.get("X-Sara-Token", "")
        return self._origin_ok() and hmac.compare_digest(candidate, CONFIG["token"])

    def do_OPTIONS(self):
        if not self._origin_ok() or self.headers.get("Host") != f"{HOST}:{PORT}":
            self._send(403, {"ok": False, "code": "ORIGIN_DENIED", "error": "This browser origin is not connected."}, cors=False)
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", CONFIG["origin"])
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Sara-Token")
        if self.headers.get("Access-Control-Request-Private-Network") == "true":
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "60")
        self.send_header("Vary", "Origin")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path not in {"/v1/health", "/v1/context", "/v1/applications", "/v1/windows"}:
            self._send(404, {"ok": False, "error": "Not found."})
            return
        if not self._authorized():
            self._send(403, {"ok": False, "code": "AUTH_DENIED", "error": "Sara's local connection was not authorized."})
            return
        if self.path == "/v1/context":
            self._send(200, {"ok": True, **foreground_context()})
        elif self.path == "/v1/applications":
            self._send(200, {"ok": True, "applications": discover_applications()})
        elif self.path == "/v1/windows":
            self._send(200, {"ok": True, "windows": list_windows()})
        else:
            self._send(200, {"ok": True, "title": "Sara is ready", "detail": "Windows companion connected.", "spoken": "Your computer is connected.", "icon": "●"})

    def do_POST(self):
        if self.path != "/v1/action":
            self._send(404, {"ok": False, "error": "Not found."})
            return
        if not self._authorized():
            self._send(403, {"ok": False, "code": "AUTH_DENIED", "error": "Sara's local connection was not authorized."})
            return
        now = time.monotonic()
        with RATE_LOCK:
            REQUEST_TIMES[:] = [stamp for stamp in REQUEST_TIMES if now - stamp < 60]
            if len(REQUEST_TIMES) >= 60:
                self._send(429, {"ok": False, "code": "RATE_LIMITED", "error": "Sara is handling too many actions. Wait a moment and try again."})
                return
            REQUEST_TIMES.append(now)
        if self.headers.get_content_type() != "application/json":
            self._send(415, {"ok": False, "error": "JSON actions only."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 2 or length > MAX_BODY:
                raise ValueError("Request size is invalid.")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self._send(400, {"ok": False, "error": "The action request was invalid."})
            return
        if not isinstance(payload, dict) or not isinstance(payload.get("action"), (str, dict)):
            self._send(400, {"ok": False, "error": "The action request was invalid."})
            return
        result = self.perform(payload["action"])
        self._audit(payload["action"], bool(result.get("ok")))
        self._send(200 if result["ok"] else 400, result)

    @staticmethod
    def _audit(action: str | dict, success: bool) -> None:
        kind = action if isinstance(action, str) else str(action.get("type", "unknown"))
        event = {"timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "action": kind[:64], "status": "success" if success else "failed"}
        try:
            AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
            with AUDIT_PATH.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(event, separators=(",", ":")) + "\n")
            if AUDIT_PATH.stat().st_size > 256_000:
                lines = AUDIT_PATH.read_text(encoding="utf-8").splitlines()[-500:]
                AUDIT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
        except OSError:
            pass

    @staticmethod
    def perform(action: str | dict) -> dict:
        if isinstance(action, dict):
            return Handler.perform_structured(action)
        if not isinstance(action, str):
            return {"ok": False, "code": "ACTION_DENIED", "error": "This action is not supported."}
        if action in APPS:
            title, spoken, command = APPS[action]
            try:
                subprocess.Popen(command, close_fds=True)
                return {"ok": True, "title": title, "detail": "Started using the Windows app launcher.", "spoken": spoken, "icon": "↗"}
            except OSError:
                return {"ok": False, "error": "Windows could not open that app. Try opening it from Start."}
        folder_scope = action.removeprefix("open-") if action.startswith("open-") else ""
        if folder_scope in {"desktop", "documents", "downloads", "pictures", "videos", "music"}:
            folder = known_roots().get(folder_scope)
            if not folder:
                return {"ok": False, "error": f"The {folder_scope} folder was not found."}
            try:
                os.startfile(str(folder))
                return {"ok": True, "title": f"Opened {folder_scope}", "detail": str(folder), "spoken": f"Opening {folder_scope}.", "icon": "▰"}
            except OSError:
                return {"ok": False, "error": f"Windows could not open the {folder_scope} folder."}
        if action == "lock-computer":
            if ctypes.windll.user32.LockWorkStation():
                return {"ok": True, "title": "Computer locked", "detail": "Windows locked after your confirmation.", "spoken": "Locking your computer.", "icon": "⌑"}
            return {"ok": False, "error": "Windows could not lock this session."}
        if action in KEYS:
            keys, title, spoken = KEYS[action]
            try:
                user32 = ctypes.windll.user32
                for key in keys:
                    user32.keybd_event(key, 0, 0, 0)
                for key in reversed(keys):
                    user32.keybd_event(key, 0, KEYEVENTF_KEYUP, 0)
                return {"ok": True, "title": title, "detail": "Sent a fixed Windows shortcut.", "spoken": spoken, "icon": "⌘"}
            except (AttributeError, OSError):
                return {"ok": False, "error": "Windows could not run that shortcut."}
        return {"ok": False, "code": "ACTION_DENIED", "error": "That Windows action is not on Sara's approved list."}

    @staticmethod
    def perform_structured(action: dict) -> dict:
        valid, reason = validate_desktop_action(action)
        if not valid:
            return {"ok": False, "code": "ACTION_DENIED", "error": reason}
        kind = action["type"]
        if kind == "desktop":
            return Handler.perform(action["action"])
        if kind == "context-read":
            return {"ok": True, **foreground_context()}
        if kind == "window-list":
            return {"ok": True, "windows": list_windows()}
        if kind in {"window-focus", "window-minimize", "window-maximize", "window-restore"}:
            window_id = action.get("windowId")
            if not isinstance(window_id, int) or isinstance(window_id, bool):
                return {"ok": False, "code": "INVALID_REQUEST", "error": "That window reference is invalid."}
            if kind == "window-focus":
                ok, result = focus_window(window_id)
            else:
                state = kind.split("-", 1)[1]
                ok, result = set_window_state(window_id, state)
            return {"ok": ok, "title": "Window focused" if ok else "Window unavailable", "detail": result, "code": None if ok else "WINDOW_NOT_FOUND"}
        if kind in {"window-focus-query", "window-state"}:
            state, selected, candidates = find_window_by_name(action["query"])
            if state == "not-found":
                return {"ok": False, "code": "WINDOW_NOT_FOUND", "error": "I couldn't find an open window with that name."}
            if state == "ambiguous":
                return {"ok": False, "code": "WINDOW_AMBIGUOUS", "error": "Several windows match: " + ", ".join(item["title"] for item in candidates)}
            if kind == "window-focus-query":
                ok, result = focus_window(selected["id"])
            else:
                ok, result = set_window_state(selected["id"], action["state"])
            return {"ok": ok, "title": "Window updated" if ok else "Window unavailable", "detail": result, "code": None if ok else "WINDOW_NOT_FOUND"}
        if kind == "app-list":
            return {"ok": True, "applications": discover_applications()}
        if kind == "app-open":
            query = action.get("query")
            if not isinstance(query, str) or not query.strip() or len(query) > 160:
                return {"ok": False, "code": "INVALID_REQUEST", "error": "Say the application name."}
            window_ok, window_result = focus_window_by_name(query)
            if window_ok:
                return {"ok": True, "title": f"Switched to {query}", "detail": window_result, "spoken": f"Switching to {query}.", "icon": "⇄"}
            if window_result.startswith("ambiguous:"):
                return {"ok": False, "code": "WINDOW_AMBIGUOUS", "error": "Several open windows match: " + window_result.removeprefix("ambiguous: ")}
            state, application, candidates = find_application(query)
            if state == "not-found":
                return {"ok": False, "code": "APP_NOT_FOUND", "error": f"I couldn't find {query} in the Start Menu app registry."}
            if state == "ambiguous":
                return {"ok": False, "code": "APP_AMBIGUOUS", "error": "Several apps match: " + ", ".join(item["name"] for item in candidates)}
            ok, result = launch_application(application["id"])
            return {"ok": ok, "title": f"Opened {result}" if ok else "App could not be opened", "detail": result, "code": None if ok else "APP_NOT_FOUND"}
        if kind == "file-search":
            query = action.get("query", "")
            scope = action.get("scope", "all")
            extension = action.get("extension", "")
            latest = action.get("latest", False)
            if not isinstance(query, str) or len(query) > 160 or not isinstance(scope, str) or not isinstance(extension, str) or not isinstance(latest, bool):
                return {"ok": False, "code": "INVALID_REQUEST", "error": "The file search request was invalid."}
            return FILES.search(query=query, scope=scope, extension=extension, latest=latest)
        if kind in {"file-open", "file-reveal"}:
            result_id = action.get("resultId")
            if not isinstance(result_id, str) or len(result_id) > 64:
                return {"ok": False, "code": "INVALID_REQUEST", "error": "That file result is invalid."}
            ok, result = FILES.open_result(result_id) if kind == "file-open" else FILES.reveal_result(result_id)
            title = "File opened" if kind == "file-open" else "File location opened"
            return {"ok": ok, "title": title, "detail": result, "code": None if ok else "FILE_NOT_FOUND"}
        if kind in {"file-open-latest", "file-open-name"}:
            if kind == "file-open-name":
                query, scope = action.get("query"), action.get("scope", "all")
                if not isinstance(query, str) or not query.strip() or len(query) > 160 or not isinstance(scope, str):
                    return {"ok": False, "code": "INVALID_REQUEST", "error": "Say the file name again."}
                found = FILES.search(query=query, scope=scope, latest=False, limit=20)
                if not found.get("ok"):
                    return found
                exact = [item for item in found["results"] if item["name"].casefold() == query.casefold()]
                candidates = exact or found["results"]
                if len(candidates) != 1:
                    return {"ok": False, "code": "FILE_AMBIGUOUS" if candidates else "FILE_NOT_FOUND", "error": "Several files match. Use a more specific name." if candidates else f"I couldn't find {query} in the selected folders."}
                ok, name = FILES.open_result(candidates[0]["id"])
                return {"ok": ok, "title": "File opened" if ok else "File unavailable", "detail": name, "result": candidates[0], "code": None if ok else "FILE_NOT_FOUND"}
            scope, extension = action.get("scope"), action.get("extension")
            if not isinstance(scope, str) or not isinstance(extension, str):
                return {"ok": False, "code": "INVALID_REQUEST", "error": "Choose a folder and file type."}
            found = FILES.search(scope=scope, extension=extension, latest=True)
            if not found.get("ok"):
                return found
            if not found["results"]:
                return {"ok": False, "code": "FILE_NOT_FOUND", "error": f"No {extension} file was found in {scope}."}
            ok, name = FILES.open_result(found["results"][0]["id"])
            return {"ok": ok, "title": "Latest file opened" if ok else "File could not be opened", "detail": name, "result": found["results"][0], "code": None if ok else "FILE_NOT_FOUND"}
        if kind == "ui-inspect":
            return inspect_foreground()
        if kind == "ui-activate":
            name, role, confirmed = action.get("name"), action.get("role"), action.get("confirmed")
            if confirmed is not True:
                return {"ok": False, "code": "CONFIRMATION_REQUIRED", "error": "Confirm the named UI action first."}
            if not isinstance(name, str) or not isinstance(role, str):
                return {"ok": False, "code": "INVALID_REQUEST", "error": "The UI target was invalid."}
            ok, result = activate_named_control(name, role)
            return {"ok": ok, "title": "Control activated" if ok else "Control unavailable", "detail": result}
        return {"ok": False, "code": "ACTION_DENIED", "error": "That action is not supported."}


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.daemon_threads = True
    print("Sara Windows companion is running on this computer.")
    print("Keep this window open while using desktop voice actions. Press Ctrl+C to stop.")
    try:
        server.serve_forever(poll_interval=0.4)
    except KeyboardInterrupt:
        print("\nSara Windows companion stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    if os.name != "nt":
        raise SystemExit("The Sara Windows companion only runs on Windows.")
    main()
