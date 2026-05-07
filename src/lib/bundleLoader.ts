// 把用户拖入的 zip 解压到内存，暴露虚拟 URL 供 dataLoader / pdfPath 使用。
// 约定的 zip 内部结构：
//   manifest.json
//   json/<fid>__<name>.json
//   pdfs/[<sub>/]<doc_name>.pdf
// 也兼容把 doc_exports/ 顶层目录一起打进去（即文件名前缀是 doc_exports/json/...）。

import JSZip from 'jszip';
import type { ManifestEntry } from '../types';

export interface Bundle {
  manifest: ManifestEntry[];
  /** 取 entry.json_file 的 basename 即可命中 */
  jsonByName: Map<string, Blob>;
  /** PDF 按 doc_name 索引（仅 basename） */
  pdfByName: Map<string, Blob>;
  /** 已经为 PDF 创建过的 object URL（懒创建并复用） */
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

  // 遍历 zip 里所有文件
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
        throw new Error(`manifest.json 解析失败：${(e as Error).message}`);
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
    throw new Error('zip 里没有找到 manifest.json');
  }

  // 校验：manifest 里引用的 json 是否都齐
  const missing: string[] = [];
  for (const entry of manifest) {
    const jsonBase = basename(entry.json_file);
    if (!jsonByName.has(jsonBase)) missing.push(`json/${jsonBase}`);
  }
  if (missing.length > 0) {
    console.warn('[bundle] 以下 JSON 在 zip 中缺失：', missing);
  }

  return {
    manifest,
    jsonByName,
    pdfByName,
    pdfUrlCache: new Map(),
  };
}

/** 释放所有为 PDF 创建过的 object URL，避免内存泄漏 */
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
