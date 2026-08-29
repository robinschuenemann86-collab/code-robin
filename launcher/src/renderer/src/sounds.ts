// Kurze, synthetisch per Web Audio API erzeugte Töne statt Audio-Dateien —
// braucht keine Lizenz-/Asset-Beschaffung und bleibt winzig klein.
let audioContext: AudioContext | null = null

function getContext(): AudioContext | null {
  try {
    if (!audioContext) audioContext = new AudioContext()
    return audioContext
  } catch {
    return null
  }
}

const STORAGE_KEY = 'soundEffectsEnabled'

export function isSoundEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== 'false'
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled))
}

function tone(freq: number, startTime: number, duration: number, volume = 0.05): void {
  const ctx = getContext()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(volume, ctx.currentTime + startTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(ctx.currentTime + startTime)
  osc.stop(ctx.currentTime + startTime + duration)
}

export function playLaunchSound(): void {
  if (!isSoundEnabled()) return
  tone(660, 0, 0.12)
  tone(880, 0.08, 0.16)
}

export function playSuccessSound(): void {
  if (!isSoundEnabled()) return
  tone(523.25, 0, 0.1)
  tone(659.25, 0.09, 0.1)
  tone(783.99, 0.18, 0.22)
}

export function playDiceTick(): void {
  if (!isSoundEnabled()) return
  tone(300, 0, 0.03, 0.035)
}
