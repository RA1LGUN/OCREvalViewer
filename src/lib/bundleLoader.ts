// Extract a user-dropped zip into memory, exposing virtual URLs for dataLoader / pdfPath.
// Expected zip internal structure:
//   manifest.json
//   json/<fid>__<name>.json
//   pdfs/[<sub>/]<doc_name>.pdf
// Also compatible with a top-level doc_exports/ directory (i.e. filename prefix doc_exports/json/...).

import JSZip from 'jszip';
import type { ManifestEntry } from '../types';

export interface Bundle {
  manifest: ManifestEntry[];
  /** Use basename of entry.json_file to look up */
  jsonByName: Map<string, Blob>;
  /** PDFs indexed by doc_name (basename only) */
  pdfByName: Map<string, Blob>;
  /** Object URLs already created for PDFs (lazily created and reused) */
  pdfUrlCache: Map<string, string>;
}

function basename(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return idx >= 0 ? p.slice(idx + 1) : p;
}

export async function loadBundleFromBlob(file: Blob): Promise<Bundle> {
  const zip = await JSZip.loadAsync(file);

  let manifest: ManifestEntry[] | null = null;
  const jsonByName = new Map<string, Blob>();
  const pdfByName = new Map<string, Blob>();

  // Iterate over all files in the zip
  const entries = Object.values(zip.files).filter((f) => !f.dir);
  for (const f of entries) {
    const name = f.name;
    const lower = name.toLowerCase();
    const base = basename(name);

    if (base === 'manifest.json') {
      const text = await f.async('string');
      try {
        manifest = JSON.parse(text) as ManifestEntry[];
      } catch (e) {
        throw new Error(`Failed to parse manifest.json: ${(e as Error).message}`);
      }
    } else if (lower.endsWith('.json') && (lower.includes('/json/') || lower.startsWith('json/'))) {
      const blob = await f.async('blob');
      jsonByName.set(base, new Blob([blob], { type: 'application/json' }));
    } else if (lower.endsWith('.pdf')) {
      const blob = await f.async('blob');
      pdfByName.set(base, new Blob([blob], { type: 'application/pdf' }));
    }
  }

  if (!manifest) {
    throw new Error('manifest.json not found in zip');
  }

  // Validate: check that all JSON files referenced in the manifest are present
  const missing: string[] = [];
  for (const entry of manifest) {
    const jsonBase = basename(entry.json_file);
    if (!jsonByName.has(jsonBase)) missing.push(`json/${jsonBase}`);
  }
  if (missing.length > 0) {
    console.warn('[bundle] The following JSON files are missing from the zip:', missing);
  }

  return {
    manifest,
    jsonByName,
    pdfByName,
    pdfUrlCache: new Map(),
  };
}

/** Release all object URLs created for PDFs to avoid memory leaks */
export function disposeBundle(b: Bundle | null) {
  if (!b) return;
  for (const url of b.pdfUrlCache.values()) URL.revokeObjectURL(url);
  b.pdfUrlCache.clear();
}

export function getJsonBlob(b: Bundle, jsonFileFromManifest: string): Blob | null {
  return b.jsonByName.get(basename(jsonFileFromManifest)) ?? null;
}

export function getPdfUrl(b: Bundle, docName: string): string | null {
  const cached = b.pdfUrlCache.get(docName);
  if (cached) return cached;
  const blob = b.pdfByName.get(basename(docName));
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  b.pdfUrlCache.set(docName, url);
  return url;
}
