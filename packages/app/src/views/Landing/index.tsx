import { useMemo, useState } from 'react';

const lenses = [
  {
    title: 'Money & resources',
    detail: 'What has to be easy to find when a good opportunity appears?',
  },
  {
    title: 'Impact & progress',
    detail: 'Which signs show the flock is actually helping?',
  },
  {
    title: 'Decisions & teamwork',
    detail: 'Where do meetings, plans, and follow-up go missing today?',
  },
  {
    title: 'Knowledge & tools',
    detail: 'Which tabs, guides, and field notes should stay in the coop?',
  },
];

const states = [
  {
    label: 'Idle',
    detail: 'The extension is ready, quiet, and not asking for attention.',
  },
  {
    label: 'Watching',
    detail: 'Manual round-up or scheduled capture is scanning locally for likely signal.',
  },
  {
    label: 'Review Needed',
    detail: 'One or more drafts are waiting in the Roost for a human push decision.',
  },
  {
    label: 'Error / Offline',
    detail:
      'Permissions, sync, or local model availability need attention before the loop is healthy.',
  },
];

const ritualPrompt = `You are helping a community prepare a Coop setup payload.

Summarize the community conversation into four simple buckets:
1. Money & resources
2. Impact & progress
3. Decisions & teamwork
4. Knowledge & tools

For each bucket, provide:
- How do we do this now?
- What is not working well?
- What should improve?

Then produce:
- a short overall summary
- top cross-cutting pain points
- top cross-cutting opportunities

Return the output as concise editable JSON.`;

