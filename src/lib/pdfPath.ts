import type { ManifestEntry } from '../types';
import type { Bundle } from './bundleLoader';
import { getPdfUrl } from './bundleLoader';
import { PDF_LANG_DIRS, R2_BASE } from '../config';

// 远程 PDF URL 解析结果按 doc_fid 缓存，避免每次切页都重新探测。
// 值为 null 表示已探测过、确认在 R2 上找不到。
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
 * 解析某文档的 PDF URL：
 * - bundle 模式：直接从 zip 内查找
 * - 远程模式：优先 entry.pdf_path；否则按 PDF_LANG_DIRS 顺序探测 pdfs/<lang>/<doc_name>，最后裸 pdfs/<doc_name>
 *
 * 返回 null 表示真的找不到（应在 UI 上提示）。
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
