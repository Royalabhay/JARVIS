"""Versioned, allowlisted desktop action envelope validation."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlsplit

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "shared" / "action-schema.json"
SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
SITES = {"youtube", "google", "gmail", "whatsapp", "instagram", "linkedin", "github", "chatgpt"}
SCOPES = {"desktop", "documents", "downloads", "pictures", "videos", "music", "all"}
ROLES = {"ButtonControl", "TabItemControl", "MenuItemControl", "CheckBoxControl"}
DESKTOP_ACTIONS = {
    "open-notepad", "open-calculator", "open-explorer", "open-downloads", "open-documents", "open-desktop",
    "open-pictures", "open-videos", "open-music", "show-desktop", "switch-window",
    "screenshot", "task-manager", "volume-up", "volume-down", "volume-mute", "lock-computer",
}


def _valid_field(name: str, value: object) -> bool:
    if name in {"site"}:
        return isinstance(value, str) and value in SITES
    if name in {"query"}:
        return isinstance(value, str) and bool(value.strip()) and len(value) <= 240
    if name in {"scope"}:
        return isinstance(value, str) and value in SCOPES
    if name == "extension":
        return isinstance(value, str) and len(value) <= 13 and value.startswith(".") and value[1:].isalnum()
    if name == "latest":
        return isinstance(value, bool)
    if name == "direction":
        return type(value) is int and value in {-1, 1}
    if name in {"tabId", "windowId"}:
        return type(value) is int and value > 0
    if name == "url":
        if not isinstance(value, str) or len(value) > 2048:
            return False
        try:
            parsed = urlsplit(value)
            return parsed.scheme == "https" and bool(parsed.hostname)
        except ValueError:
            return False
    if name in {"resultId"}:
        return isinstance(value, str) and bool(value) and len(value) <= 64
    if name == "action":
        return isinstance(value, str) and value in DESKTOP_ACTIONS
    if name == "role":
        return isinstance(value, str) and value in ROLES
    if name == "name":
        return isinstance(value, str) and bool(value.strip()) and len(value) <= 180
    if name == "confirmed":
        return isinstance(value, bool)
    if name == "state":
        return isinstance(value, str) and value in {"minimize", "maximize", "restore"}
    return False


def validate_desktop_action(action: object) -> tuple[bool, str]:
    if not isinstance(action, dict) or action.get("version") != SCHEMA["version"]:
        return False, "Invalid or missing action schema version."
    kind = action.get("type")
    entry = SCHEMA["actions"].get(kind) if isinstance(kind, str) else None
    if not entry:
        return False, "That action is not in Sara's approved action schema."
    keys = set(action)
    permitted = {"version", "type", *entry["fields"]}
    if not keys <= permitted or not set(entry["required"]) <= keys:
        return False, "The action has missing or unexpected fields."
    if any(not _valid_field(name, value) for name, value in action.items() if name not in {"version", "type"}):
        return False, "One or more action fields are invalid."
    query_limits = {"search": 240, "file-search": 160, "file-open-name": 160, "app-open": 160,
                    "switch-tab-query": 160, "window-focus-query": 160, "window-state": 160}
    if "query" in action and len(action["query"]) > query_limits.get(kind, 240):
        return False, "One or more action fields are too long."
    return True, ""
