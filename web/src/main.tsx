import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const root = createRoot(document.getElementById('app')!)

// This standalone game has transient local profiles and downloadable saves.
// Keep it separate from the authenticated app and canonical learner records.
if (window.location.pathname.replace(/\/$/, '') === '/games/makeover-maths') {
  void import('./games/makeover/MakeoverMaths').then(({ MakeoverMaths }) => {
    root.render(<StrictMode><MakeoverMaths /></StrictMode>)
  })
} else {
  const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim()
  if (!appId) throw new Error('Configure VITE_PRIVY_APP_ID in web/.env.local.')
  void Promise.all([import('@privy-io/react-auth'), import('./App'), import('./style.css')]).then(([{ PrivyProvider }, { App }]) => {
    root.render(
      <StrictMode>
        <PrivyProvider appId={appId} config={{
          loginMethods: ['google'],
          appearance: { theme: 'light', accentColor: '#234cdd' },
          externalWallets: { disableAllExternalWallets: true, walletConnect: { enabled: false } },
          embeddedWallets: {
            ethereum: { createOnLogin: 'off' }, solana: { createOnLogin: 'off' }, showWalletUIs: false,
          },
        }}><App /></PrivyProvider>
      </StrictMode>,
    )
  })
}
