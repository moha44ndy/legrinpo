'use client'

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#0a0e27',
        color: '#e0e0e0',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>Hors ligne</h1>
      <p style={{ marginBottom: 24, opacity: 0.9 }}>
        Vous n’êtes pas connecté à Internet. Réessayez lorsque le réseau sera disponible.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: '12px 24px',
          background: '#1a237e',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: '1rem',
        }}
      >
        Réessayer
      </button>
    </main>
  )
}
