/** Canonical publication view. Array order is authoritative; tags are labels. */
export interface Item {
  id: string
  title: string
  purpose: string
  tags: string[]
  content: { type: 'markdown'; markdown: string }
  provenance: { text: string; sources: { title: string; url: string }[] }
}
export interface Program {
  id: string
  title: string
  purpose: string
  items: Item[]
}
export interface ContentView {
  programs: Program[]
  selected_program_id: string | null
}
