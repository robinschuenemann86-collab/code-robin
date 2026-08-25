/// <reference types="vite/client" />

// Electron reichert File-Objekte aus Drag&Drop um den echten Dateisystempfad
// an — Standard-DOM-Typen kennen das nicht.
interface File {
  readonly path: string
}
