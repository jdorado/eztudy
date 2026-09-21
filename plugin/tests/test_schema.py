import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from eztudy_publishing.schema import compile_program, revision, validate


ROOT = Path(__file__).resolve().parents[1]


def valid_program(markdown="A short lesson."):
    return {
        "id": "foundations",
        "title": "Foundations",
        "purpose": "Build a small, testable understanding.",
        "items": [
            {
                "id": "first-item",
                "title": "First item",
                "purpose": "Introduce the concept.",
                "tags": ["basics"],
                "content": {"type": "markdown", "markdown": markdown},
                "provenance": {"text": "Written for the test.", "sources": []},
            }
        ],
    }


class SchemaContractTests(unittest.TestCase):
    def test_compile_program_preserves_declared_item_order(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "items").mkdir()
            (root / "program.md").write_text(
                "---\n"
                + json.dumps({
                    "id": "foundations",
                    "title": "Foundations",
                    "items": ["items/second.md", "items/first.md"],
                })
                + "\n---\nLearn in the declared order.\n",
                encoding="utf-8",
            )
            for name, item_id in (("second", "second-item"), ("first", "first-item")):
                (root / "items" / f"{name}.md").write_text(
                    "---\n"
                    + json.dumps({
                        "id": item_id,
                        "title": name.title(),
                        "purpose": "A focused item.",
                        "tags": ["basics"],
                        "type": "markdown",
                        "provenance": {"text": "Written for the test.", "sources": []},
                    })
                    + f"\n---\n{name} body.\n",
                    encoding="utf-8",
                )

            compiled = compile_program(root)

        self.assertEqual([item["id"] for item in compiled["items"]], ["second-item", "first-item"])
        self.assertEqual(compiled["purpose"], "Learn in the declared order.")

    def test_validation_rejects_html_and_media(self):
        for body in ("<script>alert(1)</script>", "![image](https://example.test/image.png)"):
            with self.subTest(body=body):
                with self.assertRaisesRegex(ValueError, "HTML and media"):
                    validate(valid_program(body))

    def test_revision_is_stable_for_same_canonical_program(self):
        program = valid_program()
        self.assertEqual(revision(program), revision(json.loads(json.dumps(program))))

    def test_cli_help_does_not_require_credentials(self):
        result = subprocess.run(
            [sys.executable, "-m", "eztudy_publishing.cli", "--help"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("check", result.stdout)
        self.assertIn("publish", result.stdout)


if __name__ == "__main__":
    unittest.main()
