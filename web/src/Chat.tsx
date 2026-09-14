import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Icon } from './Icon'
import { usePrivy } from '@privy-io/react-auth'
import { apiUrl } from './config'

interface Turn {
  request_id: string
  text: string
  status: string
  messages: {id: string; text: string}[]
  attachment?: {name: string; size: number}
  created_at: string
  item_id?: string | null
}
const active = (turn: Turn) => !['completed', 'failed', 'cancelled'].includes(turn.status)

export function Chat({ programId, itemId }: { programId: string | null; itemId: string | null }) {
  const { getAccessToken } = usePrivy()
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const pending = useRef<{request_id: string; text: string; item_id: string | null; program_id: string | null; attachment?: {name: string; data: string}} | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const request = useCallback(async (path: string, body?: object) => {
    const token = await getAccessToken()
    if (!token) throw new Error('Please sign in again.')
    const response = await fetch(apiUrl('/api/chat' + path) + (!body && !path && programId ? '?program_id=' + encodeURIComponent(programId) : ''), {
      method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      ...(body ? {body: JSON.stringify(body)} : {}),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      throw Object.assign(new Error(typeof result.detail === 'string' ? result.detail : 'Chat is unavailable. Please try again.'), {status: response.status})
    }
    return response.json()
  }, [getAccessToken, programId])
  const refresh = useCallback(async () => {
    const result = await request('')
    setTurns(result.turns)
    setError(result.sync_error ?? '')
    setLoaded(true)
  }, [request])

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        if (!stopped) await refresh()
      } catch (failure) {
        if (!stopped) setError(failure instanceof Error ? failure.message : 'Could not check your reply.')
      } finally { if (!stopped) timer = setTimeout(poll, 3000) }
    }
    void poll()
    return () => { stopped = true; clearTimeout(timer) }
  }, [refresh])
  useEffect(() => {
    setFile(null)
    pending.current = null
    if (fileInput.current) fileInput.current.value = ''
  }, [programId])
  const transcriptSize = turns.reduce((count, turn) => count + 1 + turn.messages.length, 0)
  useEffect(() => { end.current?.scrollIntoView({behavior: 'smooth'}) }, [transcriptSize])

  async function submit(event?: FormEvent, retry?: Turn) {
    event?.preventDefault()
    if (sending || (!retry && !draft.trim() && !file)) return
    setSending(true); setError('')
    try {
      if (retry) {
        await request('/' + retry.request_id + '/retry', {})
      } else {
        if (!pending.current) {
          let attachment
          if (file) {
            const data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(String(reader.result).split(',')[1])
              reader.onerror = () => reject(new Error('Could not read this file.'))
              reader.readAsDataURL(file)
            })
            attachment = {name: file.name, data}
          }
          pending.current = {request_id: crypto.randomUUID(), text: draft, item_id: itemId, program_id: programId, ...(attachment ? {attachment} : {})}
        }
        await request('', pending.current)
      }
      pending.current = null; setDraft(''); setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      await refresh()
    } catch (failure) {
      if (failure instanceof Error && 'status' in failure && [413, 422].includes(Number(failure.status))) pending.current = null
      setError(failure instanceof Error ? failure.message : 'Could not send your message.')
      await refresh().catch(() => {})
    } finally { setSending(false) }
  }

  async function download(turn: Turn) {
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Please sign in again.')
      const response = await fetch(apiUrl('/api/chat/' + turn.request_id + '/attachment'), {headers: {Authorization: `Bearer ${token}`}, cache: 'no-store'})
      if (!response.ok) throw new Error('Could not download this attachment.')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url; link.download = turn.attachment!.name; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not download this attachment.')
    }
  }

  return <section className="chat-shell" aria-label="Coach">
    <section className="chat-messages" aria-label="Conversation" aria-live="polite">
      {!loaded ? <p className="status">Opening your conversation…</p> : turns.length === 0 && <div className="chat-empty">
        <p className="eyebrow">Start with a question</p><h1>What’s on your mind?</h1>
        <p>Explore an idea, ask a question, or talk through something you want to understand.</p>
      </div>}
      {turns.map(turn => <div className="chat-turn" key={turn.request_id}>
        <div className="message user-message">{turn.text}
          {turn.attachment && <button type="button" className="message-attachment" onClick={() => void download(turn)}><Icon name="attach" size={14} />{turn.attachment.name} · {Math.ceil(turn.attachment.size / 1024)} KB</button>}
        </div>
        {turn.messages.map(message => <p className="message assistant-message" key={message.id}>{message.text}</p>)}
        {active(turn) && <div className="turn-controls"><span role="status">{turn.status === 'submitting' ? 'Checking submission…' : 'Thinking…'}</span>
          {turn.status === 'submitting' ? <button onClick={() => void submit(undefined, turn)}>Retry same message</button>
            : <button onClick={() => void request('/' + turn.request_id + '/cancel', {}).then(refresh).catch(failure => setError(failure.message))}>Stop</button>}
        </div>}
        {['failed', 'cancelled'].includes(turn.status) && <p className="status-detail">{turn.status === 'cancelled' ? 'Stopped.' : 'This reply could not be completed.'}</p>}
        {turn.status === 'completed' && turn.messages.length === 0 && <p className="status-detail">The agent finished without delivering a reply.</p>}
      </div>)}
      <div ref={end} />
    </section>
    <form className="chat-composer" onSubmit={event => void submit(event)}>
      {error && <p className="error" role="alert">{error}</p>}
      {file && <div className="attachment-draft"><Icon name="attach" size={15} /><span><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024)} KB</small></span><button type="button" disabled={sending || !!pending.current} onClick={() => {setFile(null); if (fileInput.current) fileInput.current.value = ''}}>Remove</button></div>}
      <input ref={fileInput} className="composer-file-input" type="file" aria-label="Attach a file" accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.md,.markdown" disabled={sending || !!pending.current} onChange={event => {
        const selected = event.target.files?.[0] ?? null
        if (selected && (!/\.(jpe?g|png|webp|pdf|txt|md|markdown)$/i.test(selected.name) || selected.size === 0 || selected.size > 10 * 1024 * 1024)) {
          setError('Choose one nonempty JPEG, PNG, WebP, PDF, TXT or Markdown file up to 10 MB.')
          event.target.value = ''; setFile(null); return
        }
        setFile(selected); setError('')
      }} />
      <div className="composer-row"><button type="button" className="composer-attach" aria-label="Attach a file" title="Attach image, PDF or text" disabled={sending || !!pending.current} onClick={() => fileInput.current?.click()}><Icon name="attach" /></button><textarea aria-label="Message" placeholder="Ask your Coach…" rows={1} value={draft}
        disabled={sending || !!pending.current}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault();void submit()}}} />
        <button type="submit" aria-label={sending ? 'Sending…' : pending.current ? 'Retry' : 'Send'} title="Send" disabled={sending || !loaded || (!draft.trim() && !file)}><Icon name="right" /></button>
      </div>
    </form>
  </section>
}
