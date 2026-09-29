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

A Program has one flat sequence. An Item is one independently openable reading,
resource, exercise or synthesis activity. Separate activities have separate IDs,
files, titles, bodies and provenance. A body may contain several sections about
its one activity; a collection of activities belongs in the Program sequence.

Week, session, subject and other groupings are optional shared tags, not parents,
container Items, folders or required navigation. Three readings and a synthesis
for Week 1 therefore produce four Items tagged `week-01`, not one "Week 1" Item
with four sections. Keep a condition with the activity it qualifies and shared
context in the Program purpose. Tags describe content; declared content fields
select its renderer. No prescribed curriculum or learning modes.

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
Identity, grants and learner position remain API-owned; conversation runs remain
canonical in Ez. Native agent context and sessions remain native; none of these
are a second agent memory.

## Flow and CLI

```text
Learner request → native agent researches / writes / generates / codes
               → Markdown and assets
               → Eztudy check / publish → canonical API → frontend
```

The installed CLI is the agent's only app content surface:

- `eztudy list` / `eztudy show <program-id>`: read authorized published content.
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
| Set up Week 1 with three readings and a synthesis | Writes four separate Items with a shared `week-01` tag | Publishes four individually openable Items in the requested order |
| Group these as session one | Adds a shared tag in the source | Displays the published tags; no Session object |

## Supported content

Support Markdown readouts and linked video, podcast and movie recommendations.
Media Items have `content: {type, url, markdown}`; their source metadata has
`type` and `url`, with the Markdown notes as the document body. Readouts retain
`content: {type: "markdown", markdown}` and need no migration. Reject other types.

| Content | Author supplies | Publishing boundary |
| --- | --- | --- |
| Readout | Markdown and provenance | Validate fields/references; render safely |
| Video / podcast / movie | HTTPS URL, Markdown learning notes and provenance | Validate declared type and URL; show a labeled external source link and notes |
| Image | Referenced image and description | Future asset format/access contract |
| Interactive widget or game | Description and agent-authored artifact | Deferred until an explicit isolation and rendering contract exists |

Each media recommendation is one independently openable Item. URLs require a
host and reject credentials, whitespace and non-HTTPS schemes. The app does not
fetch, host, autoplay or embed external media. The source website owns playback
and access; movie links may be official information pages, without promising
streaming availability. Research and link verification belong to the agent.
Preserve the learner's requested weekly mix in agent-authored Program context;
existing Ez schedules may reuse it, with no scheduling logic in the app/plugin.

Validation checks structure, supported types, references and access. Item
granularity is an authoring contract: validation cannot infer how many activities
a Markdown body contains from its title, headings or tags. Do not add title/tag
heuristics to reject valid content. Acceptance checks the canonical Item list
against the learner's requested activities, shared labels and order; a valid
receipt alone does not establish correct structure. Validation also does not
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
