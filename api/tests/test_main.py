import unittest

from eztudy_api.main import configured_cors_origins


class ConfigurationTests(unittest.TestCase):
    def test_cors_requires_exact_http_origins(self):
        self.assertEqual(
            configured_cors_origins("https://study.example.com/, http://localhost:5175"),
            ["https://study.example.com", "http://localhost:5175"],
        )
        for invalid in ("*", "study.example.com", "https://user@example.com", "https://example.com/path"):
            with self.subTest(invalid=invalid), self.assertRaises(RuntimeError):
                configured_cors_origins(invalid)


if __name__ == "__main__":
    unittest.main()
