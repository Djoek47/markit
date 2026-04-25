# EditPlan schema (v1)

Defined in `lib/markit-edit-plan.ts`.

```text
{
  "version": 1,
  "kind": "concat_segments" | "side_by_side",
  "label": string?,
  "crop": { "x", "y", "width", "height" }?,  // normalized 0..1
  "output": {
    "format": "mp4" | "mov" | "webm" | "gif" | "jpg" | "png" | "webp",
    "aspectPreset"?: string,
    "encoderProfile"?: string
  }?,
  "segments": [ { "startSec", "endSec", "source"?: "primary" | "secondary" } ]
}
```

Assist responses embed JSON inside a ` ```markit-edit ` fenced block. The builder `timelineToEditPlan` in `lib/timeline-project.ts` adds `output` from the Zustand editor shell when exporting from the timeline.
