# Divine Voice Control

Divine voice control is a first-class editing surface in Markit.

## Core contract

- Voice input is transcribed into an intent.
- Intent is mapped to deterministic timeline operations.
- User receives preview/confirmation and can undo.

## Supported intents (initial)

- `trim_window`: trim around a target range.
- `crop_profile`: apply framing preset.
- `make_teasers`: generate N teaser segments.
- `reorder_clips`: change segment order.
- `apply_preset`: apply named workflow preset.

## Safety and UX

- No irreversible action without confirmation.
- Every applied voice action creates an undo point.
- Commands are contextualized with current playhead and duration.

## Example command flow

1. User: \"Cut to hottest 15 seconds and make 3 teasers\"
2. Router parses to:
   - `trim_window`
   - `make_teasers`
3. Planner generates deterministic operations.
4. UI shows preview plan.
5. User confirms -> operations applied.
