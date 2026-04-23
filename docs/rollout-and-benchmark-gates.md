# Rollout and Benchmark Gates

## Feature flags

- `ARIADNE_V2_EMBED_ENABLED`
- `ARIADNE_V2_DETECT_ENABLED`
- `ARIADNE_CONFIDENCE_GATING_ENABLED`
- `FRAMER_TRACED_EXPORT_ENABLED`

## Kill switches

- Disable embed independently with `ARIADNE_V2_EMBED_ENABLED=false`.
- Disable detect independently with `ARIADNE_V2_DETECT_ENABLED=false`.
- Keep editor usable even when forensics features are off.

## Required benchmark suite

- transcode (low, medium, high)
- crop (5, 10, 20)
- trim (start, mid, end)
- scale (down, up)
- blur / noise / denoise

## Launch thresholds

- detection_rate >= 0.92
- false_positive_rate <= 0.01
- median_true_positive_confidence >= 0.88
- confidence_gate breach rate <= 0.02

## Staged rollout

1. Internal creators only
2. Beta creators
3. Pro creators
4. General availability

