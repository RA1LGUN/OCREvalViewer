import { useMemo } from 'react';
import { useAppStore } from '../store';
import { semanticDiff } from '../lib/semanticDiff';
import { ModelColumn } from './ModelColumn';

export function DiffPane() {
  const { currentDoc, page, modelA, modelB } = useAppStore();

  const data = useMemo(() => {
    if (!currentDoc || !modelA || !modelB) return null;
    const ra = currentDoc.ocr_results.find((r) => r.model_id === modelA);
    const rb = currentDoc.ocr_results.find((r) => r.model_id === modelB);
    const a = ra?.pages.find((p) => p.page_num === page)?.result ?? '';
    const b = rb?.pages.find((p) => p.page_num === page)?.result ?? '';

    if (modelA === modelB) {
      return { aMd: a, bMd: b, aPlugin: undefined, bPlugin: undefined, stats: null };
    }
    const { aPlugin, bPlugin, stats } = semanticDiff(a, b);
    return { aMd: a, bMd: b, aPlugin, bPlugin, stats };
  }, [currentDoc, page, modelA, modelB]);

  if (!data) return <div className="p-4 text-slate-500">选择文档与模型以开始对比</div>;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {data.stats && (
        <div className="flex items-center gap-4 px-3 py-1 text-xs text-slate-600 bg-white border-b border-slate-200">
          <span>本页统计：</span>
          <Stat label="完全一致" value={data.stats.equal} cls="bg-slate-200 text-slate-700" />
          <Stat label="文本不同" value={data.stats.textDiff} cls="bg-blue-100 text-blue-700" />
          <Stat label="格式不同" value={data.stats.typeDiff} cls="bg-amber-100 text-amber-700" />
          <Stat label="仅 A 有" value={data.stats.onlyA} cls="bg-rose-100 text-rose-700" />
          <Stat label="仅 B 有" value={data.stats.onlyB} cls="bg-emerald-100 text-emerald-700" />
        </div>
      )}
      <div className="flex-1 grid grid-cols-2 gap-2 p-2 overflow-hidden">
        <ModelColumn title={modelA!} markdown={data.aMd} extraPlugin={data.aPlugin} />
        <ModelColumn title={modelB!} markdown={data.bMd} extraPlugin={data.bPlugin} />
      </div>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <span className={`px-2 py-0.5 rounded ${cls}`}>
      {label} <b>{value}</b>
    </span>
  );
}
