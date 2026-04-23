/** Normalized crop in 0..1 space. Full-frame = no extra crop pass (avoids redundant libx264 in wasm). */
export function isFullFrameCrop(
  c: { x: number; y: number; width: number; height: number } | undefined,
  eps = 0.002,
): boolean {
  if (!c) return true
  return c.x <= eps && c.y <= eps && c.width >= 1 - eps && c.height >= 1 - eps
}
