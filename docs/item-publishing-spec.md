# Eztudy Item publishing

Status: initial publishing contract.

Eztudy is a publishing and presentation system for learning content. Its plugin
teaches the agent the file conventions; its CLI validates and publishes those
files. It does not operate the agent.

## Model and source

```text
Program = purpose + ordered Item references
Item = stable ID + title + tags + declared content + provenance
```

A Program has one flat sequence. Session, subject and other groupings are optional
tags, not parents, folders or required navigation. Tags describe content; declared
content fields select its renderer. No prescribed curriculum or learning modes.

Reuse the original UI/UX concepts and visual components, never its legacy data
model, stores, API payloads or CLI schemas. Adapt those components to this flat
model. Labels such as `video`, `session-1` or `foundations` provide presentation
and grouping context without creating entities or nesting. A supported content
type and its required fields determine rendering; a label alone cannot enable
unsupported media or executable content. The CLI validates and publishes this
same Program/Item sequence and metadata, with no Session/Course CRUD or compiler
intermediate hierarchy.

```text
computer-science/
  program.md               # purpose and ordered Item references
  items/computation.md     # Item metadata and Markdown body
  assets/                  # referenced assets, when supported
```

Markdown/assets are the authoring source. Only Items explicitly referenced by the
Program enter its published sequence; other files may remain drafts. The API
stores the validated published version, order and tags, plus publication receipts.
Identity, grants, learner position and UI transcripts remain API-owned. Native
agent context and sessions remain native; none of these are a second agent memory.

## Flow and CLI

```text
Learner request → native agent researches / writes / generates / codes
               → Markdown and assets
               → Eztudy check / publish → canonical API → frontend
```

Two operations suffice initially (command spelling to reuse existing CLI methods):

- `eztudy check <program-directory>`: validate without publishing.
- `eztudy publish <program-directory>`: validate again, persist an authorized
  published revision and return its receipt. The frontend renders that revision.

Create, edit, tag and reorder by editing the source and publishing. No separate
agent workflows or CRUD commands are needed initially. Removing a reference is
an explicit removal from the active sequence, not deletion of learner history.
Reject invalid or unauthorized publication without changing the visible revision;
retries must not duplicate Items. Never claim publication from chat or draft files.

| Learner asks | Native agent does | Eztudy does |
| --- | --- | --- |
| Help me learn computer science | Clarifies only missing needs; writes Program direction and first useful Items | Checks and publishes the requested material |
| Explain this | Uses native context and the visible Item reference; answers | Displays the reply; no content mutation |
| Add a simpler introduction | Writes an Item and inserts its reference | Publishes the revised sequence |
| Group these as session one | Adds a shared tag in the source | Displays the published tags; no Session object |

## Supported content

Start with Markdown readouts only. Keep the Item model extensible, but reject
unsupported content rather than guessing a renderer or adding a framework now.

| Potential content | Author supplies | Publishing boundary |
| --- | --- | --- |
| Readout | Markdown and provenance | Validate fields/references; render safely |
| Video | Description, URL and provenance | Future supported URL/embed contract |
| Image | Referenced image and description | Future asset format/access contract |
| Interactive widget or game | Description and agent-authored artifact | Deferred until an explicit isolation and rendering contract exists |

Validation checks structure, supported types, references and access. It does not
certify teaching quality, factual truth, external availability or arbitrary code
safety. Markdown must not become an executable HTML/JavaScript escape hatch.

## Hard boundary: publishing, never agent execution

- Native engine owns reasoning, context, sessions, research, generation, coding,
  tool choice, goals, delegation and continuation. Ez retains its existing
  admission, scheduling, cancellation and transport responsibilities unchanged.
- Plugin instructions explain authoring conventions and supported CLI operations.
  They do not replace native prompts/context or prescribe a fixed teaching loop.
- CLI/API own deterministic validation, authorized persistence and receipts;
  frontend owns rendering. No model calls, agent runner, execution queue,
  automatic curriculum adaptation, source scouting or generation inside the CLI.
- No mandatory `context` dump or transcript replay. Pass visible Program/Item
  references with requests. Add a scoped read only for a demonstrated API-owned
  fact unavailable from native context/files; never rebuild native memory.
- Backend derives actor, tenant and resource permissions from authenticated
  authority, never prompt text or Markdown. Ordinary tutoring is read-only;
  content mutations require an explicit authorized request. Credentials and
  native session paths never enter content or the frontend.
- Do not port legacy Session/Course hierarchies, mode controls, fixtures or
  app-owned runtimes. If a capability needs an Ez behavior change, stop and flag
  the boundary conflict before implementing it.

## Implementation gate

This definition replaces the content hierarchy `Program → Session → Item` with
`Program → Item` and removes a mandatory context-read requirement. Legacy Session
publication procedures must not be restored. Native conversation sessions are
unrelated and unchanged.

The initial sequence starts with Markdown only; it does not authorize media,
widgets, app-owned generation, or changes to Ez. Acceptance requires actual
frontend readback and evidence that native execution ownership remains intact.
