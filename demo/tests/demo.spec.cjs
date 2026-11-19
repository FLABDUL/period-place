const { test, expect } = require("@playwright/test")
const AxeBuilder = require("@axe-core/playwright").default

test.beforeEach(async ({ page }) => {
  // Do not download public map tiles during automated browser tests.
  await page.route("https://tile.openstreetmap.org/**", route =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP48PotAAWXAsk3Uo2DAAAAAElFTkSuQmCC",
        "base64",
      ),
    }),
  )
})

test("Period Place restores the original interface and combined evidence filters", async ({
  page,
  request,
}) => {
  const errors = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto("./")
  await expect(page.locator("#theme")).toBeEnabled()
  await expect(
    page.getByRole("heading", { name: "Find free period products near you" }),
  ).toBeVisible()
  await expect(page.locator(".proof-brand")).toHaveText(
    "Free products. Clear evidence.",
  )
  for (const asset of [
    "demo.css",
    "original.css",
    "vendor/maplibre-gl.mjs",
    "fonts/dm-sans.woff2",
  ]) {
    expect((await request.get(`./${asset}`)).status()).toBe(
      200,
    )
  }
  await page.screenshot({
    path: "test-results/period-place-home.png",
    fullPage: true,
  })
  await page
    .getByRole("link", { name: "Find free products", exact: true })
    .click()
  const search = page.getByRole("searchbox", {
    name: "Search locations, products or brands",
  })
  await expect(search).toBeEnabled()
  await expect(page.locator("#count")).toHaveText(
    "8 matching / 8 sample locations",
  )
  await expect(page.locator(".maplibregl-canvas")).toBeVisible()
  await expect(page.locator(".demo-pin")).toHaveCount(8)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page
    .locator("#venue-riverside")
    .getByRole("button", { name: "Show on map", exact: true })
    .click()
  await expect(page.locator("#venue-riverside")).toHaveClass(/selected/)
  await page.screenshot({
    path: "test-results/period-place-finder.png",
    fullPage: true,
  })
  await page.getByRole("button", { name: "Pads", exact: true }).click()
  await page
    .getByRole("button", { name: "Organic cotton", exact: true })
    .click()
  // Riverside has organic tampons, not organic pads: filters match one offering.
  await expect(page.locator("#count")).toHaveText(
    "1 matching / 8 sample locations",
  )
  await expect(page.locator("#results")).toContainText("Cedar Wellbeing Centre")
  await page
    .getByRole("link", { name: "Details and visits", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Cedar Wellbeing Centre", exact: true }),
  ).toBeVisible()
  await page.getByRole("link", { name: "Back to finder" }).click()
  await expect(page.locator("#count")).toHaveText(
    "1 matching / 8 sample locations",
  )
  await page
    .getByRole("button", { name: "Clear search and filters", exact: true })
    .click()
  await search.fill("Glasgow")
  await expect(page.locator("#count")).toHaveText(
    "2 matching / 8 sample locations",
  )
  await page.locator("#theme").click()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
  await page.screenshot({
    path: "test-results/period-place-finder-light.png",
    fullPage: true,
  })
  for (const unknownView of ["constructor", "__proto__", "missing"]) {
    await page.goto(`./#${unknownView}`)
    await expect(
      page.getByRole("heading", { name: "Find free period products near you" }),
    ).toBeVisible()
  }
  expect(errors).toEqual([])
})

test("Period Place moderation gates stock changes and keeps submissions local", async ({
  page,
}) => {
  const posts = []
  page.on("request", request => {
    const url = new URL(request.url())
    const previewLogin =
      process.env.SMOKE_ENV?.toLowerCase() === "preview" &&
      url.origin === "https://vercel.live" &&
      url.pathname === "/login/validate"
    if (request.method() === "POST" && !previewLogin) posts.push(request.url())
  })
  await page.goto("./#report/riverside")
  await expect(
    page.getByRole("button", { name: "Submit demo report" }),
  ).toBeEnabled()
  await page.getByLabel("What did you find?").selectOption("Recently empty")
  const comment =
    '<img src=x onerror="window.demoInjected=true"> Fictional test report'
  await page.getByLabel("Details for the moderator").fill(comment)
  await page.getByRole("button", { name: "Submit demo report" }).click()
  await expect(page.locator("#report-status")).toContainText(
    "The listing has not changed",
  )
  await page
    .getByRole("link", { name: "Review this report in demo moderation" })
    .click()
  await expect(page.locator("#queue")).toContainText(comment)
  await page.getByRole("link", { name: "View location evidence" }).click()
  await expect(page.locator(".availability-banner")).toContainText(
    "Recently available",
  )
  await page
    .locator("footer")
    .getByRole("link", { name: "Demo moderation", exact: true })
    .click()
  await page.getByRole("button", { name: "Approve report 1" }).click()
  await page.getByRole("link", { name: "View location evidence" }).click()
  await expect(page.locator(".availability-banner")).toContainText(
    "Recently empty",
  )
  await expect(page.locator("#visit-comments")).toContainText(comment)
  expect(await page.evaluate(() => window.demoInjected)).toBeUndefined()
  await page.getByRole("link", { name: "Report a visit or correction" }).click()
  await page.getByRole("button", { name: "Submit demo report" }).click()
  await page
    .getByRole("link", { name: "Review this report in demo moderation" })
    .click()
  await page.getByRole("button", { name: "Reject report 2" }).click()
  await page
    .locator(".queue-item")
    .last()
    .getByRole("link", { name: "View location evidence" })
    .click()
  await expect(page.locator(".availability-banner")).toContainText(
    "Recently empty",
  )
  await page.reload()
  await expect(page.locator(".availability-banner")).toContainText(
    "Recently available",
  )
  expect(posts).toEqual([])
})

test("Period Place works on mobile with accessible themes and coverage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("./")
  await expect(page.locator("#theme")).toBeEnabled()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.locator("#theme").click()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.getByText("Menu", { exact: true }).click()
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Coverage", exact: true })
    .click()
  await expect(page.locator(".nation-grid .gap")).toContainText("Wales")
  await page.getByLabel("Find a sample coverage area").fill("Glasgow")
  await expect(page.locator("#coverage-rows .coverage-row")).toHaveCount(1)
  await page.getByText("Menu", { exact: true }).click()
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Find products", exact: true })
    .click()
  await expect(page.locator("#count")).toHaveText(
    "8 matching / 8 sample locations",
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: "test-results/period-place-demo-mobile.png",
    fullPage: true,
  })
})
