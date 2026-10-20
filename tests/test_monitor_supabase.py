import importlib.util
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "monitor_supabase", Path(__file__).parents[1] / "scripts" / "monitor_supabase.py"
)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)

class PublicUrlValidationTests(unittest.TestCase):
    def test_rejects_non_http_scheme(self):
        with self.assertRaises(ValueError):
            module.validate_public_url("file:///etc/passwd")

    def test_rejects_credentials_in_url(self):
        with self.assertRaises(ValueError):
            module.validate_public_url("https://user:pass@example.com")

    def test_rejects_localhost(self):
        with self.assertRaises(ValueError):
            module.validate_public_url("http://localhost:8000")

    def test_rejects_local_domain(self):
        with self.assertRaises(ValueError):
            module.validate_public_url("http://printer.local")

    def test_redirects_are_disabled(self):
        # The scheduled worker must not automatically follow a redirect supplied by a target.
        self.assertIsNone(module.SAFE_OPENER.handlers[0].redirect_request)

if __name__ == "__main__":
    unittest.main()
