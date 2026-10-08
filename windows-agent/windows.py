"""Windows window discovery and foreground-window operations."""
from __future__ import annotations

import ctypes


def list_windows() -> list[dict]:
    if not hasattr(ctypes, "windll"):
        return []
    user32 = ctypes.windll.user32
    user32.IsWindowVisible.argtypes = [ctypes.c_void_p]
    user32.IsWindowVisible.restype = ctypes.c_bool
    user32.GetWindowTextLengthW.argtypes = [ctypes.c_void_p]
    user32.GetWindowTextLengthW.restype = ctypes.c_int
    user32.GetWindowTextW.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p, ctypes.c_int]
    user32.GetWindowTextW.restype = ctypes.c_int
    user32.GetForegroundWindow.restype = ctypes.c_void_p
    foreground = user32.GetForegroundWindow()
    rows: list[dict] = []
    callback_type = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

    def collect(hwnd, _extra):
        if not user32.IsWindowVisible(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length <= 0:
            return True
        title = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, title, length + 1)
        rows.append({"id": int(hwnd), "title": title.value, "active": int(hwnd) == int(foreground or 0)})
        return True

    user32.EnumWindows(callback_type(collect), 0)
    return rows


def foreground_context() -> dict:
    active = next((window for window in list_windows() if window["active"]), None)
    return {"foregroundWindow": active} if active else {"foregroundWindow": None}


def focus_window(window_id: int) -> tuple[bool, str]:
    candidates = list_windows()
    selected = next((window for window in candidates if window["id"] == window_id), None)
    if not selected or not hasattr(ctypes, "windll"):
        return False, "That window is no longer available. Refresh the window list."
    user32 = ctypes.windll.user32
    user32.ShowWindow.argtypes = [ctypes.c_void_p, ctypes.c_int]
    user32.BringWindowToTop.argtypes = [ctypes.c_void_p]
    user32.SetForegroundWindow.argtypes = [ctypes.c_void_p]
    user32.SetForegroundWindow.restype = ctypes.c_bool
    hwnd = ctypes.c_void_p(window_id)
    user32.ShowWindow(hwnd, 9)  # SW_RESTORE
    user32.BringWindowToTop(hwnd)
    if user32.SetForegroundWindow(hwnd):
        return True, selected["title"]
    user32.keybd_event(0x12, 0, 0, 0)  # Alt
    user32.keybd_event(0x12, 0, 0x0002, 0)
    if user32.SetForegroundWindow(hwnd):
        return True, selected["title"]
    return False, "Windows did not allow Sara to focus that window."


def set_window_state(window_id: int, state: str) -> tuple[bool, str]:
    candidates = list_windows()
    selected = next((window for window in candidates if window["id"] == window_id), None)
    commands = {"minimize": 6, "maximize": 3, "restore": 9}
    if not selected or state not in commands or not hasattr(ctypes, "windll"):
        return False, "That window or state is not available. Refresh the window list."
    user32 = ctypes.windll.user32
    user32.ShowWindow.argtypes = [ctypes.c_void_p, ctypes.c_int]
    user32.ShowWindow(ctypes.c_void_p(window_id), commands[state])
    return True, selected["title"]


def focus_window_by_name(query: str) -> tuple[bool, str]:
    state, selected, _ = find_window_by_name(query)
    if state != "found" or selected is None:
        return False, "not-found" if state == "not-found" else "ambiguous: " + "; ".join(item["title"] for item in _[:5])
    ok, message = focus_window(selected["id"])
    return ok, message


def find_window_by_name(query: str) -> tuple[str, dict | None, list[dict]]:
    normalized = " ".join(query.casefold().split())
    windows = list_windows()
    exact = [item for item in windows if " ".join(item["title"].casefold().split()) == normalized]
    matches = exact or [item for item in windows if normalized in item["title"].casefold()]
    if not matches:
        return "not-found", None, []
    if len(matches) > 1 and not exact:
        return "ambiguous", None, matches[:5]
    return "found", matches[0], matches
