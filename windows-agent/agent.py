"""Sara's local Windows companion. Only named, fixed actions are accepted."""
from __future__ import annotations

import ctypes
import hmac
import json
import os
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 43821
MAX_BODY = 2048
CONFIG_PATH = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "SaraVoice" / "agent-config.json"

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
        self.send_header("Access-Control-Max-Age", "60")
        self.send_header("Vary", "Origin")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path != "/v1/health":
            self._send(404, {"ok": False, "error": "Not found."})
            return
        if not self._authorized():
            self._send(403, {"ok": False, "code": "AUTH_DENIED", "error": "Sara's local connection was not authorized."})
            return
        self._send(200, {"ok": True, "title": "Sara is ready", "detail": "Windows companion connected.", "spoken": "Your computer is connected.", "icon": "●"})

    def do_POST(self):
        if self.path != "/v1/action":
            self._send(404, {"ok": False, "error": "Not found."})
            return
        if not self._authorized():
            self._send(403, {"ok": False, "code": "AUTH_DENIED", "error": "Sara's local connection was not authorized."})
            return
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
        if not isinstance(payload, dict) or not isinstance(payload.get("action"), str):
            self._send(400, {"ok": False, "error": "The action request was invalid."})
            return
        result = self.perform(payload["action"])
        self._send(200 if result["ok"] else 400, result)

    @staticmethod
    def perform(action: str) -> dict:
        if action in APPS:
            title, spoken, command = APPS[action]
            try:
                subprocess.Popen(command, close_fds=True)
                return {"ok": True, "title": title, "detail": "Started using the Windows app launcher.", "spoken": spoken, "icon": "↗"}
            except OSError:
                return {"ok": False, "error": "Windows could not open that app. Try opening it from Start."}
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
