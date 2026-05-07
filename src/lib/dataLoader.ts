import type { DocJson, ManifestEntry } from '../types';
import type { Bundle } from './bundleLoader';
import { getJsonBlob } from './bundleLoader';
import { R2_BASE } from '../config';

const docCache = new Map<string, DocJson>();
let manifestCache: ManifestEntry[] | null = null;

export function resetCache() {
  docCache.clear();
  manifestCache = null;
}

export async function loadManifest(bundle: Bundle | null): Promise<ManifestEntry[]> {
  if (bundle) return bundle.manifest;
  if (manifestCache) return manifestCache;
  const res = await fetch(`${R2_BASE}/doc_exports/manifest.json`);
  if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`);
  manifestCache = (await res.json()) as ManifestEntry[];
  return manifestCache;
}

export async function loadDoc(entry: ManifestEntry, bundle: Bundle | null): Promise<DocJson> {
  const cacheKey = (bundle ? 'b:' : 'h:') + entry.doc_fid;
  const cached = docCache.get(cacheKey);
  if (cached) return cached;

  if (bundle) {
    const blob = getJsonBlob(bundle, entry.json_file);
    if (!blob) throw new Error(`zip 中找不到 ${entry.json_file}`);
    const text = await blob.text();
    const data = JSON.parse(text) as DocJson;
    docCache.set(cacheKey, data);
    return data;
  }

  const fileName = entry.json_file.split('/').pop()!;
  const url = `${R2_BASE}/doc_exports/json/${fileName}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load doc json: ${res.status}`);
  const data = (await res.json()) as DocJson;
  docCache.set(cacheKey, data);
  return data;
}
