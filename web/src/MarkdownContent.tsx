// Project-owned Markdown renderer; no HTML execution.
import { Fragment, type ReactNode } from 'react'

const inline = (text: string): ReactNode[] => text
  .split(/(\\\([\s\S]+?\\\)|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g)
  .filter(Boolean)
  .map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
    if (link) return <a key={`${index}-${part}`} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={`${index}-${part}`}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${index}-${part}`}>{part.slice(1, -1)}</code>
    }
    return part
  })

const listItems = (lines: string[]): string[] | undefined => {
  if (!/^[-*]\s+/.test(lines[0])) return undefined
  const items: string[] = []
  for (const line of lines) {
    if (/^[-*]\s+/.test(line)) items.push(line.replace(/^[-*]\s+/, ''))
    else if (/^\s+/.test(line) && items.length) items[items.length - 1] += ` ${line.trim()}`
    else return undefined
  }
  return items
}

const orderedListItems = (lines: string[]): string[] | undefined => {
  if (!/^\d+[.)]\s+/.test(lines[0])) return undefined
  const items: string[] = []
  for (const line of lines) {
    if (/^\d+[.)]\s+/.test(line)) items.push(line.replace(/^\d+[.)]\s+/, ''))
    else if (/^\s+/.test(line) && items.length) items[items.length - 1] += ` ${line.trim()}`
    else return undefined
  }
  return items
}


export function MarkdownContent({ markdown }: { markdown: string }) {
  const blocks = markdown.match(/```[^\n]*\n[\s\S]*?(?:\n```|$)|(?:[^\n]+(?:\n(?!\s*\n|```)[^\n]+)*)/g) ?? []
  return <div className="markdown-content">
      {blocks.map((block, blockIndex) => {
        const lines = block.split(/\r?\n/)
        if (lines[0].startsWith('```') && lines.at(-1)?.startsWith('```')) {
          return <pre key={`${blockIndex}-${block}`}><code>{lines.slice(1, -1).join('\n')}</code></pre>
        }
        const heading = lines[0].match(/^(#{1,3})\s+(.+)$/)
        if (heading) {
          const Heading = `h${Math.min(3, heading[1].length + 1)}` as 'h2' | 'h3'
          return (
            <Fragment key={`${blockIndex}-${block}`}>
              <Heading>{inline(heading[2])}</Heading>
              {lines.length > 1 ? <p>{inline(lines.slice(1).join(' '))}</p> : null}
            </Fragment>
          )
        }
        const items = listItems(lines)
        if (items) {
          return (
            <ul key={`${blockIndex}-${block}`}>
              {items.map((item) => <li key={item}>{inline(item)}</li>)}
            </ul>
          )
        }
        const orderedItems = orderedListItems(lines)
        if (orderedItems) {
          return (
            <ol key={`${blockIndex}-${block}`}>
              {orderedItems.map((item) => <li key={item}>{inline(item)}</li>)}
            </ol>
          )
        }
        if (lines.every((line) => /^>\s?/.test(line))) {
          return <blockquote key={`${blockIndex}-${block}`}>{inline(lines.map((line) => line.replace(/^>\s?/, '')).join(' '))}</blockquote>
        }
        return <p key={`${blockIndex}-${block}`} className={blockIndex === 0 ? 'lead' : undefined}>{inline(lines.join(' '))}</p>
      })}
  </div>
}
