import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const communityClassName = 'docs-audience-item docs-audience-item--community';
const builderClassName = 'docs-audience-item docs-audience-item--builder';

function communityDoc(id: string) {
  return {
    type: 'doc' as const,
    id,
    className: communityClassName,
  };
}

function builderDoc(id: string) {
  return {
    type: 'doc' as const,
    id,
    className: builderClassName,
  };
}

const sidebars: SidebarsConfig = {
  docs: [
    communityDoc('community/welcome-to-coop'),
    communityDoc('community/how-it-works'),
    communityDoc('community/why-we-build'),
    communityDoc('community/road-ahead'),
    communityDoc('community/creating-a-coop'),
    communityDoc('community/joining-a-coop'),
    communityDoc('community/sharing-knowledge'),
    communityDoc('community/ai-features'),
    communityDoc('community/privacy-security'),
    communityDoc('community/privacy-policy'),
    communityDoc('community/pricing'),
    {
      type: 'link',
      label: 'Glossary',
      href: '/glossary',
      className: communityClassName,
    },
    builderDoc('builder/getting-started'),
    builderDoc('builder/environment'),
    builderDoc('builder/how-to-contribute'),
    builderDoc('builder/architecture'),
    builderDoc('builder/extension'),
    builderDoc('builder/app'),
    {
      type: 'link',
      label: 'Agent Harness',
      href: '/reference/agent-harness',
      className: builderClassName,
    },
    builderDoc('builder/p2p-functionality'),
    builderDoc('builder/onchain-identity'),
    {
      type: 'category',
      label: 'Integrations',
      className: builderClassName,
      link: {
        type: 'doc',
        id: 'builder/integrations/index',
      },
      collapsed: true,
      items: [
        'builder/integrations/webauthn',
        'builder/integrations/webllm',
        'builder/integrations/yjs',
        'builder/integrations/dexie',
        'builder/integrations/gnosis-safe',
        'builder/integrations/green-goods',
        'builder/integrations/filecoin',
        'builder/integrations/storacha',
      ],
    },
    builderDoc('builder/rd'),
    {
      type: 'link',
      label: 'Glossary',
      href: '/glossary#builder-terms',
      className: builderClassName,
    },
    {
      type: 'category',
      label: 'Reference',
      className: builderClassName,
      collapsed: true,
      items: [
        {
          type: 'category',
          label: 'Narrative & Strategy',
          collapsed: true,
          items: [
            'reference/hackathon-demo-and-vision-outline',
            'reference/hackathon-demo-video-outline',
            'reference/hackathon-demo-voiceover-script',
            'reference/hackathon-demo-shot-list',
            'reference/coop-vision',
            'reference/coop-strategy',
            'reference/coop-monetization-path',
            'reference/coordination-integrity-review-framework',
            'reference/future-features-deep-dive',
          ],
        },
        {
          type: 'category',
          label: 'Architecture',
          collapsed: true,
          items: [
            'reference/coop-os-architecture-vnext',
            'reference/agent-harness',
            'reference/receiver-pairing-and-intake',
            'reference/agent-os-roadmap',
            'reference/agentic-interface',
            'reference/knowledge-sharing-and-scaling',
            'reference/privacy-and-stealth',
            'reference/policy-session-permit',
            'reference/erc8004-and-api',
            'reference/skills-system-deep-dive-2026-03-20',
          ],
        },
        {
          type: 'category',
          label: 'Product',
          collapsed: true,
          items: [
            'reference/action-domain-map',
            'reference/product-requirements',
            'reference/original-introduction',
            'reference/scoped-roadmap-2026-03-11',
            'reference/ethereum-foundation-mandate',
          ],
        },
        {
          type: 'category',
          label: 'Operations',
          collapsed: true,
          items: [
            'reference/current-release-status',
            'reference/demo-and-deploy-runbook',
            'reference/live-rails-operator-runbook',
            'reference/testing-and-validation',
            'reference/extension-install-and-distribution',
            'reference/chrome-web-store-checklist',
            'reference/chrome-web-store-reviewer-notes',
            'reference/production-release-checklist',
            'testing/ui-action-coverage',
          ],
        },
        {
          type: 'category',
          label: 'Design',
          collapsed: true,
          items: [
            'reference/coop-design-direction',
            'reference/coop-illustration-brief',
            'reference/extension-ui-redesign-plan',
            'reference/coop-audio-and-asset-ops',
          ],
        },
        {
          type: 'category',
          label: 'Research',
          collapsed: true,
          items: [
            'reference/alibaba-page-agent-comparison',
            'reference/authority-classification',
            'reference/coop-greengoods-onchain-research-2026-03-20',
            'reference/claude-code-vs-coop-harness',
            'reference/grant-landscape-2026-03',
          ],
        },
        'reference/glossary',
        'reference/ui-review-issues',
        'reference/remote-knowledge-skill-reenable-checklist',
        'reference/green-goods-integration-spec',
      ],
    },
  ],
};

export default sidebars;
