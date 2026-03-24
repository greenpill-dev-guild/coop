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
    builderDoc('builder/agentic-harness'),
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
          label: 'Architecture',
          collapsed: true,
          items: [
            'reference/coop-os-architecture-vnext',
            'reference/agent-harness',
            'reference/agent-os-roadmap',
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
            'reference/demo-and-deploy-runbook',
            'reference/testing-and-validation',
            'reference/extension-install-and-distribution',
            'reference/chrome-web-store-checklist',
            'reference/chrome-web-store-reviewer-notes',
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
