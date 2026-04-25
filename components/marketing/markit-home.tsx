import Image from 'next/image'
import Link from 'next/link'

const CREATIX = process.env.NEXT_PUBLIC_CREATIX_APP_URL || 'https://www.circeetvenus.com'

const brandLogo = '/icon.png'

function Nav() {
  return (
    <header
      className="mk-mkt-nav sticky top-0 z-50 flex items-center justify-between border-b px-5 py-5 md:px-12"
      style={{ borderColor: 'var(--border)', background: 'color-mix(in oklch, var(--background) 82%, transparent)' }}
    >
      <div className="flex items-center gap-3.5">
        <div
          className="relative h-9 w-9 overflow-hidden rounded-full border bg-white shadow-md"
          style={{ borderColor: 'var(--border)', boxShadow: '0 0 24px color-mix(in oklch, var(--primary) 20%, transparent)' }}
        >
          <Image src={brandLogo} alt="Circe et Venus" width={36} height={36} className="h-full w-full object-cover" />
        </div>
        <div className="font-serif-display text-[15px] font-medium tracking-[0.22em]">
          CIRCE <em className="not-italic text-[var(--primary)]">et</em> VENUS
        </div>
      </div>
      <nav className="text-muted-foreground hidden gap-8 text-[13px] md:flex">
        <a href="#voice" className="hover:text-foreground transition-colors">
          Voice
        </a>
        <a href="#editor" className="hover:text-foreground transition-colors">
          Editor
        </a>
        <a href="#trace" className="hover:text-foreground transition-colors">
          Ariadne
        </a>
        <a href="#flow" className="hover:text-foreground transition-colors">
          How it works
        </a>
      </nav>
      <div className="flex items-center gap-2.5">
        <Link
          href="/auth/sign-in?next=/editor"
          className="text-muted-foreground rounded-full px-4 py-2 text-[13px] font-medium transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
        <a
          href="#cta"
          className="rounded-full bg-[var(--primary)] px-4 py-2 text-[13px] font-medium text-[var(--primary-foreground)] shadow-lg transition-transform hover:-translate-y-0.5"
          style={{ boxShadow: '0 4px 20px -4px color-mix(in oklch, var(--primary) 40%, transparent)' }}
        >
          Begin
        </a>
      </div>
    </header>
  )
}

