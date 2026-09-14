import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import { App } from './App'
import './style.css'

const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim()
if (!appId) throw new Error('Configure VITE_PRIVY_APP_ID in web/.env.local.')

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <PrivyProvider appId={appId} config={{
      loginMethods: ['google'],
      appearance: { theme: 'light', accentColor: '#234cdd' },
      externalWallets: { disableAllExternalWallets: true, walletConnect: { enabled: false } },
      embeddedWallets: {
        ethereum: { createOnLogin: 'off' }, solana: { createOnLogin: 'off' }, showWalletUIs: false,
      },
    }}>
      <App />
    </PrivyProvider>
  </StrictMode>,
)
