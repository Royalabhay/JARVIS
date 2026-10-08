"""Scoped file search with opaque result IDs and validated open/reveal actions."""
from __future__ import annotations

import os
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path

SAFE_OPEN_EXTENSIONS = {
    ".pdf", ".txt", ".rtf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".csv", ".md", ".jpg", ".jpeg", ".png", ".gif", ".mp3", ".wav", ".mp4", ".mkv",
    ".zip", ".7z", ".rar",
}
SCOPES = {"desktop", "documents", "downloads", "pictures", "videos", "music", "all"}


def known_roots(home: Path | None = None) -> dict[str, Path]:
    user_home = (home or Path.home()).resolve()
    roots = {
        "desktop": user_home / "Desktop",
        "documents": user_home / "Documents",
        "downloads": user_home / "Downloads",
        "pictures": user_home / "Pictures",
        "videos": user_home / "Videos",
        "music": user_home / "Music",
    }
    cloud = os.environ.get("OneDrive")
    if cloud:
        one_drive = Path(cloud).resolve()
        for name in roots:
            candidate = one_drive / name.capitalize()
            if candidate.is_dir():
                roots[name] = candidate
    return {name: path for name, path in roots.items() if path.is_dir()}


class FileCatalog:
    def __init__(self, *, home: Path | None = None, time_limit: float = 2.5, max_entries: int = 100_000):
        self.home = (home or Path.home()).resolve()
        self.time_limit = time_limit
        self.max_entries = max_entries
        self._targets: dict[str, Path] = {}

    def search(self, *, query: str = "", scope: str = "all", extension: str = "", latest: bool = False, limit: int = 8) -> dict:
        if scope not in SCOPES:
            return {"ok": False, "code": "ACTION_DENIED", "error": "Choose a supported user folder."}
        query = " ".join(query.casefold().split())[:160]
        extension = extension.casefold()
        if extension and (not extension.startswith(".") or len(extension) > 16 or not extension[1:].isalnum()):
            return {"ok": False, "code": "INVALID_REQUEST", "error": "That file type is invalid."}
        if not query and not extension:
            return {"ok": False, "code": "INVALID_REQUEST", "error": "Say a file name or file type to search for."}
        roots = known_roots(self.home)
        selected = list(roots.values()) if scope == "all" else ([roots[scope]] if scope in roots else [])
        if not selected:
            return {"ok": False, "code": "FILE_NOT_FOUND", "error": f"The {scope} folder was not found."}
        started = time.monotonic()
        matches: list[tuple[float, Path, os.stat_result]] = []
        visited = 0
        for root in selected:
            for current, directories, names in os.walk(root, followlinks=False):
                directories[:] = [name for name in directories if not name.startswith(".")]
                for name in names:
                    visited += 1
                    if visited > self.max_entries or time.monotonic() - started > self.time_limit:
                        break
                    candidate = Path(current) / name
                    if candidate.suffix.casefold() in {".exe", ".com", ".bat", ".cmd", ".ps1", ".msi", ".lnk", ".scr", ".url"}:
                        continue
                    if extension and candidate.suffix.casefold() != extension:
                        continue
                    if query and query not in candidate.name.casefold():
                        continue
                    try:
                        resolved = candidate.resolve(strict=True)
                        root_resolved = root.resolve(strict=True)
                        resolved.relative_to(root_resolved)
                        if not resolved.is_file() or resolved.suffix.casefold() not in SAFE_OPEN_EXTENSIONS:
                            continue
                        stat = resolved.stat()
                    except (OSError, ValueError):
                        continue
                    matches.append((stat.st_mtime, resolved, stat))
                if visited > self.max_entries or time.monotonic() - started > self.time_limit:
                    break
            if visited > self.max_entries or time.monotonic() - started > self.time_limit:
                break
        matches.sort(key=lambda item: item[0], reverse=True)
        if latest:
            matches = matches[:1]
        else:
            matches = matches[:max(1, min(limit, 20))]
        self._targets.clear()
        results = []
        for _, path, stat in matches:
            result_id = secrets.token_urlsafe(18)
            self._targets[result_id] = path
            results.append({
                "id": result_id,
                "name": path.name,
                "extension": path.suffix.casefold(),
                "path": str(path),
                "modifiedAt": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
                "size": stat.st_size,
            })
        return {"ok": True, "results": results, "truncated": visited > self.max_entries or time.monotonic() - started > self.time_limit}

    def resolve(self, result_id: str) -> Path | None:
        path = self._targets.get(result_id)
        if not path:
            return None
        try:
            resolved = path.resolve(strict=True)
            if resolved.suffix.casefold() not in SAFE_OPEN_EXTENSIONS or not resolved.is_file():
                return None
            if not any(resolved.is_relative_to(root.resolve()) for root in known_roots(self.home).values()):
                return None
            return resolved
        except (OSError, ValueError):
            return None

    def open_result(self, result_id: str) -> tuple[bool, str]:
        path = self.resolve(result_id)
        if not path:
            return False, "That file result expired or is outside the allowed folders. Search again."
        try:
            os.startfile(str(path))
            return True, path.name
        except OSError:
            return False, "Windows could not open the selected file."

    def reveal_result(self, result_id: str) -> tuple[bool, str]:
        path = self.resolve(result_id)
        if not path:
            return False, "That file result expired or is outside the allowed folders. Search again."
        try:
            import subprocess
            subprocess.Popen(["explorer.exe", "/select,", str(path)], close_fds=True)
            return True, path.name
        except OSError:
            return False, "Windows could not reveal the selected file."