export function MarkitHomePage() {
  return (
    <div className="mk-mkt relative min-h-screen">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: `
            radial-gradient(900px 500px at 10% 0%, color-mix(in oklch, var(--circe) 8%, transparent), transparent 60%),
            radial-gradient(700px 400px at 100% 40%, color-mix(in oklch, var(--primary) 5%, transparent), transparent 65%),
            radial-gradient(1100px 600px at 50% 120%, color-mix(in oklch, var(--circe) 10%, transparent), transparent 55%)
          `,
        }}
      />
      <Nav />
      <main>
        <section className="mx-auto grid max-w-[1400px] items-center gap-16 px-5 py-16 md:grid-cols-[1.1fr_0.9fr] md:px-12 md:py-24">
          <div>
            <p className="text-primary font-mono-ui mb-7 flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.32em] before:block before:h-px before:w-6 before:bg-[var(--primary)]">
              Markit · Creatix Studio
            </p>
            <h1 className="font-serif-display text-[clamp(2.2rem,6vw,5.2rem)] font-medium leading-[0.98] tracking-tight">
              Edit by <em className="not-italic text-[var(--primary)]">voice.</em>
              <br />
              Mark every <em className="not-italic text-[var(--primary)]">frame.</em>
            </h1>
            <p className="text-muted-foreground mt-7 max-w-[34rem] text-[19px] leading-relaxed">
              A voice-first video and image editor for adult creators. Speak the cut, the crop, the teaser — Markit
              does it. Every export carries an invisible marker that survives re-encoding, so if your file leaks, you
              know who leaked it.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3.5">
              <Link
                href="/auth/sign-in?next=/editor"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-7 py-3.5 text-sm font-medium text-[var(--primary-foreground)] shadow-lg transition-transform hover:-translate-y-0.5"
                style={{ boxShadow: '0 4px 20px -4px color-mix(in oklch, var(--primary) 40%, transparent)' }}
              >
                Open the editor →
              </Link>
              <a
                href="#voice"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-7 py-3.5 text-sm font-medium text-foreground transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                See it work
              </a>
            </div>
            <div className="text-muted-foreground mt-12 flex flex-wrap gap-8 border-t border-[var(--border)] pt-8 font-mono-ui text-[10px] font-medium uppercase tracking-[0.2em]">
              <div>
                <div className="font-serif-display text-primary text-[2rem] font-medium">
                  <em className="not-italic">One</em> voice
                </div>
                <div className="mt-1">Say it, ship it</div>
              </div>
              <div>
                <div className="font-serif-display text-primary text-[2rem] font-medium">
                  <em className="not-italic">Every</em> frame
                </div>
                <div className="mt-1">DCT trace layer</div>
              </div>
              <div>
                <div className="font-serif-display text-primary text-[2rem] font-medium">
                  <em className="not-italic">Zero</em> guesswork
                </div>
                <div className="mt-1">Leaks traced to recipient</div>
              </div>
            </div>
          </div>
          <div className="mk-mkt-hero-seal flex items-center justify-center">
            <div
              className="relative w-[min(480px,100%)] max-w-full animate-[mkt-float_6s_ease-in-out_infinite] aspect-square"
            >
              <div
                className="absolute -inset-10 rounded-full opacity-70 blur-sm animate-[mkt-breathe_5s_ease-in-out_infinite]"
                style={{
                  background: 'radial-gradient(circle, color-mix(in oklch, var(--primary) 14%, transparent) 0%, transparent 65%)',
                }}
              />
              <div
                className="absolute -inset-6 rounded-full border border-dashed"
                style={{ borderColor: 'color-mix(in oklch, var(--primary) 30%, transparent)' }}
              />
              <div className="border-background relative z-[1] h-full w-full overflow-hidden rounded-full border bg-white shadow-2xl">
                <Image
                  src={brandLogo}
                  alt="Circe et Venus"
                  width={480}
                  height={480}
                  className="h-full w-full object-cover p-0.5"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="voice" className="border-t border-[var(--border)] px-5 py-20 md:px-12">
          <div className="mx-auto max-w-[1400px] text-center">
            <h2 className="font-serif-display text-[clamp(2rem,4.5vw,3.2rem)] font-medium leading-tight">
              <em className="not-italic text-[var(--primary)]">Speak.</em> It cuts.
            </h2>
            <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-[17px]">
              Hands busy? Driving? On camera? The Divine Manager listens and acts — no timeline tetris, no typing.
            </p>
            <div
              className="bg-card border-border relative mx-auto mt-14 max-w-[56rem] overflow-hidden rounded-2xl border p-8 text-left md:p-12"
            >
              <div className="from-primary/40 absolute top-0 left-1/2 h-px w-3/5 -translate-x-1/2 bg-gradient-to-r via-[var(--primary)] to-transparent" />
              <div className="mb-4 flex items-center gap-2.5">
                <div
                  className="h-8 w-8 flex-shrink-0 rounded-full"
                  style={{
                    background: 'radial-gradient(circle at 35% 35%, var(--primary-soft), var(--primary) 65%)',
                  }}
                />
                <h5 className="font-serif-display text-lg font-medium">
                  The <em className="not-italic text-[var(--primary)]">Divine Manager</em>
                </h5>
              </div>
              <p className="text-primary font-mono-ui text-[10px] uppercase tracking-[0.24em]">You said</p>
              <p className="font-serif-display text-foreground mt-2 border-b border-[var(--border-soft)] pb-5 text-xl italic leading-snug md:text-2xl">
                &ldquo;Combine scene three and the b-roll close-up. Make it fifteen seconds. Caption in cream. Send a
                traced copy to Sophie.&rdquo;
              </p>
              <div className="text-muted-foreground mt-4 space-y-1 text-sm leading-relaxed">
                <p>
                  <strong className="text-foreground font-medium">Timeline built:</strong> 2 clips, 14.8s, fades on both
                  ends.
                </p>
                <p>
                  <strong className="text-foreground font-medium">Ariadne marker:</strong> bound to recipient
                </p>
                <p>
                  <strong className="text-foreground font-medium">Ready to export.</strong> Hold Space to revise, or say
                  &ldquo;ship it.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="editor" className="border-t border-[var(--border)] px-5 py-20 md:px-12">
          <div className="mx-auto max-w-[1400px] text-center">
            <h2 className="font-serif-display text-[clamp(2rem,4.5vw,3.2rem)] font-medium">
              Three tools. <em className="not-italic text-[var(--primary)]">One canvas.</em>
            </h2>
            <p className="text-muted-foreground mt-4">Video. Image. Trace. One editor, one voice, one timeline.</p>
            <div className="mt-10 grid border-y border-[var(--border)] md:grid-cols-3">
              {(
                [
                  {
                    h: (
                      <>
                        Video <em className="not-italic text-[var(--primary)]">editor</em>
                      </>
                    ),
                    d: 'Multi-track timeline with library-based combining. Voice drives the cuts; you approve the plan.',
                  },
                  {
                    h: (
                      <>
                        Image <em className="not-italic text-[var(--primary)]">editor</em>
                      </>
                    ),
                    d: 'Same canvas. Crop, overlay, and watermark per recipient. No separate workflow.',
                  },
                  {
                    id: 'trace',
                    h: (
                      <>
                        Ariadne <em className="not-italic text-[var(--primary)]">trace</em>
                      </>
                    ),
                    d: 'Invisible marker on every export. If a file leaks, upload it and trace the recipient.',
                  },
                ] as const
              ).map((c) => (
                <div
                  key={c.d}
                  id={'id' in c ? c.id : undefined}
                  className="hover:bg-card/50 border-border border-b p-10 transition-colors last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0"
                >
                  <h3 className="font-serif-display text-2xl font-medium">{c.h}</h3>
                  <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{c.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="flow" className="border-t border-[var(--border)] px-5 py-20 md:px-12">
          <div className="mx-auto max-w-[1400px] text-center">
            <h2 className="font-serif-display text-[clamp(2rem,4.5vw,3.2rem)] font-medium">
              <em className="not-italic text-[var(--primary)]">Four steps.</em> One take to a shippable clip.
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  { n: 'i', t: 'Drop media' },
                  { n: 'ii', t: 'Speak intent' },
                  { n: 'iii', t: 'Approve the cut' },
                  { n: 'iv', t: 'Export with trace' },
                ] as const
              ).map((s) => (
                <div key={s.n} className="bg-card border-border flex flex-col rounded-xl border p-6 text-left">
                  <div className="font-serif-display text-primary mb-3 text-3xl font-normal italic">{s.n}</div>
                  <h4 className="font-serif-display text-lg font-medium">{s.t}</h4>
                  <p className="text-muted-foreground mt-2 text-sm">Part of the Markit export flow.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--border)] px-5 py-20 md:px-12">
          <div
            className="bg-card border-border mx-auto grid max-w-[1400px] items-center gap-10 rounded-2xl border p-8 md:grid-cols-2 md:p-16"
          >
            <div>
              <h2 className="font-serif-display text-[clamp(1.6rem,3vw,2.5rem)] font-medium">
                Lives <em className="not-italic text-[var(--primary)]">inside</em> Circe et Venus.
              </h2>
              <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                Markit is the editor layer of the workspace. Vault, fan CRM, and DMs connect to the same account.
              </p>
              <a
                href={CREATIX}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-[var(--primary)]"
              >
                Visit Circe et Venus →
              </a>
            </div>
            <div className="bg-background/50 space-y-2.5 rounded-xl border border-[var(--border-soft)] p-6 text-sm">
              <div className="bg-card border-border flex items-center gap-3 rounded-lg border px-4 py-3 font-mono-ui">
                <span className="h-2 w-2 rounded-full bg-[var(--circe-light)]" />
                <span className="text-foreground font-medium">Circe et Venus</span>
                <span className="text-muted-foreground ml-auto">Vault · CRM</span>
              </div>
              <p className="text-primary text-center font-mono-ui text-[10px] tracking-widest">↓ import & export ↓</p>
              <div className="bg-card border-border flex items-center gap-3 rounded-lg border px-4 py-3 font-mono-ui">
                <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                <span className="text-foreground font-medium">Markit Editor</span>
                <span className="text-muted-foreground ml-auto">Edit · Trace</span>
              </div>
            </div>
          </div>
        </section>

        <section id="cta" className="border-t border-[var(--border)] relative px-5 py-28 text-center md:px-12">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, color-mix(in oklch, var(--primary) 8%, transparent), transparent 65%)' }}
          />
          <h2 className="font-serif-display relative z-[1] mx-auto max-w-[40rem] text-[clamp(2.2rem,5vw,4rem)] font-medium italic">
            Your <em className="not-italic text-[var(--primary)]">empire edits itself.</em> You speak. It ships.
          </h2>
          <p className="text-muted-foreground relative z-[1] mx-auto mt-4 max-w-lg text-[17px]">
            Free with every Circe et Venus plan. Open the editor in under a minute.
          </p>
          <Link
            href="/auth/sign-in?next=/editor"
            className="relative z-[1] mt-8 inline-flex rounded-full bg-[var(--primary)] px-8 py-4 text-sm font-medium text-[var(--primary-foreground)]"
          >
            Open Markit →
          </Link>
        </section>
      </main>
      <footer className="bg-[var(--sidebar)] border-t border-[var(--border)] px-5 py-12 md:px-12">
        <div className="mx-auto grid max-w-[1400px] gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-7 w-7 overflow-hidden rounded-full border bg-white">
                <Image src={brandLogo} alt="" width={28} height={28} className="h-full w-full object-cover" />
              </div>
              <span className="font-serif-display text-sm tracking-[0.2em]">
                CIRCE <em className="not-italic text-[var(--primary)]">et</em> VENUS
              </span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The voice-first creator workspace. Edit, protect, grow.
            </p>
          </div>
          <div>
            <h6 className="text-primary font-mono-ui mb-2 text-[10px] font-medium uppercase tracking-[0.2em]">Editor</h6>
            <a href="#voice" className="text-muted-foreground block py-1.5 text-sm hover:text-foreground">
              Voice
            </a>
            <a href="#editor" className="text-muted-foreground block py-1.5 text-sm hover:text-foreground">
              Video + Image
            </a>
            <a href="#flow" className="text-muted-foreground block py-1.5 text-sm hover:text-foreground">
              How it works
            </a>
          </div>
          <div>
            <h6 className="text-primary font-mono-ui mb-2 text-[10px] font-medium uppercase tracking-[0.2em]">Workspace</h6>
            <a href={CREATIX} className="text-muted-foreground block py-1.5 text-sm hover:text-foreground">
              Main app
            </a>
            <a href={`${CREATIX}/dashboard`} className="text-muted-foreground block py-1.5 text-sm hover:text-foreground">
              Dashboard
            </a>
          </div>
          <div>
            <h6 className="text-primary font-mono-ui mb-2 text-[10px] font-medium uppercase tracking-[0.2em]">Company</h6>
            <a
              href="mailto:support@circeetvenus.com"
              className="text-muted-foreground block py-1.5 text-sm hover:text-foreground"
            >
              Contact
            </a>
          </div>
        </div>
        <div className="text-muted-faint font-mono-ui mx-auto mt-8 flex max-w-[1400px] flex-col justify-between gap-2 border-t border-[var(--border)] pt-6 text-[10px] uppercase tracking-[0.2em] sm:flex-row">
          <span>© {new Date().getFullYear()} Circe et Venus · Guided by the stars.</span>
          <span>Markit · Beta</span>
        </div>
      </footer>
    </div>
  )
}
