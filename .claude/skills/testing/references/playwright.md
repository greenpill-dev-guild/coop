# Playwright E2E Guide

## Testing Pyramid

```
        /-------\
       /  E2E   \    <- Few, critical paths only
      /-----------\
     / Integration \  <- More, component interactions
    /---------------\
   /      Unit       \ <- Many, fast, isolated
  /-------------------\
```

## What to Test with E2E

- Critical user journeys (coop creation, tab collection, publish flow)
- Complex interactions (multi-step flows, cross-device sync)
- Extension popup and sidepanel workflows
- Authentication flows (passkey)

## What NOT to Test with E2E

- Unit-level logic (use Vitest)
- API contracts (use integration tests)
- Edge cases (too slow)

## Page Object Model

```typescript
// e2e/pages/CoopPage.ts
import { Locator, Page } from "@playwright/test";

export class CoopPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.getByLabel("Coop Name");
    this.createButton = page.getByRole("button", { name: "Launch Coop" });
  }

  async goto() {
    await this.page.goto("/create");
  }

  async createCoop(name: string) {
    await this.nameInput.fill(name);
    await this.createButton.click();
  }
}
```

## Waiting Strategies

```typescript
// Bad: Fixed timeout
await page.waitForTimeout(3000);

// Good: Wait for specific condition
await page.waitForLoadState("networkidle");
await page.waitForURL("/dashboard");
await expect(page.getByText("Welcome")).toBeVisible();

// Good: Wait for response
await page.waitForResponse((response) =>
  response.url().includes("/api/coops") && response.status() === 200
);
```

## Selector Best Practices

```typescript
// Bad: Brittle selectors
page.locator(".btn.btn-primary.submit-button").click();

// Good: Role-based selectors
page.getByRole("button", { name: "Submit" }).click();
page.getByLabel("Email address").fill("user@example.com");

// Good: Test IDs when needed
page.getByTestId("tab-list").click();
```

## Network Mocking

```typescript
// Mock API response
await page.route("**/api/coops", (route) => {
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{ id: "coop-1", name: "Test Coop" }]),
  });
});

// Test error states
await page.route("**/api/publish", (route) => {
  route.fulfill({
    status: 500,
    body: JSON.stringify({ error: "Internal Server Error" }),
  });
});
```

## Accessibility Testing

**E2E with Playwright + AxeBuilder:**

```typescript
import AxeBuilder from "@axe-core/playwright";

test("dashboard is accessible", async ({ page }) => {
  await page.goto("/dashboard");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

## Debugging

```bash
npx playwright test --headed     # Run in headed mode
npx playwright test --debug      # Debug mode (step through)
npx playwright test --ui         # UI mode (interactive)
npx playwright show-report       # Generate report
```