export function App({ appHref = '/pair' }: { appHref?: string }) {
  const [copied, setCopied] = useState(false);
  const copyStateText = useMemo(() => (copied ? 'Copied' : 'Copy helper prompt'), [copied]);

  async function copyPrompt() {
    if (!navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(ritualPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard permission denied — no-op for copy button
    }
  }

  return (
    <div className="page-shell">
      <div className="backdrop" />
      <header className="topbar">
        <img className="wordmark" src="/branding/coop-wordmark-flat.png" alt="Coop" />
        <nav className="topnav">
          <a href="#ritual">Quick hatch</a>
          <a href="#privacy">Privacy</a>
          <a href="#states">Extension states</a>
          <a href="#footer-cta">Get started</a>
        </nav>
      </header>

      <main>
        <section className="hero section">
          <div className="hero-copy">
            <p className="eyebrow">No more chickens loose</p>
            <h1>Turn knowledge into opportunity.</h1>
            <p className="lede">
              Coop helps your group catch useful tabs, notes, and signals before they scatter, then
              review and share what matters together.
            </p>
            <div className="cta-row">
              <a className="button button-primary" href="#ritual">
                Start quick hatch
              </a>
              <a className="button button-secondary" href="#install">
                Install extension
              </a>
              <a className="button button-secondary" href={appHref}>
                Open receiver app
              </a>
            </div>
            <div className="quiet-note">
              Landing page sound stays off by default. Coop’s core AI loop stays browser-local.
            </div>
          </div>
          <div className="hero-art nest-card">
            <img className="hero-mark" src="/branding/coop-mark-glow.png" alt="Coop glowing mark" />
            <div className="hero-stack">
              <div className="fragment-card">Loose Chickens</div>
              <div className="fragment-card">Roost</div>
              <div className="fragment-card">Coop Feed</div>
              <div className="fragment-card">Review Board</div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <p className="eyebrow">Problem</p>
            <h2>Fragmented knowledge becomes missed opportunity.</h2>
          </div>
          <div className="grid two-up">
            <article className="nest-card">
              <h3>What keeps slipping away</h3>
              <ul className="check-list">
                <li>Research disappears in private tabs.</li>
                <li>Notes scatter across tools and people.</li>
                <li>Communities lose continuity between calls.</li>
                <li>Evidence lands too late to support funding or action.</li>
              </ul>
            </article>
            <article className="nest-card">
              <h3>What Coop changes</h3>
              <p>
                Coop notices relevant context locally, shapes drafts before anything is shared, and
                helps the group decide together what belongs in the coop.
              </p>
              <p>
                The point is not another pile of tabs. It is catching good ideas before they run
                off.
              </p>
            </article>
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <p className="eyebrow">How It Works</p>
            <h2>The v1 loop is short on purpose.</h2>
          </div>
          <div className="timeline">
            <div className="timeline-step">
              <span>1</span>
              <p>Start a coop with a short first chat, then refine it later if you want.</p>
            </div>
            <div className="timeline-step">
              <span>2</span>
              <p>Members browse normally while Coop rounds up relevant context locally.</p>
            </div>
            <div className="timeline-step">
              <span>3</span>
              <p>The Roost holds drafts until someone tidies them up and shares them.</p>
            </div>
            <div className="timeline-step">
              <span>4</span>
              <p>The coop leaves with shared finds, a shared nest, and clearer next steps.</p>
            </div>
          </div>
        </section>

        <section className="section" id="ritual">
          <div className="section-heading">
            <p className="eyebrow">Teach Coop More</p>
            <h2>Give Coop a little context about how your group works.</h2>
          </div>
          <div className="ritual-grid">
            {lenses.map((lens) => (
              <article className="lens-card" key={lens.title}>
                <h3>{lens.title}</h3>
                <p>{lens.detail}</p>
                <ul className="lens-prompts">
                  <li>How do we do this now?</li>
                  <li>What is not working well?</li>
                  <li>What should improve?</li>
                </ul>
              </article>
            ))}
          </div>
          <div className="ritual-note nest-card">
            <h3>Optional deepening for bigger coops</h3>
            <p>
              A coop can hatch quickly from a purpose and starter note. These four areas help later
              when you want Coop to better understand your rhythm.
            </p>
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <p className="eyebrow">Prompt Copy</p>
            <h2>Use an outside helper for the deeper questions if it helps.</h2>
          </div>
          <div className="prompt-shell nest-card">
            <div className="prompt-toolbar">
              <div>
                <strong>Tested helpers:</strong> GPT and Gemini
              </div>
              <button
                className="button button-secondary button-small"
                onClick={copyPrompt}
                type="button"
              >
                {copyStateText}
              </button>
            </div>
            <pre>{ritualPrompt}</pre>
          </div>
        </section>

        <section className="section" id="privacy">
          <div className="section-heading">
            <p className="eyebrow">Privacy And Push</p>
            <h2>Passive capture stays local. Shared finds start only when you choose.</h2>
          </div>
          <div className="grid two-up calm-grid">
            <article className="nest-card">
              <h3>Local only</h3>
              <p>Open-tab snapshots, readable extracts, draft shaping, and local sorting.</p>
            </article>
            <article className="nest-card">
              <h3>Shared only after approval</h3>
              <p>Shared finds, the coop feed, board groupings, and saved proof.</p>
            </article>
          </div>
          <p className="privacy-copy">
            Coop can help structure what matters before anything is shared. It does not default to
            cloud inference in the core loop, and raw passive browsing exhaust is not exported by
            default.
          </p>
        </section>

        <section className="section" id="states">
          <div className="section-heading">
            <p className="eyebrow">Extension States</p>
            <h2>Four icon states keep the extension legible.</h2>
          </div>
          <div className="states-grid">
            {states.map((state) => (
              <article className="state-card" key={state.label}>
                <div className="state-pill">{state.label}</div>
                <p>{state.detail}</p>
              </article>
            ))}
          </div>
          <div className="grid two-up" id="install">
            <article className="nest-card">
              <h3>Install extension</h3>
              <p>
                Build `packages/extension`, open Chrome’s extensions page, enable Developer mode,
                and load the unpacked dist. Then pin Coop and open the sidepanel. The full install
                and rollout guide lives in{' '}
                <a href="/spec/extension-install-and-distribution.md">
                  extension install and distribution docs
                </a>
                .
              </p>
            </article>
            <article className="nest-card">
              <h3>Open the receiver app</h3>
              <p>
                On a phone, open the receiver shell directly to pair your device, capture notes, and
                send private intake back into the extension. If you are already on a phone, go
                straight to <a href={appHref}>the receiver app</a>.
              </p>
            </article>
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <p className="eyebrow">Weekly Review</p>
            <h2>See the coop in action before you install anything.</h2>
          </div>
          <div className="weekly-board">
            <article className="weekly-column nest-card">
              <h3>By category</h3>
              <div className="board-chip">Funding lead</div>
              <div className="board-chip">Evidence</div>
              <div className="board-chip">Next step</div>
            </article>
            <article className="weekly-column nest-card">
              <h3>By member</h3>
              <div className="board-row">
                <span>Trusted member</span>
                <strong>3 shared finds</strong>
              </div>
              <div className="board-row">
                <span>Member</span>
                <strong>2 shared finds</strong>
              </div>
            </article>
            <article className="weekly-column nest-card">
              <h3>What the coop sees</h3>
              <p>
                Who contributed what, what should be reviewed next, and which patterns keep
                recurring.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="footer section" id="footer-cta">
        <div className="footer-card">
          <div>
            <p className="eyebrow">CTA</p>
            <h2>Round up what matters, check the roost, and save the good stuff together.</h2>
          </div>
          <div className="cta-row footer-row">
            <a className="button button-primary" href="#ritual">
              Start quick hatch
            </a>
            <a className="button button-secondary" href="#install">
              Install extension
            </a>
            <a className="button button-secondary" href="/spec/coop-os-architecture-vnext.md">
              Docs
            </a>
          </div>
          <div className="footer-links">
            <a href="#install">Create coop</a>
            <a href="#install">Join coop</a>
            <a href="/spec/extension-install-and-distribution.md">Install guide</a>
            <a href="/spec/demo-and-deploy-runbook.md">Demo runbook</a>
            <a href="/spec/coop-design-direction.md">Design direction</a>
            <a href="/spec/coop-audio-and-asset-ops.md">Audio ops</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
