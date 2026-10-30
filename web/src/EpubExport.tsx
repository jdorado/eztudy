import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Item } from './content'

export type EpubInput =
  | {kind: 'item'; programId: string; itemId: string}
  | {kind: 'text'; title: string; markdown: string}
  | {kind: 'article'; url: string; title: string}

export function EpubExport({item, programId, onExport, onClose}: {
  item?: Item; programId?: string
  onExport?: (input: EpubInput) => Promise<Blob>
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [kind, setKind] = useState<EpubInput['kind']>(item?.reader_url ? 'article' : item ? 'item' : 'text')
  const [title, setTitle] = useState(item?.reader_url ? item.title : '')
  const [markdown, setMarkdown] = useState('')
  const [url, setUrl] = useState(item?.reader_url ?? item?.provenance.sources[0]?.url ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [downloadUrl, setDownloadUrl] = useState('')
  useEffect(() => {dialog.current?.showModal()}, [])
  useEffect(() => {
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setDownloadUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  let canShare = false
  try {canShare = !!file && !!navigator.share && !!navigator.canShare?.({files: [file]})} catch { /* Download remains available. */ }

  async function generate(event: FormEvent) {
    event.preventDefault()
    if (!onExport || busy) return
    setBusy(true)
    setError('')
    try {
      const input: EpubInput = kind === 'item' && item && programId
        ? {kind, programId, itemId: item.id}
        : kind === 'article' ? {kind, url: url.trim(), title: title.trim()}
        : {kind: 'text', title: title.trim(), markdown}
      const blob = await onExport(input)
      const name = kind === 'item' ? `${item!.title} — notes` : title.trim() || 'Web article'
      const filename = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 150) || 'Reading'
      setFile(new File([blob], `${filename}.epub`, {type: 'application/epub+zip'}))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not prepare the EPUB. Please try again.')
    } finally {setBusy(false)}
  }
  async function share() {
    if (!file) return
    setError('')
    try {await navigator.share({files: [file], title: file.name.replace(/\.epub$/, '')})}
    catch (failure) {
      if (!(failure instanceof DOMException && failure.name === 'AbortError')) setError('Sharing is unavailable. Download the EPUB and use Send to Kindle below.')
    }
  }
  return <dialog ref={dialog} className="epub-dialog" aria-labelledby="epub-title" onCancel={onClose} onClick={event => {if (event.target === dialog.current) onClose()}}>
    <header><h2 id="epub-title">EPUB for Kindle</h2><button type="button" className="epub-close" onClick={onClose} aria-label="Close EPUB export">×</button></header>
    {file ? <div className="epub-ready">
      <p role="status">Your EPUB is ready.</p><p className="epub-filename">{file.name}</p>
      <div className="epub-delivery">
        <a className="epub-primary" href={downloadUrl || undefined} download={file.name}>Download EPUB</a>
        {canShare && <button type="button" onClick={() => void share()}>Share…</button>}
      </div>
      <p>Download the file, then add it to your library with <a href="https://www.amazon.com/sendtokindle" target="_blank" rel="noreferrer">Send to Kindle</a>. On a phone, you can also choose Kindle from Share.</p>
      <button className="epub-again" onClick={() => {setFile(null); setDownloadUrl(''); setError('')}}>Create another EPUB</button>
    </div> : <form onSubmit={event => void generate(event)}>
      <p>Turn your writing or a web article into a book you can read on Kindle.</p>
      <fieldset disabled={busy}>
        <label>Content<select value={kind} onChange={event => {setKind(event.target.value as EpubInput['kind']); setError('')}}>
          {item && <option value="item">Item text and notes only</option>}
          <option value="text">My text</option><option value="article">Web article</option>
        </select></label>
        {kind === 'item' ? <p className="epub-item">{item?.title}<small>Exports the text shown in EzStudy. To include a linked article, choose Web article.</small></p> : <>
          {kind === 'article' && <>
            <label>Article URL<input type="url" required maxLength={2000} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" autoComplete="url" /></label>
            {!!item?.provenance.sources.length && <label>Or choose an item source<select value="" onChange={event => setUrl(event.target.value)}><option value="" disabled>Choose a source…</option>{item.provenance.sources.map(source => <option key={source.url} value={source.url}>{source.title}</option>)}</select></label>}
            <small>Public articles: text, headings and links. For a page that needs sign-in, choose My text and paste the article.</small>
          </>}
          <label>{kind === 'article' ? 'Title (optional)' : 'Title'}<input required={kind === 'text'} maxLength={200} value={title} onChange={event => setTitle(event.target.value)} placeholder={kind === 'article' ? 'Use the article title' : 'Name your reading'} /></label>
          {kind === 'text' && <label>Your text<textarea required maxLength={100000} rows={8} value={markdown} onChange={event => setMarkdown(event.target.value)} placeholder="Paste or write here. Markdown formatting is supported." /></label>}
        </>}
        <button className="epub-primary" type="submit" disabled={!onExport}>{busy ? 'Preparing EPUB…' : 'Create EPUB'}</button>
      </fieldset>
      {busy && <p role="status">Preparing your reading…</p>}
      {!onExport && <p>Sign in to create an EPUB. This is a layout preview.</p>}
    </form>}
    {error && <p className="reader-error" role="alert">{error}</p>}
  </dialog>
}
