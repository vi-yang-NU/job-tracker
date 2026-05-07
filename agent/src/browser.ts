import { chromium, type Browser } from "playwright";

let browser: Browser | undefined;

async function getBrowser(): Promise<Browser> {
  if (browser) return browser;
  browser = await chromium.launch({ headless: true });
  return browser;
}

export async function fetchHtmlWithBrowser(
  url: string
): Promise<{ html: string; status: number; finalUrl: string }> {
  const b = await getBrowser();
  const ctx = await b.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) JobTracker/0.1 Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();
  let status = 0;
  page.on("response", (r) => {
    if (r.url() === url || r.url().startsWith(url)) status = r.status();
  });
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (resp) status = resp.status();
    // Give SPAs a moment to populate the DOM
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const html = await page.content();
    const finalUrl = page.url();
    return { html, status: status || 200, finalUrl };
  } finally {
    await ctx.close();
  }
}

export async function shutdownBrowser() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = undefined;
  }
}
