# Markit Editor Architecture

Markit is a voice-first, AI-assisted, deterministic video editor built for creator workflows.

## Objectives

- Keep editing deterministic and replayable.
- Let AI/voice suggest plans while the timeline engine executes predictable operations.
- Keep forensic attribution authoritative in Creatix Ariadne.

## Layers

- **UI layer**: timeline, preview, presets, voice command bar.
- **Deterministic core**: track model, clip model, operation log, export manifest.
- **Agentic layer**: brief parser + cut planner + narrative planner.
- **Media pipeline**: ffmpeg-powered trim/concat/render worker.
- **Forensics layer**: watermark embed/detect + Ariadne authority API calls.

## Data flow

```mermaid
flowchart LR
  userIntent[UserIntentOrVoice] --> agentPlanner[AgentPlanner]
  agentPlanner --> timelineOps[TimelineOperations]
  timelineOps --> deterministicState[DeterministicTimelineState]
  deterministicState --> exportPlan[ExportPlan]
  exportPlan --> ffmpegPipeline[FfmpegPipeline]
  ffmpegPipeline --> watermarkHybrid[WatermarkHybridV2]
  watermarkHybrid --> ariadneAuthority[CreatixAriadneAuthority]
  ariadneAuthority --> tracedAsset[TracedAsset]
```

## Determinism rules

- Every timeline mutation is represented as explicit operation records.
- Export output is derived from operation history + source clips.
- AI can generate plans, but execution always passes through deterministic operations.
