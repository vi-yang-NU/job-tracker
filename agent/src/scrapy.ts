import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) JobTracker/0.1 Chrome/120.0.0.0 Safari/537.36";

export async function fetchHtmlWithScrapy(
  url: string
): Promise<{ html: string; status: number; finalUrl: string }> {
  try {
    return await runScrapyFetch(url);
  } catch {
    return fetchHtmlDirect(url);
  }
}

async function runScrapyFetch(url: string): Promise<{ html: string; status: number; finalUrl: string }> {
  const python =
    process.env.JOBTRACKER_SCRAPY_PYTHON ??
    process.env.PYTHON ??
    process.env.PYTHON_EXECUTABLE ??
    "python";
  const script = fileURLToPath(new URL("../../scraper/jobtracker_scraper/cli.py", import.meta.url));

  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(python, [script, "--url", url], {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        JOBTRACKER_SCRAPY_UA: UA,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr.trim() || `scrapy exited with code ${code}`));
      }
    });
  });

  const data = JSON.parse(output) as { html: string; status: number; finalUrl: string };
  if (!data?.html || !data.finalUrl) {
    throw new Error("scrapy returned an invalid response");
  }
  return data;
}

async function fetchHtmlDirect(url: string): Promise<{ html: string; status: number; finalUrl: string }> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  const html = await res.text();
  return { html, status: res.status, finalUrl: res.url || url };
}