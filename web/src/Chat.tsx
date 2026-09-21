import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { Icon } from './Icon'
import { MarkdownContent } from './MarkdownContent'
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

function formatElapsed(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(whole / 60)
  return minutes > 0 ? `${minutes}m ${String(whole % 60).padStart(2, '0')}s` : `${whole}s`
}

function ThinkingStatus({ startedAt }: { startedAt?: string }) {
  const origin = useRef((startedAt && Number.isFinite(Date.parse(startedAt)) ? Date.parse(startedAt) : Date.now()))
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.floor((Date.now() - origin.current) / 1000)))
  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - origin.current) / 1000)))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <span className="thinking-status" role="timer" aria-label={`Coach is thinking: ${elapsed}s`}>
      <span className="thinking-status-label" aria-hidden="true">Thinking</span>
      <span className="thinking-status-divider" aria-hidden="true">·</span>
      <span className="thinking-seconds" aria-hidden="true">{formatElapsed(elapsed)}</span>
    </span>
  )
}

export function Chat({ programId, itemId }: { programId: string | null; itemId: string | null }) {
  const { getAccessToken } = usePrivy()
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const pending = useRef<{request_id: string; text: string; item_id: string | null; program_id: string | null; attachment?: {name: string; data: string}} | null>(null)
  const chatBody = useRef<HTMLDivElement>(null)
  const sentOnTouch = useRef(false)
  const request = useCallback(async (path: string, payload?: object) => {
    const token = await getAccessToken()
    if (!token) throw new Error('Please sign in again.')
    const response = await fetch(apiUrl('/api/chat' + path) + (!payload && !path && programId ? '?program_id=' + encodeURIComponent(programId) : ''), {
      method: payload ? 'POST' : 'GET', cache: 'no-store',
      headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      ...(payload ? {body: JSON.stringify(payload)} : {}),
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
  const updateScrollButton = useCallback(() => {
    const node = chatBody.current
    if (!node) { setShowScrollToBottom(false); return }
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight
    setShowScrollToBottom(node.scrollHeight > node.clientHeight + 24 && distance > 96)
  }, [])
  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const node = chatBody.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior })
    setShowScrollToBottom(false)
  }, [])
  useEffect(() => { scrollToLatest('smooth') }, [transcriptSize, scrollToLatest])

  const busy = sending || !!pending.current
  const canSend = !busy && loaded && (!!draft.trim() || !!file)

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

  function sendFromClick() {
    if (sentOnTouch.current) { sentOnTouch.current = false; return }
    if (!canSend) return
    void submit()
  }
  function sendFromPointer(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse' || !canSend) return
    event.preventDefault()
    sentOnTouch.current = true
    void submit()
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

  return <section className="chat-window" aria-label="Coach">
    <div className="chat-body" ref={chatBody} onScroll={updateScrollButton} aria-label="Conversation" aria-live="polite">
      {!loaded ? <p className="status">Opening your conversation…</p> : turns.length === 0 && <div className="chat-empty message-stack ai-stack">
        <span className="message-avatar" aria-hidden="true">AI</span>
        <div className="message ai"><p>Start a conversation with Coach...</p></div>
      </div>}
      {turns.map(turn => <div className="chat-turn" key={turn.request_id}>
        <div className="message-stack user-stack">
          <div className="message user">{turn.text}
            {turn.attachment && <button type="button" className="message-attachment" onClick={() => void download(turn)}><Icon name="attach" size={14} />{turn.attachment.name} · {Math.ceil(turn.attachment.size / 1024)} KB</button>}
          </div>
        </div>
        {turn.messages.map(message => <div className="message-stack ai-stack" key={message.id}>
          <span className="message-avatar" aria-hidden="true">AI</span>
          <div className="message ai"><MarkdownContent markdown={message.text} /></div>
        </div>)}
        {active(turn) && <div className="message-stack ai-stack">
          <span className="message-avatar" aria-hidden="true">AI</span>
          <div className="message ai thinking">
            <div className="turn-controls">
              {turn.status === 'submitting' ? <span role="status">Checking submission…</span> : <ThinkingStatus startedAt={turn.created_at} />}
              {turn.status === 'submitting'
                ? <button type="button" onClick={() => void submit(undefined, turn)}>Retry</button>
                : <button type="button" onClick={() => void request('/' + turn.request_id + '/cancel', {}).then(refresh).catch(failure => setError(failure.message))}>Stop</button>}
            </div>
          </div>
        </div>}
        {['failed', 'cancelled'].includes(turn.status) && <p className="status-detail">{turn.status === 'cancelled' ? 'Stopped.' : 'This reply could not be completed.'}</p>}
        {turn.status === 'completed' && turn.messages.length === 0 && <p className="status-detail">The agent finished without delivering a reply.</p>}
      </div>)}
    </div>
    {showScrollToBottom ? <button className="chat-scroll-bottom" type="button" onClick={() => scrollToLatest()} aria-label="Jump to latest message" title="Jump to latest message"><Icon name="down" /></button> : null}
    <form className="chat-composer" onSubmit={event => void submit(event)}>
      {error && <p className="error" role="alert">{error}</p>}
      {file && <div className="attachment-draft"><Icon name="attach" size={15} /><span><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024)} KB</small></span><button type="button" disabled={busy} onClick={() => {setFile(null); if (fileInput.current) fileInput.current.value = ''}}>Remove</button></div>}
      <input ref={fileInput} className="composer-file-input" type="file" aria-label="Attach a file" accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.md,.markdown" disabled={busy} onChange={event => {
        const selected = event.target.files?.[0] ?? null
        if (selected && (!/\.(jpe?g|png|webp|pdf|txt|md|markdown)$/i.test(selected.name) || selected.size === 0 || selected.size > 10 * 1024 * 1024)) {
          setError('Choose one nonempty JPEG, PNG, WebP, PDF, TXT or Markdown file up to 10 MB.')
          event.target.value = ''; setFile(null); return
        }
        setFile(selected); setError('')
      }} />
      <div className="chat-input">
        <button type="button" className="composer-attach" aria-label="Attach a file" title="Attach image, PDF or text" disabled={busy} onClick={() => fileInput.current?.click()}><Icon name="attach" /></button>
        <textarea aria-label="Message" placeholder="Message" rows={1} value={draft} disabled={busy}
          autoCorrect="off" autoCapitalize="off" autoComplete="off" spellCheck={false} enterKeyHint="send"
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault(); if (!busy) void submit()}}} />
        <button className="chat-send" type="button" onPointerDown={sendFromPointer} onClick={sendFromClick} disabled={!canSend} aria-label={sending ? 'Sending…' : pending.current ? 'Retry' : 'Send'} title="Send"><Icon name="send" size={24} /></button>
      </div>
    </form>
  </section>
}
