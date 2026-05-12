# OpenReel Vendor Sync

Markit vendors OpenReel from:

<https://github.com/Augani/openreel-video>

The goal is to stay close to upstream while preserving Markit's Next 16, React 19, Circe et Venus styling, and future Creatix/Ariadne integration points.

## What Is Vendored

| Upstream path | Markit path |
| --- | --- |
| `apps/web/src` | `vendor/openreel/web` |
| `packages/core/src` | `vendor/openreel/core` |
| `packages/ui/src` | `vendor/openreel/ui` |
| `packages/image-core/src` | `vendor/openreel/image-core` |

The sync writes metadata to `vendor/openreel/UPSTREAM.json`.

## Normal Update Flow

```bash
npm run openreel:sync
npm run lint
npm test
npm run build
```

Then review the diff carefully before committing.

## Sync From A Local Checkout

Use this when you already cloned OpenReel, or when network access is unavailable in the current shell:

```bash
npm run openreel:sync -- --source "C:/Users/Ben Beckman/Documents/Circe et Venus/openreel-video-reference" --no-install
```

## Sync A Specific Branch, Tag, Or Commit

```bash
npm run openreel:sync -- --ref main
npm run openreel:sync -- --ref v0.0.0
npm run openreel:sync -- --ref <commit-sha>
```

## Protected Markit Patches

The sync script reapplies these patches after copying upstream:

- Vite `import.meta.env` references are converted for Next.
- Remote worker imports are converted to package imports.
- React 19 `RefObject<HTMLDivElement | null>` compatibility is restored for timeline files.
- Toolbar, tour, mobile blocker, and generated project names are rebranded to Markit.
- Preview empty-state typography and timeline playhead color are restored.
- The premium Markit/Circe skin remains in `app/globals.css`.

If upstream changes one of these files substantially, the script may fail or produce a diff that needs human review. That is intentional.

## Review Checklist

- Confirm `vendor/openreel/UPSTREAM.json` shows the intended upstream commit.
- Inspect all changes under `vendor/openreel`.
- Check whether upstream added dependencies and mirror them in Markit's `package.json` if needed.
- Run `npm run lint`, `npm test`, and `npm run build`.
- Smoke test `http://localhost:3020/editor`.
- Open export, settings, search, context menus, and inspector selects to verify the Markit skin still reaches portaled UI.

## Contributing Back Upstream

OpenReel's README/Contributing workflow asks contributors to:

- Fork and clone the repository.
- Create a feature branch.
- Run `pnpm typecheck`, `pnpm test`, and `pnpm lint`.
- Use conventional commits.
- Push and open a PR.

Markit-specific patches should normally stay in Markit. Generic bug fixes discovered while syncing should be made in a clean OpenReel branch and contributed upstream.
