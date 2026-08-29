// Ermittelt eine kräftige Akzentfarbe aus einem gecachten Icon/Cover, indem das
// Bild klein herunterskaliert und die Durchschnittsfarbe berechnet wird — die
// wird danach etwas gesättigter gemacht, weil der reine Durchschnitt eines
// Bildes sonst meist ein müdes Grau-Braun ergibt.
const cache = new Map<string, string | null>()

export function extractAccentColor(hash: string): Promise<string | null> {
  if (cache.has(hash)) return Promise.resolve(cache.get(hash) ?? null)

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const color = computeAccentColor(img)
      cache.set(hash, color)
      resolve(color)
    }
    img.onerror = () => {
      cache.set(hash, null)
      resolve(null)
    }
    img.src = `launcher-icon://${hash}`
  })
}

function computeAccentColor(img: HTMLImageElement): string | null {
  try {
    const size = 24
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)

    let r = 0
    let g = 0
    let b = 0
    let count = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 32) continue // fast durchsichtige Pixel ignorieren
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      count++
    }
    if (count === 0) return null

    return toBoostedRgb(r / count, g / count, b / count)
  } catch {
    // getImageData kann bei CORS-/Tainting-Problemen werfen — dann eben keine
    // Akzentfarbe statt eines Absturzes.
    return null
  }
}

function toBoostedRgb(r: number, g: number, b: number): string {
  const [h, s, l] = rgbToHsl(r, g, b)
  const boostedS = Math.min(1, s * 1.6 + 0.15)
  const boostedL = Math.min(0.62, Math.max(0.38, l))
  const [nr, ng, nb] = hslToRgb(h, boostedS, boostedL)
  return `rgb(${nr}, ${ng}, ${nb})`
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let [r, g, b] = [0, 0, 0]
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}
