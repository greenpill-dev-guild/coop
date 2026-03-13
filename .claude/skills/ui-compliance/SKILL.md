---
name: ui-compliance
user-invocable: false
description: UI compliance - WCAG 2.1 AA accessibility, form validation patterns, responsive layouts, and animation best practices. Use when building or reviewing components for accessibility compliance, form UX, mobile-first responsive design, or motion preferences.
version: "1.0.0"
status: active
packages: ["shared", "app", "extension"]
dependencies: []
last_updated: "2026-03-12"
last_verified: "2026-03-12"
---

# UI Compliance Skill

Complete UI guide: accessibility, forms, responsive design, animation, and theming.

---

## Activation

When invoked:
- Start with accessibility checks (WCAG AA).
- Validate forms with appropriate validation patterns.
- Ensure responsive behavior across mobile and desktop.

## Part 1: Accessibility (CRITICAL)

**Every Coop user deserves equal access.**

### Interactive Elements

```typescript
// Bad: Inaccessible
<div onClick={handleClick}>Submit</div>

// Good: Accessible
<button onClick={handleClick} aria-label="Submit draft">
  Submit
</button>
```

### Checklist

- [ ] ARIA labels on interactive elements without visible text
- [ ] Semantic HTML (`<button>`, `<nav>`, `<main>`, not `<div onClick>`)
- [ ] Keyboard handlers for mouse interactions (`onClick` + `onKeyDown`)
- [ ] Alt text for images (or `alt=""` for decorative)
- [ ] Skip links for keyboard navigation

### Focus States

```css
/* Use :focus-visible, not :focus (avoids mouse focus rings) */
button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

- [ ] Visible focus indicator on all interactive elements
- [ ] Use `:focus-visible` (not `:focus`)
- [ ] Group focus with `:focus-within` for compound components
- [ ] Never `outline: none` without replacement

---

## Part 2: Forms (HIGH)

### Form Pattern

```typescript
<label htmlFor="coop-name">Coop Name</label>
<input
  id="coop-name"
  type="text"
  autoComplete="organization"
  aria-describedby={errors.name ? "name-error" : undefined}
/>
{errors.name && (
  <p id="name-error" role="alert">{errors.name.message}</p>
)}
```

### Checklist

- [ ] `autocomplete` attribute on inputs
- [ ] Correct `type` for inputs (email, tel, url)
- [ ] Labels associated via `htmlFor`/`id`
- [ ] Error messages linked with `aria-describedby`
- [ ] Never disable paste on password fields

---

## Part 3: Responsive Design

### Mobile-First Breakpoints

```css
/* Base: Mobile (< 640px) */
@media (min-width: 640px) { /* sm: Landscape phones */ }
@media (min-width: 768px) { /* md: Tablets */ }
@media (min-width: 1024px) { /* lg: Laptops */ }
@media (min-width: 1280px) { /* xl: Desktops */ }
@media (min-width: 1536px) { /* 2xl: Large desktops */ }
```

### Container Queries

```tsx
// Tailwind container queries
function ResponsiveCard({ title, image }) {
  return (
    <div className="@container">
      <article className="flex flex-col @md:flex-row @md:gap-4">
        <img className="w-full @md:w-48 @lg:w-64" src={image} />
        <h2 className="text-lg @md:text-xl @lg:text-2xl">{title}</h2>
      </article>
    </div>
  );
}
```

### Fluid Typography

```css
:root {
  /* clamp(min, preferred, max) */
  --text-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
  --text-xl: clamp(1.25rem, 1rem + 1.25vw, 1.5rem);
  --space-md: clamp(1rem, 0.8rem + 1vw, 1.5rem);
}
```

### CSS Grid Auto-Fit

```css
.grid-auto {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: 1.5rem;
}
```

### Viewport Units

```css
/* Dynamic viewport (accounts for mobile browser UI) */
.full-height {
  height: 100dvh;  /* Recommended for mobile */
}
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Horizontal overflow | Check fixed widths, use `max-width: 100%` |
| 100vh on mobile | Use `100dvh` for dynamic viewport |
| Small touch targets | Minimum 44x44px, use padding |
| Font too small | Base 16px minimum, use `clamp()` |
| Image distortion | Use `object-fit: cover` with aspect-ratio |

