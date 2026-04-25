# Export formats

Format selection in the inspector **Export** tab maps to `MarkitEditPlanV1.output`:

- **format:** one of `mp4`, `mov`, `webm`, `gif`, `jpg`, `png`, `webp`
- **encoderProfile:** lineage string (default `markit.v1.h264` from the editor shell store)

Client-side rendering today targets **MP4** via ffmpeg.wasm (`lib/ffmpeg-trim.ts`). Other containers are carried in the plan for future server transcode and Ariadne metadata; the Creatix `embed` request body should remain a **small** JSON payload per the Ariadne contract—use `lineage.encoderProfile` rather than shipping full pixel buffers.

The spike route `POST /api/render` accepts a v1 plan for future server-side transcoding and optional Vercel Blob wiring.
