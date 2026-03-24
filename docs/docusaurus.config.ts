import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { coopPrismTheme } from './src/css/coop-prism-theme';

const config: Config = {
  title: 'Coop Docs',
  tagline: 'Turn knowledge into opportunity',
  favicon: 'branding/coop-mark-watching.png',
  url: 'https://docs.coop.town',
  baseUrl: '/',
  onBrokenLinks: 'warn',
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  themes: ['@docusaurus/theme-mermaid'],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: '.',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/regen-coordination/coop/tree/main/docs/',
          sidebarCollapsed: false,
          exclude: [
            '**/node_modules/**',
            '**/src/**',
            '**/static/**',
            '**/build/**',
            '**/.docusaurus/**',
          ],
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects: [
          {
            to: '/',
            from: ['/docs', '/docs/intro'],
          },
          {
            to: '/builder/getting-started',
            from: ['/docs/getting-started/extension-install-and-distribution'],
          },
          {
            to: '/builder/architecture',
            from: ['/docs/architecture/coop-os-architecture-vnext'],
          },
          {
            to: '/builder/agentic-harness',
            from: ['/docs/architecture/agent-harness'],
          },
          {
            to: '/builder/p2p-functionality',
            from: ['/docs/architecture/knowledge-sharing-and-scaling'],
          },
          {
            to: '/privacy-security',
            from: ['/docs/architecture/privacy-and-stealth'],
          },
          {
            to: '/reference/policy-session-permit',
            from: ['/docs/architecture/policy-session-permit'],
          },
          {
            to: '/reference/erc8004-and-api',
            from: ['/docs/architecture/erc8004-and-api'],
          },
          {
            to: '/builder/integrations/green-goods',
            from: ['/docs/architecture/green-goods-integration-spec'],
          },
          {
            to: '/builder/rd',
            from: ['/docs/architecture/agent-os-roadmap'],
          },
          {
            to: '/reference/product-requirements',
            from: ['/docs/product/prd'],
          },
          {
            to: '/road-ahead',
            from: ['/docs/product/scoped-roadmap-2026-03-11'],
          },
          {
            to: '/reference/ethereum-foundation-mandate',
            from: ['/docs/product/ethereum-foundation-mandate'],
          },
          {
            to: '/reference/demo-and-deploy-runbook',
            from: ['/docs/guides/demo-and-deploy-runbook'],
          },
          {
            to: '/reference/testing-and-validation',
            from: ['/docs/guides/testing-and-validation'],
          },
          {
            to: '/reference/coop-design-direction',
            from: ['/docs/guides/coop-design-direction'],
          },
          {
            to: '/reference/coop-audio-and-asset-ops',
            from: ['/docs/guides/coop-audio-and-asset-ops'],
          },
          {
            to: '/reference/ui-review-issues',
            from: ['/docs/ui-review-issues'],
          },
        ],
      },
    ],
  ],

  themeConfig: {
    image: 'branding/coop-wordmark-flat.png',
    navbar: {
      title: '',
      logo: {
        alt: 'Coop',
        src: 'branding/coop-wordmark-flat.png',
        style: { height: '32px' },
      },
      items: [
        {
          href: 'https://github.com/regen-coordination/coop',
          label: 'GitHub',
          position: 'right',
          className: 'docs-navbar-github',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Community',
          items: [
            { label: 'Welcome To Coop', to: '/' },
            { label: 'How It Works', to: '/how-it-works' },
            { label: 'Pricing', to: '/pricing' },
          ],
        },
        {
          title: 'Builder',
          items: [
            { label: 'Getting Started', to: '/builder/getting-started' },
            { label: 'Architecture', to: '/builder/architecture' },
            { label: 'Integrations', to: '/builder/integrations' },
          ],
        },
        {
          title: 'Reference',
          items: [
            { label: 'Product Requirements', to: '/reference/product-requirements' },
            { label: 'Runbook', to: '/reference/demo-and-deploy-runbook' },
            { label: 'Glossary', to: '/glossary' },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/regen-coordination/coop',
            },
          ],
        },
      ],
      copyright: 'Coop — browser-first knowledge commons',
    },
    prism: {
      theme: coopPrismTheme,
      darkTheme: coopPrismTheme,
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
