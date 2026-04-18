# Markit ↔ Creatix ecosystem — architecture outline

Single-page reference: how the **prompt/video editor** (Markit), **Creatix** (vault, auth, billing, AI credits), **browser media** (ffmpeg.wasm), optional **Remotion/worker render**, and **Ariadne** fit together.

---

## 1. High-level system context

```mermaid
flowchart TB
  subgraph creators["Creator browser"]
    CE["Creatix app<br/>Dashboard · AI Studio · Divine · Vault"]
    MK["Markit editor<br/>(separate origin, e.g. Vercel)"]
  end

  subgraph creatix_api["Creatix API (Next.js)"]
    FS["GET frame-session"]
    AP["GET asset?t=…"]
    FE["POST frame-export"]
    FA["POST frame/ai/assist"]
    AE["POST ariadne/embed · proxies"]
  end

  subgraph storage["Supabase"]
    DB[(content · subscriptions)]
    SB[(vault-media bucket)]
  end

  CE -->|"Open in Markit"| MK
  MK --> FS
  MK --> AP
  MK --> FE
  MK --> FA
  MK --> AE

  FS --> DB
  AP --> SB
  FE --> SB
  FE --> DB
  FA --> DB
  AE --> DB
```

**Principles**

- **Creatix** owns identity, vault rows, storage paths, AI credit debits, and Ariadne contracts.
- **Markit** is a **client** of those APIs: it never replaces Supabase as source of truth.
- **Divine** (messaging / panel flows) stays in Creatix; Markit is reached via **deep links** from AI Studio / vault, not merged into Divine UI unless you explicitly build that later.

---

## 2. Data flow: vault → edit → vault

```mermaid
sequenceDiagram
  participant User
  participant Creatix as Creatix UI
  participant FS as frame-session
  participant MK as Markit
  participant Asset as asset proxy
  participant FE as frame-export

  User->>Creatix: Open video → Edit in Markit
  Creatix->>FS: GET (auth cookie)
  FS-->>Creatix: importUrl, exportUrl, exportToken, …
  Creatix->>MK: Navigate with query params
  MK->>Asset: GET video (CORS, token in URL)
  Asset-->>MK: video bytes / stream
  Note over MK: Preview, timeline, ffmpeg.wasm edits
  MK->>FE: POST multipart file + exportToken
  FE->>FE: Validate token, upload storage, patch content
  FE-->>MK: success JSON
```

Large exports **POST directly to Creatix** `frame-export` so Vercel body limits on Markit are not in the hot path.

---

## 3. Markit internal layers

```mermaid
flowchart LR
  subgraph ui["UI shell"]
    PREVIEW["Preview + timeline scrub"]
    ASSIST["Assist dock · chat"]
    TOOLS["Basic / Effects / Adjust · trim UI"]
  end

  subgraph intent["Intent"]
    TXT["User text / voice→text later"]
    PLAN["Structured plan e.g. markit-edit JSON"]
  end

  subgraph exec["Execution"]
    WASM["ffmpeg.wasm<br/>trim · concat · …"]
    WORKER["Optional: Remotion / server render job"]
  end

  subgraph out["Output"]
    UP["POST frame-export"]
  end

  ASSIST --> TXT
  TXT --> PLAN
  PLAN --> WASM
  TOOLS --> WASM
  WASM --> UP
  PLAN -.->|"heavy / long"| WORKER
  WORKER -.-> UP
```

- **Today:** wasm handles a defined set of operations (trim, concat from plans).
- **Later:** Remotion or a **worker** produces MP4 for complex compositions; upload contract to `frame-export` stays the same.

---

## 4. AI assist and billing

```mermaid
flowchart LR
  MK["Markit browser"]
  PROXY["Markit /api/ai-assist"]
  CX["Creatix POST /api/frame/ai/assist"]
  CR["AI credits · consume"]

  MK --> PROXY --> CX
  CX --> CR
```

Bridge sessions use **Bearer exportToken**; logged-in Markit users can use session cookie through the same proxy pattern. Credits are debited on **Creatix**, not in Markit env.

---

## 5. Ariadne (trace / marker) after export

```mermaid
flowchart TB
  MK["Markit"]
  FE["frame-export<br/>vault file updated"]
  AP["Ariadne API<br/>append / embed"]
  VAULT["Vault content row"]

  MK --> FE
  FE --> VAULT
  MK -->|"after upload OK"| AP
  AP --> VAULT
```

Forensic marker flows are **orthogonal** to editing: they operate on the **resulting** file in vault (subject to your existing credit and keying rules).

---

## 6. Optional future: render worker

```mermaid
flowchart LR
  MK["Markit"]
  Q["Job queue / Inngest / Vercel Workflow"]
  R["FFmpeg or Remotion render"]
  ST["Supabase storage"]
  FE["frame-export or signed URL finalize"]

  MK -->|"submit project JSON"| Q --> R --> ST --> FE
```

Use when browser wasm is insufficient (long outputs, complex filters, Remotion compositions). Same **vault** and **content id** semantics; only **where** bytes are produced changes.

---

## 7. Reference projects (patterns only)

| Source            | Typical takeaway                                      |
|-------------------|--------------------------------------------------------|
| voidcut, proj     | Timeline UX, local-first wasm ops                      |
| Remotion          | Declarative compositions + server render path        |
| LosslessCut       | Fast trim/cut UX patterns                            |
| Kimu / others     | Full-app ideas; align infra with Creatix deliberately |

---

## 8. One-line summary

**Prompt/voice → validated edit plan → executor (wasm now, worker optional) → Creatix vault → optional Ariadne**, with **Creatix** as the only authority for auth, storage, credits, and vault rows.

---

## Related

- **Delivery plan:** [Creatix `docs/MARKIT_MASTER_PLAN.md`](https://github.com/Djoek47/Creatix/blob/main/docs/MARKIT_MASTER_PLAN.md)
