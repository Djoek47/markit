/**
 * Lightweight repetition + parity coding for deterministic recovery.
 * Ported from Creatix lib/ariadne/watermark-engine/ecc.ts — algorithm unchanged.
 */

export function decodeWithParity(encoded: number[]): { bits: number[]; parityErrors: number } {
  const out: number[] = []
  let parityErrors = 0
  for (let i = 0; i < encoded.length; i += 5) {
    const block = encoded.slice(i, i + 5)
    if (block.length < 5) break
    const data = block.slice(0, 4)
    const parity = block[4]
    const expected = data.reduce((acc, b) => acc ^ (b ? 1 : 0), 0)
    if (expected !== parity) parityErrors += 1
    out.push(...data)
  }
  return { bits: out, parityErrors }
}

export function majorityVote(bits: number[], factor: number): number[] {
  const f = Math.max(1, factor)
  const out: number[] = []
  for (let i = 0; i < bits.length; i += f) {
    const chunk = bits.slice(i, i + f)
    const ones = chunk.reduce((acc, b) => acc + (b ? 1 : 0), 0)
    out.push(ones >= Math.ceil(chunk.length / 2) ? 1 : 0)
  }
  return out
}
