# Scrapy sidecar

This folder holds the optional Python scraping sidecar used by the agent for non-browser HTML fetches.

It is intentionally small:

- the Node agent calls it when a job does not need Playwright rendering
- the spider fetches a single URL and returns normalized JSON: `html`, `status`, and `finalUrl`
- TypeScript adapters in `packages/core` still do the parsing, so the rest of the app keeps the same contract

Install locally if you want to use the Scrapy path:

```bash
python -m pip install -r scraper/requirements.txt
```

You can point the agent at a specific Python binary with `JOBTRACKER_SCRAPY_PYTHON` if needed.