import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: ['getting-started/extension-install-and-distribution'],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/coop-os-architecture-vnext',
        'architecture/agent-harness',
        'architecture/knowledge-sharing-and-scaling',
        'architecture/green-goods-integration-spec',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/demo-and-deploy-runbook',
        'guides/testing-and-validation',
        'guides/coop-design-direction',
        'guides/coop-audio-and-asset-ops',
      ],
    },
    {
      type: 'category',
      label: 'Product',
      items: [
        'product/prd',
        'product/scoped-roadmap-2026-03-11',
        'product/ethereum-foundation-mandate',
        'ui-review-issues',
      ],
    },
  ],
};

export default sidebars;
