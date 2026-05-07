// 计算并缓存「文档 × 模型对 × 页」的 divergenceScore，用于热力图
import { semanticDiff } from './semanticDiff';
import type { DocJson } from '../types';

export interface HeatmapRow {
  modelId: string;
  // index = page，value = divergenceScore，null = 未计算
  scores: Array<number | null>;
}

export interface HeatmapData {
  baseline: string;
  rows: HeatmapRow[];
  totalPages: number;
}

const cache = new Map<string, HeatmapData>(); // key: doc_fid + baseline

function cacheKey(docFid: string, baseline: string) {
  return `${docFid}::${baseline}`;
}

export function getOrInit(doc: DocJson, baseline: string): HeatmapData {
  const key = cacheKey(doc.doc_fid, baseline);
  let data = cache.get(key);
  if (data) return data;
  const totalPages = Math.max(0, ...doc.ocr_results.map((r) => r.pages.length));
  data = {
    baseline,
    totalPages,
    rows: doc.ocr_results
      .filter((r) => r.model_id !== baseline)
      .map((r) => ({
        modelId: r.model_id,
        scores: new Array(totalPages).fill(null),
      })),
  };
  cache.set(key, data);
  return data;
}

/** 增量计算 N 页（用 setTimeout 切片避免长任务卡住主线程）。
 *  完成一批后调用 onProgress，便于 UI 重绘。 */
export function computeBatch(
  doc: DocJson,
  baseline: string,
  onProgress: () => void,
  batchSize = 4,
): { cancel: () => void } {
  const data = getOrInit(doc, baseline);
  const baselineResult = doc.ocr_results.find((r) => r.model_id === baseline);
  if (!baselineResult) return { cancel: () => {} };

  // 收集所有待计算的 (modelIdx, page) 任务
  const tasks: Array<[number, number]> = [];
  for (let mi = 0; mi < data.rows.length; mi++) {
    const row = data.rows[mi];
    for (let p = 0; p < data.totalPages; p++) {
      if (row.scores[p] === null) tasks.push([mi, p]);
    }
  }

  let cancelled = false;
  let i = 0;

  function tick() {
    if (cancelled) return;
    const end = Math.min(i + batchSize, tasks.length);
    for (; i < end; i++) {
      const [mi, p] = tasks[i];
      const row = data.rows[mi];
      const modelResult = doc.ocr_results.find((r) => r.model_id === row.modelId);
      const aPage = baselineResult!.pages.find((pg) => pg.page_num === p)?.result ?? '';
      const bPage = modelResult?.pages.find((pg) => pg.page_num === p)?.result ?? '';
      try {
        const { stats } = semanticDiff(aPage, bPage);
        row.scores[p] = stats.divergenceScore;
      } catch {
        row.scores[p] = 0;
      }
    }
    onProgress();
    if (i < tasks.length) {
      setTimeout(tick, 0);
    }
  }
  setTimeout(tick, 0);

  return {
    cancel: () => {
      cancelled = true;
    },
  };
}
