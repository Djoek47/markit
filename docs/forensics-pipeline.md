# Forensics Pipeline (Markit -> Ariadne)

## Core modules

- `lib/forensics/watermarkEngine.ts`
- `lib/forensics/frameSelector.ts`
- `lib/forensics/detectWatermark.ts`
- `lib/pipeline/ffmpeg-pipeline.ts`
- `lib/jobs/embed-v2-worker.ts`

## FFmpeg example pipeline

```bash
# Extract frame sequence
ffmpeg -i input.mp4 -vf fps=2 tmp/frames/frame_%06d.png

# Reassemble after watermark processing
ffmpeg -framerate 2 -i tmp/frames/frame_%06d.png -i input.mp4 \
  -map 0:v:0 -map 1:a? -c:v libx264 -preset medium -crf 20 -c:a copy output.mp4
```

## Detection approach

1. Sample frame windows under multiple transformations.
2. Reconstruct candidate watermark signatures from spatial+frequency+temporal evidence.
3. Match candidate references to known payload references.
4. Return `match_state`, `confidence`, `payload_candidates`, and `evidence_summary`.
