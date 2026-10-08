from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "windows-agent"))

from action_schema import validate_desktop_action
from applications import discover_applications, find_application, launch_application
from filesystem import FileCatalog


class ActionSchemaTests(unittest.TestCase):
    def test_schema_rejects_unknown_or_extra_fields(self):
        self.assertTrue(validate_desktop_action({"version": "1", "type": "app-open", "query": "Notepad"})[0])
        self.assertFalse(validate_desktop_action({"version": "1", "type": "run-shell", "command": "whoami"})[0])
        self.assertFalse(validate_desktop_action({"version": "1", "type": "app-open", "query": "Notepad", "path": "C:/x.exe"})[0])
        self.assertFalse(validate_desktop_action({"version": "1", "type": "app-open", "query": []})[0])
        self.assertFalse(validate_desktop_action({"version": "1", "type": "desktop", "action": "run-shell"})[0])
        self.assertFalse(validate_desktop_action({"version": "1", "type": "open-url", "url": "https://"})[0])
        self.assertTrue(validate_desktop_action({"version": "1", "type": "ui-activate", "name": "Save", "role": "ButtonControl", "confirmed": False})[0])
        self.assertFalse(validate_desktop_action({"version": "1", "type": "window-state", "query": "Chrome", "state": "delete"})[0])


class ApplicationRegistryTests(unittest.TestCase):
    def test_discovery_resolves_name_and_launches_registered_id_only(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "Microsoft" / "Windows" / "Start Menu" / "Programs"
            root.mkdir(parents=True)
            shortcut = root / "Design App.lnk"
            shortcut.write_text("placeholder", encoding="utf-8")
            with patch.dict(os.environ, {"PROGRAMDATA": temporary, "APPDATA": ""}, clear=False):
                discovered = discover_applications()
                state, app, _ = find_application("design app", discovered)
                self.assertEqual(state, "found")
                self.assertEqual(app["name"], "Design App")
                with patch("applications.os.startfile", create=True) as startfile:
                    ok, name = launch_application(app["id"], discovered)
                self.assertTrue(ok)
                self.assertEqual(name, "Design App")
                startfile.assert_called_once_with(str(shortcut.resolve()))
                ok, _ = launch_application("C:/Users/attacker/evil.exe", discovered)
                self.assertFalse(ok)


class FileCatalogTests(unittest.TestCase):
    def test_search_returns_opaque_id_and_open_revalidates_path(self):
        with tempfile.TemporaryDirectory() as temporary:
            home = Path(temporary)
            downloads = home / "Downloads"
            downloads.mkdir()
            report = downloads / "report.pdf"
            report.write_bytes(b"safe document")
            catalog = FileCatalog(home=home)
            result = catalog.search(query="report.pdf", scope="downloads")
            self.assertTrue(result["ok"])
            self.assertEqual(result["results"][0]["name"], "report.pdf")
            self.assertNotEqual(result["results"][0]["id"], str(report))
            with patch("filesystem.os.startfile", create=True) as startfile:
                ok, name = catalog.open_result(result["results"][0]["id"])
            self.assertTrue(ok)
            self.assertEqual(name, "report.pdf")
            startfile.assert_called_once_with(str(report.resolve()))
            self.assertFalse(catalog.open_result("C:/Users/attacker/evil.exe")[0])

    def test_file_search_excludes_executables_and_rejects_unsupported_scopes(self):
        with tempfile.TemporaryDirectory() as temporary:
            home = Path(temporary)
            downloads = home / "Downloads"
            downloads.mkdir()
            (downloads / "invoice.pdf").write_bytes(b"pdf")
            (downloads / "invoice.exe").write_bytes(b"exe")
            catalog = FileCatalog(home=home)
            results = catalog.search(query="invoice", scope="downloads")
            self.assertEqual([item["name"] for item in results["results"]], ["invoice.pdf"])
            self.assertFalse(catalog.search(query="invoice", scope="system32")["ok"])


if __name__ == "__main__":
    unittest.main()
