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
  completed_item_ids: string[]
}

/** A shared first tag labels consecutive Items without changing published order. */
export function timelineSections(items: Item[]) {
  const sections: { tag: string | null; start: number; items: Item[] }[] = []
  items.forEach((item, index) => {
    const tag = item.tags[0] ?? null
    const previous = sections[sections.length - 1]
    if (previous && previous.tag === tag) previous.items.push(item)
    else sections.push({tag, start: index, items: [item]})
  })
  return sections
}

export function sectionLabel(tag: string) {
  const label = tag.replace(/[-_]/g, ' ').replace(/\b0+(\d+)\b/g, '$1')
  return label.charAt(0).toUpperCase() + label.slice(1)
}
