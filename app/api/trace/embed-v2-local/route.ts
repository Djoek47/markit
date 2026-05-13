import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { embedWatermark, buildPayloadBits } from '@/lib/ariadne-v2/embed'
import type { GrayFrame } from '@/lib/ariadne-v2/detect'

export const runtime = 'nodejs'

const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const MAX_BYTES = 20 * 1024 * 1024 // 20 MB — images only

/**
 * POST multipart { file, recipientLabel }
 *   → watermarked PNG download
 *
 * Local Ariadne v2 frame watermark for IMAGES (PNG/JPEG/WebP).
 * Uses sharp to decode → embed LSB watermark → re-encode as PNG.
 * No Creatix, no ffmpeg, no Supabase Storage.
 *
 * For video v2 embed, Creatix is required (needs ffmpeg frame pipeline).
 */
export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient(req)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let file: File
  let recipientLabel: string
  try {
    const form = await req.formData()
    const f = form.get('file')
    const r = form.get('recipientLabel')
    if (!f || !(f instanceof File)) {
      return NextResponse.json({ error: 'file field is required' }, { status: 400 })
    }
    if (!IMAGE_MIMES.has(f.type.toLowerCase().split(';')[0].trim())) {
      return NextResponse.json(
        { error: 'v2 local embed supports images only (PNG/JPEG/WebP). For video use Creatix.' },
        { status: 415 },
      )
    }
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large (max 20 MB)' }, { status: 413 })
    }
    if (!r || typeof r !== 'string' || !r.trim()) {
      return NextResponse.json({ error: 'recipientLabel is required' }, { status: 400 })
    }
    file = f
    recipientLabel = r.trim().slice(0, 500)
  } catch {
    return NextResponse.json({ error: 'Failed to parse multipart body' }, { status: 400 })
  }

  const payloadId = randomUUID()
  const payloadBits = buildPayloadBits(payloadId)

  // Decode image to raw grayscale pixels
  const inputBuf = Buffer.from(await file.arrayBuffer())
  const { data: rawPixels, info } = await sharp(inputBuf)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info

  // Build GrayFrame
  const frame: GrayFrame = []
  for (let y = 0; y < height; y++) {
    const row: number[] = []
    for (let x = 0; x < width; x++) {
      row.push(rawPixels[y * width + x] ?? 0)
    }
    frame.push(row)
  }

  // Embed watermark
  const watermarked = embedWatermark(frame, payloadBits, {
    seed: 42,
    strength: 1,
    redundancy: 3,
    useSpatialLayer: true,
  })

  // Flatten back to Buffer
  const outPixels = Buffer.alloc(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      outPixels[y * width + x] = watermarked[y]?.[x] ?? 0
    }
  }

  // Re-encode as PNG (lossless — preserves LSBs)
  const outputPng = await sharp(outPixels, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer()

  // Store trace record
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && serviceKey) {
    const service = createServiceClient(url, serviceKey)
    await service.schema('markit').from('trace_exports').insert({
      user_id: user.id,
      payload_id: payloadId,
      recipient_label: recipientLabel,
      source_path: `v2-local-image/${user.id}/${payloadId}`,
      algorithm: 'frame-v2',
    })
  }

  const slug = recipientLabel.replace(/[^\w.-]+/g, '_').slice(0, 40)
  const filename = `${slug}_${payloadId.slice(0, 8)}_v2.png`

  return new NextResponse(outputPng.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(outputPng.length),
      'X-Payload-Id': payloadId,
      'X-Recipient-Label': encodeURIComponent(recipientLabel),
      'X-Algorithm': 'frame-v2',
    },
  })
}
