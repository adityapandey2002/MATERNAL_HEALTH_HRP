import { expect, test } from "@playwright/test";

const CACHED_USER = {
  id: "33333333-3333-4333-8333-333333333333",
  employeeId: "ANM001",
  name: "Asha Ben",
  phone: "9988776655",
  role: "ANM",
  facilityId: "22222222-2222-4222-8222-222222222222",
  language: "en",
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Phase 3 gate: a deep link opened with no connection must boot the cached
 * shell instead of the browser's offline error page.
 */
test("a cold deep link boots from the cached shell while offline", async ({ page, context }) => {
  await page.addInitScript((user) => {
    localStorage.setItem("accessToken", "e2e-token");
    localStorage.setItem("hrp-cached-session", JSON.stringify({ user, cachedAt: Date.now() }));
  }, CACHED_USER);

  // The preview server has no API, so stub the first online load only. Offline
  // the app must not call the API at all.
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const body = url.includes("/auth/me")
      ? CACHED_USER
      : url.includes("/facilities")
        ? []
        : { data: [], total: 0, page: 1, limit: 20 };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.goto("/patients");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The first load is uncontrolled; reload so the worker serves the route.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Patients" })).toBeVisible();

  await page.unroute("**/api/**");
  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole("heading", { name: "Patients" })).toBeVisible();
  await expect(page.getByText("Offline", { exact: true }).first()).toBeVisible();

  // Patient data lives in IndexedDB. Cache Storage must only hold the shell.
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames.every((name) => name.startsWith("workbox-precache"))).toBe(true);
});

test("the install manifest and every icon it names are served", async ({ request }) => {
  const response = await request.get("/manifest.json");
  expect(response.ok()).toBe(true);

  const manifest = (await response.json()) as {
    theme_color: string;
    icons: { src: string; purpose?: string }[];
  };
  expect(manifest.theme_color).toBe("#0d7a73");
  expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);

  for (const icon of manifest.icons) {
    const iconResponse = await request.get(`/${icon.src}`);
    expect(iconResponse.ok(), icon.src).toBe(true);
  }
});
