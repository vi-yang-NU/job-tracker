from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

from scrapy import Request, Spider, signals
from scrapy.crawler import CrawlerProcess


class FetchSpider(Spider):
    name = "jobtracker_fetch"

    custom_settings = {
        "LOG_ENABLED": False,
        "ROBOTSTXT_OBEY": False,
        "COOKIES_ENABLED": True,
        "REDIRECT_ENABLED": True,
        "RETRY_ENABLED": True,
        "RETRY_TIMES": 2,
        "DOWNLOAD_TIMEOUT": 30,
        "USER_AGENT": os.environ.get(
            "JOBTRACKER_SCRAPY_UA",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) JobTracker/0.1 Chrome/120.0.0.0 Safari/537.36",
        ),
    }

    def __init__(self, url: str, **kwargs: Any) -> None:
                super().__init__(**kwargs)
                self.start_url = url

    def start_requests(self):
        yield Request(self.start_url, callback=self.parse, dont_filter=True)

    def parse(self, response):
        yield {
            "html": response.text,
            "status": response.status,
            "finalUrl": response.url,
        }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fetch one URL with Scrapy and print JSON.")
    parser.add_argument("--url", required=True)
    args = parser.parse_args(argv)

    result: dict[str, Any] = {}

    def on_item_scraped(item, response, spider):
        result.clear()
        result.update(dict(item))

    process = CrawlerProcess()
    crawler = process.create_crawler(FetchSpider)
    crawler.signals.connect(on_item_scraped, signal=signals.item_scraped)
    process.crawl(crawler, url=args.url)
    process.start()

    if not result:
        print(json.dumps({"error": "scrapy did not return a response"}), file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())