import { apiUrl } from './config'

export interface Account {
  id: string
  tenant_id: string
  created_at: string
}

export async function ensureAccount(token: string, signal: AbortSignal): Promise<Account> {
  const response = await fetch(apiUrl('/api/account'), {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal,
  })
  if (!response.ok) {
    throw new Error(response.status === 401
      ? 'Please sign out and sign in again.'
      : response.status === 403
        ? 'This Eztudy installation is invite-only.'
        : 'We couldn’t open your learning space. Please try again.')
  }
  return response.json()
}
