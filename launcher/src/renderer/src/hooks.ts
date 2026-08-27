import { useEffect } from 'react'

// Ohne das bleiben Dialoge nur über den X-Knopf schließbar, und Escape fällt
// durch auf die Bibliothek dahinter (siehe App.tsx: dort wird deshalb auch
// separat verhindert, dass Pfeiltasten/Enter/Entf durchschlagen).
export function useEscapeToClose(onClose: () => void): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
}
