import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { ensureAccount, type Account } from './api'
import { PublishedSpace } from './PublishedSpace'

export function App() {
  const { ready, authenticated, login, logout, getAccessToken, user } = usePrivy()
  const [account, setAccount] = useState<{ subject: string; value: Account } | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const subject = user?.id

  useEffect(() => {
    setAccount(null)
    setError('')
    if (!ready || !authenticated || !subject) return
    const controller = new AbortController()
    void (async () => {
      try {
        const token = await getAccessToken()
        if (!token) throw new Error('Please sign out and sign in again.')
        const value = await ensureAccount(token, controller.signal)
        if (!controller.signal.aborted) setAccount({ subject, value })
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Sign-in failed.')
      }
    })()
    return () => controller.abort()
  }, [ready, authenticated, subject, getAccessToken, attempt])

  const currentAccount = account && account.subject === subject ? account.value : null
  const name = user?.google?.name?.split(' ')[0]
  const isLoading = !ready || (authenticated && !currentAccount && !error)

  if (authenticated && currentAccount) return <PublishedSpace key={currentAccount.id} identity={{name: user?.google?.name ?? undefined, email: user?.google?.email ?? undefined}} onSignOut={() => void logout()} />

  return (
    <main className="auth-gate">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand" aria-label="Eztudy"><span>eztudy</span><i aria-hidden="true" /></div>
        <div className="auth-copy">
          <p className="eyebrow">Your learning space</p>
          <h1 id="auth-title">{authenticated ? `Welcome${name ? `, ${name}` : ''}.` : 'Continue your path.'}</h1>
          <p>{authenticated
            ? 'A space for the things you want to understand deeply.'
            : 'One timeline, one Coach, and the work you want to return to.'}</p>
        </div>
        <div className="auth-actions">
          {isLoading ? <p className="status" role="status">Opening your learning space…</p>
            : !authenticated ? <>
              <button className="auth-google-button" onClick={() => login()}>
                <span className="auth-google-mark" aria-hidden="true">G</span>Continue with Google
              </button>
              <p className="auth-footnote">Your programs and conversations are private to your account.</p>
            </> : error ? <>
              <p role="alert" className="error">{error}</p>
              <button className="auth-google-button" onClick={() => setAttempt(value => value + 1)}>Try again</button>
            </> : <div className="account-confirmation">
              <span className="confirmation-mark" aria-hidden="true">✓</span>
              <h2>You’re signed in.</h2>
              <p>Your private account is ready. Your learning space starts here.</p>
              <p className="status-detail">Chat and learning content are coming next.</p>
            </div>}
          {authenticated && <button className="sign-out" onClick={() => void logout()}>Sign out</button>}
        </div>
      </section>
    </main>
  )
}
