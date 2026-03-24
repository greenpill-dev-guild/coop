import { ErrorCauseBoundary, ThemeClassNames, useThemeConfig } from '@docusaurus/theme-common';
import type { NavbarItemConfig } from '@docusaurus/theme-common';
import { splitNavbarItems, useNavbarMobileSidebar } from '@docusaurus/theme-common/internal';
import AudienceTabs from '@site/src/components/AudienceTabs';
import NavbarLogo from '@theme/Navbar/Logo';
import NavbarMobileSidebarToggle from '@theme/Navbar/MobileSidebar/Toggle';
import NavbarItem from '@theme/NavbarItem';
import styles from './styles.module.css';

function useNavbarItems(): NavbarItemConfig[] {
  return useThemeConfig().navbar.items;
}

function NavbarItems({ items }: { items: NavbarItemConfig[] }) {
  return (
    <>
      {items.map((item) => (
        <ErrorCauseBoundary
          key={item.label ?? item.to ?? item.href}
          onError={(error) =>
            new Error(
              `A theme navbar item failed to render.
Please double-check the following navbar item (themeConfig.navbar.items) of your Docusaurus config:
${JSON.stringify(item, null, 2)}`,
              { cause: error },
            )
          }
        >
          <NavbarItem {...item} />
        </ErrorCauseBoundary>
      ))}
    </>
  );
}

export default function NavbarContent() {
  const mobileSidebar = useNavbarMobileSidebar();
  const items = useNavbarItems();
  const [leftItems, rightItems] = splitNavbarItems(items);

  return (
    <div className={`navbar__inner ${styles.navbarInner}`}>
      <div
        className={`${ThemeClassNames.layout.navbar.containerLeft} navbar__items ${styles.left}`}
      >
        {!mobileSidebar.disabled && <NavbarMobileSidebarToggle />}
        <NavbarLogo />
        <NavbarItems items={leftItems} />
      </div>

      <div className={styles.center}>
        <AudienceTabs />
      </div>

      <div
        className={`${ThemeClassNames.layout.navbar.containerRight} navbar__items navbar__items--right ${styles.right}`}
      >
        <NavbarItems items={rightItems} />
      </div>
    </div>
  );
}
