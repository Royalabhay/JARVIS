"""Optional semantic Windows UI Automation adapter using UI Automation metadata."""
from __future__ import annotations

try:
    import uiautomation as auto
except ImportError:  # the agent remains usable when UI Automation is not installed
    auto = None

MAX_CONTROLS = 250
MAX_DEPTH = 7
ACTIVATABLE_ROLES = {"ButtonControl", "TabItemControl", "MenuItemControl", "CheckBoxControl"}


def inspect_foreground() -> dict:
    if auto is None:
        return {"ok": False, "code": "UIA_UNAVAILABLE", "error": "Install windows-agent requirements to inspect accessible UI controls."}
    try:
        root = auto.GetForegroundControl()
        if not root:
            return {"ok": False, "code": "WINDOW_NOT_FOUND", "error": "There is no foreground application to inspect."}
        controls = []
        pending = [(child, 1) for child in reversed(root.GetChildren()[:MAX_CONTROLS])]
        while pending and len(controls) < MAX_CONTROLS:
            control, depth = pending.pop()
            try:
                role = str(getattr(control, "ControlTypeName", "UnknownControl"))
                name = str(getattr(control, "Name", "") or "")[:180]
                controls.append({
                    "role": role,
                    "name": name,
                    "automationId": str(getattr(control, "AutomationId", "") or "")[:120],
                    "enabled": bool(getattr(control, "IsEnabled", False)),
                    "visible": not bool(getattr(control, "IsOffscreen", True)),
                })
                if depth < MAX_DEPTH:
                    children = control.GetChildren()
                    pending.extend((child, depth + 1) for child in reversed(children[:max(0, MAX_CONTROLS - len(controls))]))
            except Exception:
                continue
        return {"ok": True, "window": str(getattr(root, "Name", ""))[:180], "controls": controls, "truncated": bool(pending)}
    except Exception:
        return {"ok": False, "code": "UIA_ERROR", "error": "Windows could not inspect accessible controls in this window."}


def activate_named_control(name: str, role: str) -> tuple[bool, str]:
    """Activate one unique exact semantic control; callers must confirm first."""
    if auto is None:
        return False, "Install windows-agent requirements to activate accessible UI controls."
    if role not in ACTIVATABLE_ROLES or not name or len(name) > 180:
        return False, "That UI control target is not allowed."
    inspected = inspect_foreground()
    if not inspected.get("ok"):
        return False, inspected.get("error", "Could not inspect the foreground window.")
    try:
        root = auto.GetForegroundControl()
        if not root:
            return False, "There is no foreground application to inspect."
        pending = list(root.GetChildren()[:MAX_CONTROLS])
    except Exception:
        return False, "Windows could not inspect the foreground application."
    found = []
    count = 0
    while pending and count < MAX_CONTROLS:
        control = pending.pop()
        count += 1
        try:
            if str(getattr(control, "Name", "")) == name and str(getattr(control, "ControlTypeName", "")) == role and bool(getattr(control, "IsEnabled", False)) and not bool(getattr(control, "IsOffscreen", True)):
                found.append(control)
            pending.extend(control.GetChildren()[:max(0, MAX_CONTROLS - count)])
        except Exception:
            continue
    if len(found) != 1:
        return False, "That control was not found uniquely in the current foreground window. Inspect the window and try a more specific name."
    try:
        found[0].SetFocus()
        if role == "CheckBoxControl":
            found[0].GetTogglePattern().Toggle()
        else:
            found[0].GetInvokePattern().Invoke()
        return True, name
    except Exception:
        return False, "Windows could not activate that accessible control."
