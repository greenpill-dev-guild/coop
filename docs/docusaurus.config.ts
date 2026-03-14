import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { coopPrismTheme } from './src/css/coop-prism-theme';

const config: Config = {
  title: 'Coop Docs',
  tagline: 'Turn knowledge into opportunity',
  favicon: 'branding/coop-mark-flat.png',
  url: 'https://docs.coop.technology',
  baseUrl: '/',
  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

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
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/regen-coordination/coop/tree/main/docs/',
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
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/regen-coordination/coop',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Introduction', to: '/docs/intro' },
            { label: 'Architecture', to: '/docs/architecture/coop-os-architecture-vnext' },
            { label: 'PRD', to: '/docs/product/prd' },
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
