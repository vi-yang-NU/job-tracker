import type { SiteAdapter } from "../types.js";
import { greenhouse } from "./greenhouse.js";
import { lever } from "./lever.js";
import { ashby } from "./ashby.js";
import { linkedin } from "./linkedin.js";
import { generic } from "./generic.js";

const ordered: SiteAdapter[] = [greenhouse, lever, ashby, linkedin, generic];

export function detectAdapter(url: string): SiteAdapter {
  for (const a of ordered) if (a !== generic && a.matches(url)) return a;
  return generic;
}

export function listAdapters(): SiteAdapter[] {
  return ordered;
}

export { greenhouse, lever, ashby, linkedin, generic };
