import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError

SPEC = importlib.util.spec_from_file_location(
    "check_render", Path(__file__).parents[1] / "scripts" / "check_render.py"
)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class UrlValidationTests(unittest.TestCase):
    def test_accepts_https_url(self):
        self.assertEqual(module.validate_url("https://example.com/health").hostname, "example.com")

    def test_rejects_missing_host(self):
        with self.assertRaises(ValueError):
            module.validate_url("https:///missing-host")

    def test_rejects_non_http_scheme(self):
        with self.assertRaises(ValueError):
            module.validate_url("file:///etc/passwd")

    def test_rejects_embedded_credentials(self):
        with self.assertRaises(ValueError):
            module.validate_url("https://user:secret@example.com")

    def test_rejects_localhost(self):
        with self.assertRaises(ValueError):
            module.validate_url("http://localhost:8000")


class CheckBehaviorTests(unittest.TestCase):
    @patch.object(module.urllib.request, "urlopen")
    def test_200_is_online(self, mock_urlopen):
        response = Mock()
        response.status = 200
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = b"ok"
        mock_urlopen.return_value = response
        result = module.check_url("https://example.com", retries=1)
        self.assertEqual(result["status"], "online")
        self.assertEqual(result["httpStatus"], 200)
        self.assertEqual(result["attempts"], 1)

    @patch.object(module.time, "sleep")
    @patch.object(module.urllib.request, "urlopen", side_effect=URLError("temporary network issue"))
    def test_retries_network_errors(self, mock_urlopen, _sleep):
        result = module.check_url("https://example.com", retries=3)
        self.assertEqual(result["status"], "offline")
        self.assertEqual(result["attempts"], 3)
        self.assertEqual(mock_urlopen.call_count, 3)

    @patch.object(module.urllib.request, "urlopen")
    def test_500_is_offline(self, mock_urlopen):
        error = HTTPError("https://example.com", 503, "Unavailable", {}, None)
        mock_urlopen.side_effect = error
        with patch.object(module.time, "sleep"):
            result = module.check_url("https://example.com", retries=2)
        self.assertEqual(result["status"], "offline")
        self.assertEqual(result["httpStatus"], 503)
        self.assertEqual(result["attempts"], 2)

    def test_history_handles_missing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(module.load_history(Path(directory) / "history.json"), [])

    def test_history_is_capped(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "history.json"
            path.write_text(json.dumps({"checks": [{"n": i} for i in range(10)]}), encoding="utf-8")
            self.assertEqual(len(module.load_history(path, max_history=4)), 4)


if __name__ == "__main__":
    unittest.main()
