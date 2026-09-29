import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const sourceCommit = () => {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try { return execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim() }
  catch { return '' }
}

export default defineConfig(({command}) => ({
  plugins: [react()],
  define: {
    __EZTUDY_BUILD__: JSON.stringify(command === 'build'
      ? {sha: sourceCommit().slice(0, 7), time: new Date().toISOString()}
      : null),
  },
  server: { proxy: { '/api': process.env.EZTUDY_API_PROXY || 'http://127.0.0.1:8111' } },
}))
