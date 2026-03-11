import { useMemo, useState } from 'react';

const lenses = [
  {
    title: 'Capital Formation',
    detail: 'What evidence has to land before a lead becomes fundable?',
  },
  {
    title: 'Impact Reporting',
    detail: 'Which signals should stop living in scattered notes and start becoming evidence?',
  },
  {
    title: 'Governance & Coordination',
    detail: 'Where do calls, proposals, and follow-up work lose continuity today?',
  },
  {
    title: 'Knowledge Garden & Resources',
    detail: 'Which guides, tabs, and field notes should become durable shared memory?',
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

Summarize the community conversation into four lenses:
1. Capital Formation
2. Impact Reporting
3. Governance & Coordination
4. Knowledge Garden & Resources

For each lens, provide:
- How do we do this now?
- What is not working well?
- What should improve?

Then produce:
- a short overall summary
- top cross-cutting pain points
- top cross-cutting opportunities

Return the output as concise editable JSON.`;

export function App() {
  const [copied, setCopied] = useState(false);
  const copyStateText = useMemo(() => (copied ? 'Copied' : 'Copy ritual prompt'), [copied]);

  async function copyPrompt() {
    await navigator.clipboard.writeText(ritualPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="page-shell">
      <div className="backdrop" />
      <header className="topbar">
        <img className="wordmark" src="/branding/coop-wordmark-flat.png" alt="Coop" />
        <nav className="topnav">
          <a href="#ritual">Setup ritual</a>
          <a href="#privacy">Privacy</a>
          <a href="#states">Extension states</a>
          <a href="#footer-cta">Get started</a>
        </nav>
      </header>

      <main>
        <section className="hero section">
          <div className="hero-copy">
            <p className="eyebrow">Coop v1</p>
            <h1>Turn loose tabs into shared intelligence and fundable next steps.</h1>
            <p className="lede">
              Coop is a browser-first, local-first knowledge commons for communities that already
              generate valuable context but keep losing it between calls, docs, and private tabs.
            </p>
            <div className="cta-row">
              <a className="button button-primary" href="#ritual">
                Start setup ritual
              </a>
              <a className="button button-secondary" href="#install">
                Install extension
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
              <div className="fragment-card">Shared Feed</div>
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
                gives the group a clear weekly membrane for what becomes shared memory.
              </p>
              <p>
                The point is not another inbox. The point is turning existing browsing context into
                a live commons the coop can act on.
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
              <p>Your community runs the four-lens setup ritual.</p>
            </div>
            <div className="timeline-step">
              <span>2</span>
              <p>Members browse normally while Coop rounds up relevant context locally.</p>
            </div>
            <div className="timeline-step">
              <span>3</span>
              <p>The Roost holds drafts until a member edits and explicitly pushes them.</p>
            </div>
            <div className="timeline-step">
              <span>4</span>
              <p>The coop leaves with shared memory, a Safe address, and clearer next steps.</p>
            </div>
          </div>
        </section>

        <section className="section" id="ritual">
          <div className="section-heading">
            <p className="eyebrow">Setup Ritual</p>
            <h2>Run one structured community call before anyone creates a coop.</h2>
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
            <h3>Output required for create-coop</h3>
            <p>
              Coop creation is gated on a structured setup payload with all four lenses plus a short
              summary. Manual edits are allowed before submission.
            </p>
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <p className="eyebrow">Prompt Copy</p>
            <h2>Use external synthesis for the ritual if it helps. Keep Coop’s core loop local.</h2>
          </div>
          <div className="prompt-shell nest-card">
            <div className="prompt-toolbar">
              <div>
                <strong>Tested ritual helpers:</strong> GPT and Gemini
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
            <h2>Passive capture stays local. Shared memory starts only after explicit push.</h2>
          </div>
          <div className="grid two-up calm-grid">
            <article className="nest-card">
              <h3>Local only</h3>
              <p>Open-tab snapshots, readable extracts, draft shaping, local relevance scoring.</p>
            </article>
            <article className="nest-card">
              <h3>Shared only after approval</h3>
              <p>Published artifacts, coop memory, review board groupings, archive receipts.</p>
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
                Build `packages/extension`, open Chrome’s extensions page, and load the unpacked
                dist.
              </p>
            </article>
            <article className="nest-card">
              <h3>Primary UX</h3>
              <p>
                Sidepanel-first for create, join, review, push, archive, and export. The popup stays
                compact and launcher-like.
              </p>
            </article>
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <p className="eyebrow">Weekly Review</p>
            <h2>Preview the outcome before you install anything.</h2>
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
                <strong>3 artifacts</strong>
              </div>
              <div className="board-row">
                <span>Member</span>
                <strong>2 artifacts</strong>
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
            <h2>Preserve the loop: create, join, capture, review, push, sync, archive.</h2>
          </div>
          <div className="cta-row footer-row">
            <a className="button button-primary" href="#ritual">
              Start setup ritual
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
            <a href="/spec/coop-design-direction.md">Design direction</a>
            <a href="/spec/coop-audio-and-asset-ops.md">Audio ops</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
