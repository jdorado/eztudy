# Eztudy content authoring

Eztudy publishes learning content; you own research, reasoning, writing and tool
choice using your normal native workspace and conversation. No mandatory context
read or transcript replay. Normal tutoring is read-only. Only an explicit learner
request to create, edit, reorder, tag or publish content authorizes publication.

Use the visible Program/Item references in the request. Keep existing Programs
separate. Write Markdown in your own workspace. Choose useful teaching content;
Eztudy does not prescribe a curriculum, teaching loop, or source research workflow.
Do not claim publication from prose or draft files: require the CLI receipt.
Discover the current installed skill through `ez tools list --details`; do not
reuse a remembered package-cache path, which may point to an older version.

## Programs, Items and labels

A Program is an ordered collection of separately openable Items. Each Item is
one reading, resource, exercise or synthesis activity, with its own stable ID,
title, purpose, body and provenance. Several sections explaining that one
activity may belong in its body; separate activities need separate Items.

Week, session and subject are grouping labels expressed as shared `tags`. They
do not become an Item containing the whole group. For example, three readings
and a synthesis in Week 1 are four Item files, each tagged `week-01`, referenced
in the Program's intended order. Name each Item for its reading or activity,
not just "Week 1". Keep a conditional instruction with the activity it qualifies;
shared Program context belongs in the Program purpose.

When correcting a bundled Item, split its activities into separate files and
replace its reference in `program.md`; leaving the bundle referenced would
publish it alongside the new Items. Preserve the content and use provenance
appropriate to each Item. Unreferenced source files may remain as drafts.

## Files

A directory contains `program.md` and `items/name.md`. Metadata is **JSON between
--- delimiters**, followed by Markdown. All shown fields are required. Stable IDs
use lowercase letters, digits and hyphens, starting with a letter (max 80).

Program:

```markdown
---
{"id":"your-program-id","title":"A clear title","items":["items/first-reading.md","items/second-reading.md","items/synthesis.md"]}
---
The purpose of this Program.
```

One Item file (`items/first-reading.md`; the other references each need their
own file, ID and activity):

```markdown
---
{"id":"first-reading","title":"Read the first essay","purpose":"What this reading helps the reader understand","tags":["week-01","foundations"],"type":"markdown","provenance":{"text":"Describe authorship and source use honestly","sources":[]}}
---
Your independently authored Markdown body.
```

Only referenced Items are published, in the listed order. Unreferenced files are
drafts. Week/session/subject labels are optional shared tags, never parents or
container Items.
No Session or Course commands. Editing text, tags, and reference order then
publishing replaces the active revision; removing a reference retains API history.
Provenance sources, when used, have `title` and HTTP(S) `url`. Do not invent sources.
For a verified arXiv HTML paper, an optional `"reader_url":"https://arxiv.org/html/2402.08954"`
on a Markdown Item enables the learner's private EPUB action. Use the exact
`arxiv.org/html` paper URL; the API fetches it on demand for the signed-in learner
and retains no converted file. Keep the paper's title and URL in provenance too.

Supported Markdown: paragraphs, `#` through `###` headings, bold/italic,
inline/fenced code, simple lists, blockquotes and HTTP(S) links. No raw HTML,
inline images, embeds, widgets or executable artifacts.

## Video, podcast and movie recommendations

Use `type: "video"`, `"podcast"` or `"movie"` with an additional required `url`
field. The URL must be HTTPS with no embedded credentials. Each recommendation
is its own Item; a tag alone does not select a media renderer. The Markdown body
contains your learning notes, not a copied transcript or media file. For example:

```markdown
---
{"id":"week-01-video","title":"A talk about the week's theme","purpose":"Connect the talk to this week's question","tags":["week-01"],"type":"video","url":"https://example.org/talk","provenance":{"text":"Original viewing guide; identify the creator and source honestly","sources":[{"title":"Official talk page","url":"https://example.org/talk"}]}}
---
Explain why this resource fits. Include a verified or clearly approximate time
budget, what to watch for, and a short reflection prompt.
```

The frontend shows a Video/Podcast/Movie card and an external Watch/Listen/Find
movie link alongside your notes. Playback takes place on the source website;
publication does not upload, embed or guarantee access to media. Prefer official
talk/episode/distributor pages and verify the exact title and URL. State access,
region, subscription or runtime uncertainty when relevant. A film information
page is not proof that the full movie is available to stream.

For mixed weekly content, preserve existing readings and their conditions, add
separate media Items with the same week tag, and keep the synthesis after the
resources it draws on. Follow the learner's requested mix and time budget;
an optional weekly movie stays optional. Keep recurring preferences in your own
existing Program/workspace context so later weeks can use them. If an existing
Ez schedule prepares the weeks, update that schedule's instructions when the
learner authorizes it; do not create a duplicate schedule or an app-side runner.

Up to 100 Items, 100,000 characters per body and
1 MB per published Program. Validation checks structure and authorization; it
cannot judge whether several activities were incorrectly bundled into one Item,
or certify truth or teaching quality. Verify the canonical Item IDs, titles,
order, declared media types, URLs and shared tags after publication, as well as
the receipt revision.

## Commands and source mount

Use `ez eztudy list` to discover published Programs and `ez eztudy show ID` to
read one from canonical app data. Use `ez eztudy check DIRECTORY` when validation
is useful; `ez eztudy publish DIRECTORY` validates before writing. Commands
require the installed scoped connection. Success returns JSON;
nonzero exit means failure. Do not retry by inventing a receipt or bypassing a 409.
The CLI keeps its publication receipt in private plugin storage for safe republish.
A 409 means another source changed the Program: inspect your source and the last
receipt with the owner before replacing content.

The installer binds your workspace read-only at `/state/source` **inside the CLI
container**. Write in your normal workspace; pass the corresponding mounted path:
files in `work/my-program` use `ez eztudy check /state/source/work/my-program`.
This mount publishes your authored files; it is not a second agent workspace.
Use an authorized Program ID; another ID returns 403. Do not read credentials or runtime
control files. API credentials live only in private plugin storage, not model text.

## Setup and recovery

Installation requires a verified Eztudy account and administrator-issued
Program-scoped publisher credential. The installing administrator configures the
API origin, allowed Program IDs and read-only workspace mount. Reuse that approved
connection; never broaden grants or choose another account from prompt text.
No provider login is required beyond the learner's existing Eztudy authentication.
If configuration or source access is missing, report the concrete missing binding.
Do not patch Ez, edit generated Compose, or replace native instructions to repair it.

After publication, use `ez eztudy show ID` for canonical readback and report the receipt.
The authenticated Timeline and reader must actually display the content. Ordinary
follow-up explanations must not edit source, publish or modify the Program.
