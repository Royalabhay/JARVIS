"""Discover and launch applications only through Start Menu shortcuts."""
from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path


def shortcut_roots() -> list[Path]:
    roots = []
    if os.environ.get("PROGRAMDATA"):
        roots.append(Path(os.environ["PROGRAMDATA"]) / "Microsoft/Windows/Start Menu/Programs")
    if os.environ.get("APPDATA"):
        roots.append(Path(os.environ["APPDATA"]) / "Microsoft/Windows/Start Menu/Programs")
    return [root for root in roots if root.is_dir()]


def discover_applications() -> list[dict[str, str]]:
    """Return stable IDs and labels; paths remain inside the discovery layer."""
    results = []
    seen = set()
    for root in shortcut_roots():
        try:
            for shortcut in root.rglob("*.lnk"):
                try:
                    resolved = shortcut.resolve(strict=True)
                    resolved.relative_to(root.resolve(strict=True))
                except (OSError, ValueError):
                    continue
                label = shortcut.stem.strip()
                key = label.casefold()
                if not label or key in seen:
                    continue
                seen.add(key)
                digest = hashlib.sha256(str(resolved).casefold().encode("utf-8")).hexdigest()[:12]
                app_id = f"app-{re.sub(r'[^a-z0-9]+', '-', label.casefold()).strip('-')[:36]}-{digest}"
                results.append({"id": app_id, "name": label, "source": "start-menu"})
        except OSError:
            continue
    return sorted(results, key=lambda item: item["name"].casefold())


def find_application(query: str, applications: list[dict[str, str]] | None = None) -> tuple[str, dict[str, str] | None, list[dict[str, str]]]:
    """Resolve a spoken label to one discovered app; never accept a caller path."""
    normalized = " ".join(query.casefold().split())
    available = applications if applications is not None else discover_applications()
    exact = [item for item in available if " ".join(item["name"].casefold().split()) == normalized]
    candidates = exact or [item for item in available if normalized in item["name"].casefold()]
    if len(candidates) == 1:
        return "found", candidates[0], candidates
    if not candidates:
        return "not-found", None, []
    return "ambiguous", None, candidates[:8]


def launch_application(app_id: str, applications: list[dict[str, str]] | None = None) -> tuple[bool, str]:
    """Launch only an ID that resolves to an existing Start Menu .lnk shortcut."""
    available = applications if applications is not None else discover_applications()
    record = next((item for item in available if item["id"] == app_id), None)
    if not record:
        return False, "Application not found in the Start Menu registry."
    for root in shortcut_roots():
        try:
            for shortcut in root.rglob("*.lnk"):
                if shortcut.stem != record["name"]:
                    continue
                resolved = shortcut.resolve(strict=True)
                resolved.relative_to(root.resolve(strict=True))
                os.startfile(str(resolved))
                return True, record["name"]
        except (OSError, ValueError):
            continue
    return False, "The registered Start Menu shortcut no longer exists."
