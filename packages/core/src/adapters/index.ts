import type { SiteAdapter } from "../types";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import { ashby } from "./ashby";
import { linkedin } from "./linkedin";
import { generic } from "./generic";

const ordered: SiteAdapter[] = [greenhouse, lever, ashby, linkedin, generic];

export function detectAdapter(url: string): SiteAdapter {
  for (const a of ordered) if (a !== generic && a.matches(url)) return a;
  return generic;
}

export function listAdapters(): SiteAdapter[] {
  return ordered;
}

export { greenhouse, lever, ashby, linkedin, generic };
