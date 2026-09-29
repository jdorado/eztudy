import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { MarkdownContent } from './MarkdownContent'
import type { ContentView } from './content'
import { contentLabels } from './content'
import './learning.css'

/** Presentation built from the project-owned TimelineScreen and shared element shell.
 * No learner store, entity hierarchy or native execution behavior is imported. */
export function LearningSpace({ content, coach, identity, onSignOut, onSelectProgram, notice, preview = false }: {
  content: ContentView
  coach: ReactNode | ((itemId: string | null) => ReactNode)
  identity: { name?: string; email?: string }
  onSignOut?: () => void
  onSelectProgram?: (id: string) => void
  preview?: boolean
  notice?: string
}) {
  const [tab, setTab] = useState<'timeline' | 'coach'>('timeline')
  const [itemId, setItemId] = useState<string | null>(null)
  const profile = useRef<HTMLDialogElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const program = content.programs.find(value => value.id === content.selected_program_id)
  const item = program?.items.find(value => value.id === itemId)
  useEffect(() => { setItemId(null) }, [content.selected_program_id])
  useEffect(() => {
    panel.current?.scrollTo(0, 0)
    if (itemId) panel.current?.querySelector<HTMLElement>('h1')?.focus({preventScroll: true})
  }, [itemId, content.selected_program_id])
  const closeReader = () => {
    const previous = itemId
    setItemId(null)
    requestAnimationFrame(() => {
      const cards = panel.current?.querySelectorAll<HTMLButtonElement>('.timeline-card')
      const index = program?.items.findIndex(value => value.id === previous) ?? -1
      cards?.[index]?.focus({preventScroll: true})
    })
  }
  const choose = (id: string) => { onSelectProgram?.(id); profile.current?.close(); setTab('timeline'); setItemId(null) }
  return <div className="learning-root">
    {notice && <aside className="content-notice" role="alert">{notice}</aside>}
    {preview && <aside className="preview-banner">Layout preview · original sample text · not published account content</aside>}
    <div className="focus-shell" data-view={tab}>
      <div className="focus-header-stack">
        <header className="focus-header">
          <button className="focus-brand" onClick={() => {setTab('timeline'); setItemId(null)}} aria-label="Open timeline">eztudy</button>
          <div className="focus-header-actions">
            <nav className="focus-view-nav" aria-label="Primary views">
              <button className={tab === 'timeline' ? 'is-active' : ''} aria-label="Timeline" title="Timeline" aria-current={tab === 'timeline' ? 'page' : undefined} onClick={() => setTab('timeline')}><Icon name="play" /></button>
              <button className={tab === 'coach' ? 'is-active' : ''} aria-label="Coach" title="Coach" aria-current={tab === 'coach' ? 'page' : undefined} onClick={() => setTab('coach')}><Icon name="ask" /></button>
            </nav>
            <button className="focus-profile-button" aria-label="Profile and Programs" title="Profile and Programs" aria-haspopup="dialog" onClick={() => profile.current?.showModal()}><Icon name="menu" size={18} /></button>
          </div>
        </header>
        <div className="focus-program-strip"><span className="focus-program-name">{program?.title ?? 'Your learning space'}</span></div>
      </div>
      <main className="focus-main">
        <div ref={panel} className="focus-panel" hidden={tab !== 'timeline'}>
          {item && program ? <article className="element-screen">
            <div className="reader-toolbar"><button className="focus-back" onClick={closeReader}><Icon name="left" size={14} />Back to Timeline</button></div>
            <header className="element-header"><p className="eyebrow">{contentLabels[item.content.type].label}</p>
              <h1 tabIndex={-1}>{item.title}</h1><p className="element-purpose">{item.purpose}</p>
              {item.tags.length > 0 && <ul className="item-tags" aria-label="Tags">{item.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}
            </header>
            {item.content.type !== 'markdown' && <div className="media-resource">
              <a href={item.content.url} target="_blank" rel="noreferrer">{contentLabels[item.content.type].link} <Icon name="right" size={16} /></a>
              <span>Opens on {new URL(item.content.url).hostname}. {item.content.type === 'movie' ? 'Availability and access vary by region.' : 'Opens in a new tab.'}</span>
            </div>}
            <div className="media-reading"><MarkdownContent markdown={item.content.markdown} /></div>
            <aside className="item-provenance" aria-label="Provenance"><p>{item.provenance.text}</p>{item.provenance.sources.length > 0 && <ul>{item.provenance.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>}</aside>
            <nav className="reader-navigation" aria-label="Item navigation">
              <button className="focus-back" onClick={closeReader}>Back to Timeline</button>
              {program.items[program.items.indexOf(item) + 1] && <button className="reader-next" aria-label="Next Item" onClick={() => setItemId(program.items[program.items.indexOf(item) + 1].id)}><Icon name="right" /></button>}
            </nav>
          </article> : program?.items.length ? <section className="timeline-screen" aria-label="Your learning timeline">
            <p className="program-purpose">{program.purpose}</p>
            <ol className="timeline-list">{program.items.map((value, index) => <li key={value.id} className="timeline-row">
              <button className="timeline-card" onClick={() => setItemId(value.id)} aria-label={`${contentLabels[value.content.type].action}: ${value.title}`}>
                <span className="timeline-node" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="timeline-card-copy"><span className="timeline-meta">{contentLabels[value.content.type].label}{value.tags.length ? ` · ${value.tags.join(' · ')}` : ''}</span><strong>{value.title}</strong><span className="timeline-outcome">{value.purpose}</span></span>
                <span className="timeline-state">{contentLabels[value.content.type].action} <Icon name="right" size={12} /></span>
              </button>
            </li>)}<li className="timeline-add-row">
              <button className="timeline-add-item" onClick={() => setTab('coach')} aria-label="Ask Coach for the next item">
                <span className="timeline-add-node" aria-hidden="true">+</span>
                <span>Next item</span>
              </button>
            </li></ol>
          </section> : <section className="timeline-empty"><p className="eyebrow">Timeline</p><h1>Your next idea starts here.</h1><p>{program ? 'This Program has no published Items.' : 'No published Programs yet.'} Your published Items will appear here in order.</p><button className="empty-coach" onClick={() => setTab('coach')}>Open Coach <Icon name="right" size={16} /></button></section>}
        </div>
        <div className="focus-panel focus-coach-panel" hidden={tab !== 'coach'}>{typeof coach === 'function' ? coach(item?.id ?? null) : coach}</div>
      </main>
      <dialog ref={profile} className="focus-profile" aria-label="Profile" onClick={event => {if (event.target === profile.current) profile.current?.close()}}>
        <div className="profile-content"><header><p className="eyebrow">Profile</p><button aria-label="Close Profile" onClick={() => profile.current?.close()}>×</button></header>
          <strong>{identity.name ?? 'Your account'}</strong>{identity.email && <p>{identity.email}</p>}
          <section className="focus-program-picker" aria-label="Programs"><p className="eyebrow">Programs</p>
            {content.programs.length === 0 && <p>No published Programs yet.</p>}
            {content.programs.map(value => <button key={value.id} className="focus-program-select" aria-pressed={program?.id === value.id} onClick={() => choose(value.id)}><span><strong>{value.title}</strong><small>{value.purpose}</small></span>{program?.id === value.id && <Icon name="check" size={16} />}</button>)}
          </section>
          {preview ? <p className="status-detail">Preview selection resets on reload. Coach here is visual-only.</p> : onSignOut && <button className="sign-out" onClick={onSignOut}>Sign out</button>}
        </div>
      </dialog>
    </div>
  </div>
}
