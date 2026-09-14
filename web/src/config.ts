const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''

export function apiUrl(path: string): string {
  if (!path.startsWith('/api/')) throw new Error('API paths must start with /api/.')
  return configuredApiBase + path
}
