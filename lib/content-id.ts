/** Parse vault content UUID from Creatix frame-export URL. */
export function parseVaultContentIdFromExportUrl(exportUrl: string): string | null {
  try {
    const u = new URL(exportUrl)
    const m = u.pathname.match(/\/api\/content\/vault\/([^/]+)\/frame-export/)
    return m?.[1] ?? null
  } catch {
    return null
  }
}