---

## Part 4: Animation (HIGH)

### Reduced Motion

```css
/* Only animate if user allows */
@media (prefers-reduced-motion: no-preference) {
  .card {
    transition: transform 200ms ease-out, opacity 200ms ease-out;
  }
}
```

### Checklist

- [ ] `prefers-reduced-motion` media query respected
- [ ] Only animate `transform` and `opacity` (GPU-accelerated)
- [ ] Animations are interruptible (not blocking input)
- [ ] No `transition: all` (specify properties)

---

## Part 5: Images (HIGH)

```typescript
<img
  src={tabScreenshot}
  alt="Screenshot of saved tab"
  width={300}
  height={200}
  loading="lazy"
/>
```

### Checklist

- [ ] Explicit `width` and `height` to prevent CLS
- [ ] `loading="lazy"` for below-fold images
- [ ] `fetchpriority="high"` for above-fold hero images

---

## Part 6: Extension-Specific Considerations

Browser extension UIs have unique constraints:

| Context | Constraint | Solution |
|---------|-----------|----------|
| Popup | Fixed width (~400px) | Design for narrow viewport |
| Sidepanel | Variable width | Use responsive patterns, container queries |
| Background | No UI | N/A — logic only |

### Extension Popup

```css
/* Extension popup has fixed dimensions */
.popup-root {
  width: 400px;
  max-height: 600px;
  overflow-y: auto;
}
```

---

## Part 7: Dark Mode & Theming

```css
/* Coop theme tokens */
:root {
  color-scheme: light dark;
}

[data-theme="dark"] {
  --bg-primary: #0f0f0f;
  --text-primary: #ffffff;
}
```

### Checklist

- [ ] `color-scheme` declaration in CSS
- [ ] `theme-color` meta tag (changes browser chrome)
- [ ] Use semantic tokens (`--bg-*`, `--text-*`)

---

## Part 8: Performance

```typescript
// Virtualization for long lists (50+ items)
import { useVirtualizer } from "@tanstack/react-virtual";

const rowVirtualizer = useVirtualizer({
  count: tabs.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 72,
});
```

### Checklist

- [ ] Virtualize lists > 50 items
- [ ] Batch DOM updates (avoid layout thrashing)
- [ ] `preconnect` for external origins
- [ ] Controlled inputs don't re-render parent

---

## Part 9: Navigation & State

- [ ] UI state reflected in URL (filters, tabs, pagination) where applicable
- [ ] Deep linking works (app receiver)
- [ ] Destructive actions require confirmation
- [ ] Back button works as expected

---

## Part 10: Mobile Safe Areas

```css
/* Mobile safe area for notched devices */
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## Quick Reference Checklist

### Before Merging UI Code

**Accessibility**
- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels on icon-only buttons
- [ ] Focus indicators visible (`:focus-visible`)

**Forms**
- [ ] Labels linked to inputs
- [ ] Error messages have `aria-describedby`
- [ ] Autocomplete attributes set

**Responsive**
- [ ] Mobile-first styles (min-width breakpoints)
- [ ] Touch targets 44x44px minimum
- [ ] 100dvh instead of 100vh

**Performance**
- [ ] Images have dimensions
- [ ] Long lists virtualized
- [ ] Animations use transform/opacity only

## Anti-Patterns

- Relying on color alone to convey state or validation failures
- Shipping forms without accessible labels and error associations
- Ignoring `prefers-reduced-motion` for animated interactions
- Assuming desktop-only layouts without mobile verification

## Related Skills

- `frontend-design` — Visual design patterns that must meet compliance standards
- `react` — React patterns for accessible component composition
