import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { computeBatch, getOrInit } from '../lib/heatmap';

export function HeatmapBar() {
  const { currentDoc, page, modelA, modelB, setPage, setModelA, setModelB } = useAppStore();
  const [baseline, setBaseline] = useState<string | null>(null);
  const [, force] = useState(0); // 用于在批量计算进度回调时刷新

  const models = currentDoc?.ocr_results.map((r) => r.model_id) ?? [];

  // 当文档切换时，初始化 baseline
  useEffect(() => {
    if (currentDoc && (!baseline || !models.includes(baseline))) {
      setBaseline(models[0] ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDoc?.doc_fid]);

  // baseline 或文档变化时启动批量计算
  useEffect(() => {
    if (!currentDoc || !baseline) return;
    const handle = computeBatch(currentDoc, baseline, () => force((x) => x + 1), 6);
    return () => handle.cancel();
  }, [currentDoc, baseline]);

  const data = useMemo(() => {
    if (!currentDoc || !baseline) return null;
    return getOrInit(currentDoc, baseline);
  }, [currentDoc, baseline]);

  if (!currentDoc || !data || data.rows.length === 0) return null;

  // 计算颜色刻度：以当前已算出的最大值为上界
  let maxScore = 1;
  for (const row of data.rows) {
    for (const s of row.scores) if (s !== null && s > maxScore) maxScore = s;
  }

  const onCellClick = (modelId: string, p: number) => {
    setPage(p);
    setModelA(baseline!);
    setModelB(modelId);
  };

  return (
    <div className="bg-slate-900 text-slate-200 px-3 py-2 border-b border-slate-700 text-xs">
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-slate-400">概览（差异热力图）</span>
        <span className="text-slate-400">baseline:</span>
        <select
          className="bg-slate-700 px-2 py-0.5 rounded text-xs"
          value={baseline ?? ''}
          onChange={(e) => setBaseline(e.target.value)}
        >
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="text-slate-500">点击格子跳转到该页 + 切换为 baseline vs 该模型</span>
      </div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[1px]">
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.modelId}>
                <td className="text-right pr-2 text-slate-300 whitespace-nowrap font-mono">
                  {row.modelId}
                </td>
                {row.scores.map((score, p) => {
                  const isCurrent = p === page && (modelA === baseline && modelB === row.modelId
                    || modelB === baseline && modelA === row.modelId);
                  const bg = score === null
                    ? '#334155'
                    : scoreToColor(score, maxScore);
                  return (
                    <td
                      key={p}
                      onClick={() => onCellClick(row.modelId, p)}
                      title={`${row.modelId} · 页 ${p + 1}\n分歧度: ${score === null ? '计算中…' : score.toFixed(1)}`}
                      style={{
                        background: bg,
                        width: 10,
                        height: 14,
                        cursor: 'pointer',
                        outline: isCurrent ? '1.5px solid #f59e0b' : undefined,
                        outlineOffset: isCurrent ? '-1px' : undefined,
                      }}
                    />
                  );
                })}
              </tr>
            ))}
            <tr>
              <td />
              {/* 简易页号刻度：每 10 页一个标 */}
              {data.rows[0]?.scores.map((_, p) => (
                <td key={p} className="text-[9px] text-slate-500 text-center">
                  {(p + 1) % 10 === 0 ? p + 1 : ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function scoreToColor(score: number, max: number): string {
  // 0 = 灰 (一致)，max = 深红
  const t = Math.min(1, score / max);
  // 线性插值：rgb(51,65,85) → rgb(220,38,38)
  const r = Math.round(51 + (220 - 51) * t);
  const g = Math.round(65 + (38 - 65) * t);
  const b = Math.round(85 + (38 - 85) * t);
  return `rgb(${r},${g},${b})`;
}
