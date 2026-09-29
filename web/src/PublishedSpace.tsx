import { useCallback, useEffect, useRef, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { LearningSpace } from './LearningSpace'
import { Chat } from './Chat'
import type { ContentView } from './content'
import { apiUrl } from './config'

export function PublishedSpace({identity, onSignOut}: {
  identity: {name?: string; email?: string}; onSignOut: () => void
}) {
  const {getAccessToken} = usePrivy()
  const [content, setContent] = useState<ContentView | null>(null)
  const [error, setError] = useState('')
  const [selecting, setSelecting] = useState(false)
  const busy = useRef(false)
  const reading = useRef<Promise<ContentView> | null>(null)
  const request = useCallback(async (programId?: string) => {
    const token = await getAccessToken()
    if (!token) throw new Error('Please sign in again.')
    const response = await fetch(apiUrl('/api/content' + (programId ? '/selection' : '')), {
      method: programId ? 'POST' : 'GET', cache:'no-store',
      headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'},
      ...(programId ? {body:JSON.stringify({program_id:programId})} : {})
    })
    if (!response.ok) throw new Error('Your learning space could not refresh. Please try again.')
    return response.json() as Promise<ContentView>
  }, [getAccessToken])
  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {reading.current = request(); setContent(await reading.current); setError('')}
    catch (failure) {setError((failure as Error).message)}
    finally {busy.current = false; reading.current = null}
  }, [request])
  useEffect(() => {void refresh(); const timer = setInterval(() => void refresh(), 5000); return () => clearInterval(timer)}, [refresh])
  async function select(programId: string) {
    // Await an in-flight read before selecting; prevent an older result overwriting selection.
    setSelecting(true)
    await reading.current?.catch(() => {})
    busy.current = true
    try {setContent(await request(programId)); setError('')}
    catch (failure) {setError((failure as Error).message)}
    finally {busy.current = false; setSelecting(false)}
  }
  async function setCompletion(programId: string, itemId: string, completed: boolean) {
    await reading.current?.catch(() => {})
    busy.current = true
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Please sign in again.')
      const response = await fetch(apiUrl(`/api/content/programs/${encodeURIComponent(programId)}/items/${encodeURIComponent(itemId)}/completion`), {
        method: 'POST', cache: 'no-store',
        headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({completed}),
      })
      if (!response.ok) throw new Error('Completion could not be saved. Please try again.')
      setContent(await request())
      setError('')
    } finally { busy.current = false }
  }
  async function exportReaderEpub(programId: string, itemId: string) {
    const token = await getAccessToken()
    if (!token) throw new Error('Please sign in again.')
    const response = await fetch(apiUrl(`/api/content/programs/${encodeURIComponent(programId)}/items/${encodeURIComponent(itemId)}/private-epub`), {
      cache: 'no-store', headers: {Authorization: `Bearer ${token}`},
    })
    if (!response.ok) throw new Error('The arXiv HTML paper could not be prepared as an EPUB right now.')
    return response.blob()
  }
  if (!content || selecting) return <main className="timeline-empty"><p className="status" role="status">{error || (selecting ? 'Opening Program…' : 'Opening your learning space…')}</p>{error && <button onClick={() => void refresh()}>Try again</button>}</main>
  return <LearningSpace notice={error} content={content} identity={identity} onSignOut={onSignOut} onSelectProgram={id => void select(id)} onSetCompletion={setCompletion} onExportReaderEpub={exportReaderEpub}
    coach={itemId => <Chat key={content.selected_program_id ?? 'general'} programId={content.selected_program_id} itemId={itemId} />} />
}
