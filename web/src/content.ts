/** Canonical publication view. Array order is authoritative; tags are labels. */
export interface Item {
  id: string
  title: string
  purpose: string
  tags: string[]
  content: { type: 'markdown'; markdown: string } | { type: 'video' | 'podcast' | 'movie'; url: string; markdown: string }
  provenance: { text: string; sources: { title: string; url: string }[] }
}
export const contentLabels = {
  markdown: { label: 'Readout', action: 'Read', link: '' },
  video: { label: 'Video', action: 'Watch', link: 'Watch video' },
  podcast: { label: 'Podcast', action: 'Listen', link: 'Listen to podcast' },
  movie: { label: 'Movie', action: 'Watch', link: 'Find movie' },
} as const
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
