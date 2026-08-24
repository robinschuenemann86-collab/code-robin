// Sehr einfacher Parser für Valves VDF-Format (verwendet u.a. in libraryfolders.vdf
// und appmanifest_*.acf): verschachtelte, ausschließlich in Anführungszeichen
// stehende Schlüssel-Wert-Paare, Gruppierung über geschweifte Klammern.
export function parseVdf(text: string): Record<string, unknown> {
  let i = 0
  const len = text.length

  function skipWhitespaceAndComments(): void {
    for (;;) {
      while (i < len && /\s/.test(text[i])) i++
      if (text[i] === '/' && text[i + 1] === '/') {
        while (i < len && text[i] !== '\n') i++
        continue
      }
      break
    }
  }

  function readQuotedString(): string {
    i++ // öffnendes Anführungszeichen überspringen
    let result = ''
    while (i < len && text[i] !== '"') {
      if (text[i] === '\\' && i + 1 < len) {
        result += text[i + 1]
        i += 2
      } else {
        result += text[i]
        i++
      }
    }
    i++ // schließendes Anführungszeichen überspringen
    return result
  }

  function parseObject(): Record<string, unknown> {
    const obj: Record<string, unknown> = {}
    for (;;) {
      skipWhitespaceAndComments()
      if (i >= len) break
      if (text[i] === '}') {
        i++
        break
      }
      if (text[i] !== '"') {
        i++
        continue
      }
      const key = readQuotedString()
      skipWhitespaceAndComments()
      if (text[i] === '{') {
        i++
        obj[key] = parseObject()
      } else if (text[i] === '"') {
        obj[key] = readQuotedString()
      } else {
        obj[key] = ''
      }
    }
    return obj
  }

  skipWhitespaceAndComments()
  return parseObject()
}
