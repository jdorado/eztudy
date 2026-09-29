# Content view

`web/src/content.ts` defines the small presentation contract.
It is a read-only view of the canonical published content, not an authoring
schema or a browser-owned learner store.

```text
ContentView
  programs: Program[]
  selected_program_id: string | null

Program
  id: stable string
  title: string
  purpose: string
  items: Item[]                 # canonical published order

Item
  id: stable string
  title: string
  purpose: string
  tags: string[]               # descriptive labels, no parent relationships
  content: { type: "markdown", markdown: string }
  provenance: { text: string, sources: [{ title: string, url: string }] }
```

Only referenced Items belong in `Program.items`; drafts are never included.
`session-1`, `foundations` and `video` are labels, never routing entities or
renderer instructions. Only declared supported content selects rendering.
No completion/current-position state is invented from array order or opening
an Item. Reading and next/back navigation do not mutate learner progress.

An authenticated API response supplies this view, resolving both ownership
and selected Program server-side. Selection must be persisted by that API before
replacing the view and changing the selected Program's chat scope.
The present component callback is a presentation seam, not authority. Stable
publication revision and receipt metadata must accompany canonical persistence;
they are not fabricated by this UI. In-progress selection and failed reads must
not fall back to another Program's content or Coach.

The source syntax, validation rules, receipts and endpoints are documented in
[Markdown publishing](markdown-publishing.md). No Session/Course intermediate contract is implied here.

## Markdown presentation

Reuses the original small readout renderer: paragraphs, headings (`#` through
`###`), emphasis, inline code, fenced code, simple ordered/unordered lists,
blockquotes and HTTP(S) links. Blank lines inside fenced code are preserved.
Raw HTML is escaped by React. Images, embeds, JavaScript, math rendering and
interactive widgets are not enabled. This is a deliberately small Markdown
subset, not a claim of complete CommonMark support. Server validation and authoring
instructions must describe supported content without guessing media renderers.

## Isolated visual QA

Open `/qa/preview.html` on the development server. It imports presentation
components and original MIT-licensed sample prose only. It imports no Privy,
account API, learner store or live Chat component. A persistent banner identifies
it as unpublished layout content. Program selection is ephemeral React state
only in that preview. The entry is not included in the production Vite build.
Never use its example text or preview selection as account data or a receipt.
