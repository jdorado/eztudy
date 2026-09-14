# Eztudy Markdown authoring

Eztudy publishes learning content; you own research, reasoning, writing and tool
choice using your normal native workspace and conversation. No mandatory context
read or transcript replay. Normal tutoring is read-only. Only an explicit learner
request to create, edit, reorder, tag or publish content authorizes publication.

Use the visible Program/Item references in the request. Keep existing Programs
separate. Write Markdown in your own workspace. Choose useful teaching content;
Eztudy does not prescribe a curriculum, teaching loop, or source research workflow.
Do not claim publication from prose or draft files: require the CLI receipt.

## Files

A directory contains `program.md` and `items/name.md`. Metadata is **JSON between
--- delimiters**, followed by Markdown. All shown fields are required. Stable IDs
use lowercase letters, digits and hyphens, starting with a letter (max 80).

Program:

```markdown
---
{"id":"your-program-id","title":"A clear title","items":["items/first.md"]}
---
The purpose of this Program.
```

Item:

```markdown
---
{"id":"first","title":"A useful readout","purpose":"What this helps the reader understand","tags":["foundations"],"type":"markdown","provenance":{"text":"Describe authorship and source use honestly","sources":[]}}
---
Your independently authored Markdown body.
```

Only referenced Items are published, in the listed order. Unreferenced files are
drafts. Session/subject labels are optional tags, never parents or extra files.
No Session or Course commands. Editing text, tags, and reference order then
publishing replaces the active revision; removing a reference retains API history.
Provenance sources, when used, have `title` and HTTP(S) `url`. Do not invent sources.

Supported: paragraphs, `#` through `###` headings, bold/italic, inline/fenced code,
simple lists, blockquotes and HTTP(S) links. No raw HTML, images, embeds, video,
widgets or executable artifacts. Up to 100 Items, 100,000 characters per body and
1 MB per published Program. Validation does not certify truth or teaching quality.

## Commands and source mount

Run `ez eztudy check DIRECTORY`, then `ez eztudy publish DIRECTORY` after successful
validation. Both require the installed scoped connection. Success returns JSON;
nonzero exit means failure. Do not retry by inventing a receipt or bypassing a 409.
The CLI keeps its publication receipt in private plugin storage for safe republish.
A 409 means another source changed the Program: inspect your source and the last
receipt with the owner before replacing content.

The installer binds your workspace read-only at `/state/source` **inside the CLI
container**. Write in your normal workspace; pass the corresponding mounted path:
files in `work/my-program` use `ez eztudy check /state/source/work/my-program`.
This mount publishes your authored files; it is not a second agent workspace.
The installer records the allowed Program IDs in `work/eztudy-connection.md`.
Use an authorized ID; another ID returns 403. Do not read credentials or runtime
control files. API credentials live only in private plugin storage, not model text.

## Setup and recovery

Installation requires a verified Eztudy account and administrator-issued
Program-scoped publisher credential. The installing administrator configures the
API origin, allowed Program IDs and read-only workspace mount. Reuse that approved
connection; never broaden grants or choose another account from prompt text.
No provider login is required beyond the learner's existing Eztudy authentication.
If configuration or source access is missing, report the concrete missing binding.
Do not patch Ez, edit generated Compose, or replace native instructions to repair it.

After publication, report the receipt and ask the frontend to refresh naturally.
The authenticated Timeline and reader must actually display the content. Ordinary
follow-up explanations must not edit source, publish or modify the Program.
