import type { ManifestEntry } from '../types';
import type { Bundle } from './bundleLoader';
import { getPdfUrl } from './bundleLoader';
import { PDF_LANG_DIRS, R2_BASE } from '../config';

// Remote PDF URL resolution results are cached by doc_fid to avoid re-probing on every page switch.
// A value of null means we already probed and confirmed the PDF is not available on R2.
const remoteUrlCache = new Map<string, string | null>();

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve the PDF URL for a document:
 * - bundle mode: look up directly from the zip
 * - remote mode: prefer entry.pdf_path; otherwise probe pdfs/<lang>/<doc_name> in PDF_LANG_DIRS order, then bare pdfs/<doc_name>
 *
 * Returns null if the PDF truly cannot be found (UI should show a hint).
 */
export async function resolvePdfUrl(
  entry: ManifestEntry,
  bundle: Bundle | null,
): Promise<string | null> {
  if (bundle) return getPdfUrl(bundle, entry.doc_name);

  if (remoteUrlCache.has(entry.doc_fid)) {
    return remoteUrlCache.get(entry.doc_fid)!;
  }

  const candidates: string[] = [];
  if (entry.pdf_path) {
    candidates.push(`${R2_BASE}/${entry.pdf_path.replace(/^\/+/, '')}`);
  } else {
    for (const lang of PDF_LANG_DIRS) {
      candidates.push(`${R2_BASE}/pdfs/${lang}/${entry.doc_name}`);
    }
    candidates.push(`${R2_BASE}/pdfs/${entry.doc_name}`);
  }

  for (const url of candidates) {
    if (await headOk(url)) {
      remoteUrlCache.set(entry.doc_fid, url);
      return url;
    }
  }

  remoteUrlCache.set(entry.doc_fid, null);
  return null;
}

export function resetPdfUrlCache() {
  remoteUrlCache.clear();
}
