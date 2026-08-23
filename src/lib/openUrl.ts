/**
 * Abre una URL externa en el navegador predeterminado del sistema.
 * Compatible tanto con la app de escritorio nativa de Tauri como con navegadores web estándar.
 */
export async function openExternalUrl(url: string, e?: React.MouseEvent) {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }

  try {
    // Detecta si se está ejecutando dentro del entorno nativo de Tauri
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(url)
      return
    }
  } catch (err) {
    console.warn('Error en Tauri plugin-opener, usando fallback window.open:', err)
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
