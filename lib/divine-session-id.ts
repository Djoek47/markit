/** Session id for Creatix `divine_session_id` lease (per Markit tab). */
export function getOrCreateMarkitDivineSessionId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const k = 'markit_divine_session_id'
    let id = window.sessionStorage.getItem(k)
    if (!id) {
      id = crypto.randomUUID()
      window.sessionStorage.setItem(k, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}
