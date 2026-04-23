import { runEmbedV2Pipeline } from '@/lib/pipeline/ffmpeg-pipeline'
import { buildWatermarkEmbeddingPlan } from '@/lib/forensics/watermarkEngine'

export type EmbedV2WorkerInput = {
  inputPath: string
  outputPath: string
  payloadRef: string
  frameCount: number
  fps: number
}

export async function runEmbedV2Worker(input: EmbedV2WorkerInput) {
  const embeddingPlan = buildWatermarkEmbeddingPlan(input.payloadRef, input.frameCount, input.fps, {
    temporalStrideSec: 2,
    redundancy: 3,
    dctStrength: 1,
    spatialStrength: 1,
  })
  const metrics = await runEmbedV2Pipeline(input.inputPath, input.outputPath)
  return {
    status: 'completed' as const,
    embeddingPlanSummary: {
      windows: embeddingPlan.windows.length,
      strideFrames: embeddingPlan.strideFrames,
      redundancy: embeddingPlan.redundancy,
    },
    metrics,
  }
}

