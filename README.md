# Markit

Standalone **Circe et Venus** video editor: trim in the browser (ffmpeg.wasm), upload back to the vault, **Markit Assist** (AI), and optional **Ariadne Trace** embed — deployed separately from [Creatix](https://github.com/Djoek47/Creatix).

**Architecture (Mermaid):** [docs/ECOSYSTEM_ARCHITECTURE.md](docs/ECOSYSTEM_ARCHITECTURE.md) — Markit ↔ Creatix APIs, wasm, optional worker render, Ariadne.

## Deploy (Vercel)

1. Import this repo — **Root Directory** `.`, **Production Branch** `main`.
2. Set environment variables (see [`.env.example`](.env.example) and [`DEPLOYMENT.md`](DEPLOYMENT.md)).
3. In **Supabase → Authentication → URL configuration**, add your Markit origin (e.g. `https://markit.vercel.app`) to **Redirect URLs**.

## Creatix

- Set **`NEXT_PUBLIC_FRAME_URL`** on the Creatix project to your Markit URL (no trailing slash) so vault **Media & vault** can open the bridge link.
- `FRAME_EXPORT_SECRET` must match between Creatix and Markit.

## Local dev

```bash
npm install
cp .env.example .env.local
# fill NEXT_PUBLIC_* and FRAME_EXPORT_SECRET
npm run dev
```

Open [http://localhost:3020](http://localhost:3020). For a real bridge, open a vault video from Circe et Venus so `?importUrl=&exportUrl=&exportToken=` are present.

## License

See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
