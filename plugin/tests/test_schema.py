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

    def test_media_roundtrip_and_invalid_links(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'items').mkdir()
            kinds = ['video', 'podcast', 'movie']
            (root / 'program.md').write_text('---\n' + json.dumps({
                'id': 'foundations', 'title': 'Mixed week',
                'items': [f'items/{kind}.md' for kind in kinds],
            }) + '\n---\nExplore a theme through different media.')
            for kind in kinds:
                item = valid_program()['items'][0]
                del item['content']
                item.update(id=kind, type=kind, url=f'https://example.org/{kind}', tags=['week-01'])
                (root / 'items' / f'{kind}.md').write_text('---\n' + json.dumps(item) + '\n---\nOriginal learning notes.')
            program = compile_program(root)
        self.assertEqual([item['content']['type'] for item in program['items']], kinds)
        self.assertEqual([item['content']['url'] for item in program['items']], [f'https://example.org/{kind}' for kind in kinds])
        self.assertTrue(all(item['content']['markdown'] == 'Original learning notes.' for item in program['items']))
        for url in ['javascript:alert(1)', 'http://example.org/watch', '//example.org/watch',
                    'https:///watch', 'https://user:secret@example.org/watch',
                    'https://example.org/\nwatch', 'https://example.org\\@evil.test', 'https://example.org:bad/']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                program['items'][0]['content']['url'] = url
                validate(program)
        del program['items'][0]['content']['url']
        with self.assertRaises(ValueError):
            validate(program)

    def test_revision_is_stable_for_same_canonical_program(self):
        program = valid_program()
        self.assertEqual(revision(program), revision(json.loads(json.dumps(program))))

    def test_declared_arxiv_html_reader_roundtrip_and_validation(self):
        program = valid_program()
        program['items'][0]['reader_url'] = 'https://arxiv.org/html/2402.08954'
        self.assertEqual(validate(program)['items'][0]['reader_url'], program['items'][0]['reader_url'])
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'items').mkdir()
            (root / 'program.md').write_text('---\n' + json.dumps({
                'id': 'foundations', 'title': 'Foundations', 'items': ['items/paper.md'],
            }) + '\n---\nRead the paper.')
            (root / 'items/paper.md').write_text('---\n' + json.dumps({
                'id': 'paper', 'title': 'Paper', 'purpose': 'Study the paper', 'tags': [],
                'type': 'markdown', 'reader_url': program['items'][0]['reader_url'],
                'provenance': {'text': 'arXiv paper', 'sources': [{'title': 'arXiv HTML', 'url': program['items'][0]['reader_url']}]},
            }) + '\n---\nRead and reflect.')
            self.assertEqual(compile_program(root)['items'][0]['reader_url'], program['items'][0]['reader_url'])
        for url in ('http://arxiv.org/html/2402.08954', 'https://example.com/html/2402.08954',
                    'https://arxiv.org/html/../admin', 'https://arxiv.org/html/2402.08954?url=http://localhost'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                program['items'][0]['reader_url'] = url
                validate(program)
        program['items'][0]['reader_url'] = 'https://arxiv.org/html/2402.08954'
        program['items'][0]['content']['type'] = 'video'
        program['items'][0]['content']['url'] = 'https://example.org/video'
        with self.assertRaises(ValueError):
            validate(program)

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
        self.assertIn("list", result.stdout)
        self.assertIn("show", result.stdout)


if __name__ == "__main__":
    unittest.main()
