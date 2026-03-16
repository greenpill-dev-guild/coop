import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import styles from './index.module.css';

export default function Home() {
  return (
    <Layout
      title="Coop Docs"
      description="Capture scattered knowledge, refine it into opportunities, and share what matters."
    >
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Documentation</p>
          <h1 className={styles.heroTitle}>Build with Coop</h1>
          <p className={styles.heroSubtitle}>
            Capture scattered knowledge, refine it into opportunities, and share what matters.
          </p>
          <div className={styles.ctaRow}>
            <Link className={styles.buttonPrimary} to="/docs/intro">
              Get Started
            </Link>
            <Link
              className={styles.buttonSecondary}
              href="https://github.com/regen-coordination/coop"
            >
              GitHub
            </Link>
          </div>
        </div>
        <div className={styles.heroArt}>
          {/* Scattered -> Organized flow visualization */}
          <div className={styles.heroFlow}>
            <div className={styles.flowZone}>
              <div className={`${styles.flowCard} ${styles.scattered}`}>Research tab</div>
              <div className={`${styles.flowCard} ${styles.scattered}`}>Funding link</div>
              <div className={`${styles.flowCard} ${styles.scattered}`}>Field note</div>
            </div>
            <div className={styles.flowCenter}>
              <img
                className={styles.heroMark}
                src="/branding/coop-mark-glow.png"
                alt="Coop organizes knowledge"
              />
            </div>
            <div className={styles.flowZone}>
              <div className={`${styles.flowCard} ${styles.organized}`}>Funding lead</div>
              <div className={`${styles.flowCard} ${styles.organized}`}>Shared evidence</div>
              <div className={`${styles.flowCard} ${styles.organized}`}>Next step</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.features}>
        <div className={styles.featureGrid}>
          <Link to="/docs/architecture/coop-os-architecture-vnext" className={styles.featureCard}>
            <p className={styles.eyebrow}>Architecture</p>
            <h3>System Overview</h3>
            <p>Modules, packages, data flow, and the local-first stack powering Coop.</p>
          </Link>
          <Link to="/docs/guides/demo-and-deploy-runbook" className={styles.featureCard}>
            <p className={styles.eyebrow}>Guides</p>
            <h3>Demo &amp; Deploy</h3>
            <p>Step-by-step runbook for demos, local dev setup, and deployment.</p>
          </Link>
          <Link to="/docs/product/prd" className={styles.featureCard}>
            <p className={styles.eyebrow}>Product</p>
            <h3>Requirements</h3>
            <p>Product requirements, user flows, acceptance criteria, and the EF mandate.</p>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
