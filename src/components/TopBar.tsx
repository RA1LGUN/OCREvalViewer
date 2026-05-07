import { useAppStore } from '../store';
import { loadDoc } from '../lib/dataLoader';

export function TopBar() {
  const {
    manifest, currentEntry, currentDoc, page,
    modelA, modelB, loading, bundle,
    setCurrentDoc, setPage, setModelA, setModelB, setLoading, setBundle,
  } = useAppStore();

  const totalPages = currentDoc
    ? Math.max(0, ...currentDoc.ocr_results.map((r) => r.pages.length))
    : 0;
  const models = currentDoc?.ocr_results.map((r) => r.model_id) ?? [];

  const onSelectDoc = async (fid: string) => {
    const entry = manifest.find((e) => e.doc_fid === fid);
    if (!entry) return;
    setLoading(true);
    try {
      const doc = await loadDoc(entry, bundle);
      setCurrentDoc(entry, doc);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 text-slate-100 text-sm">
      <span className="font-semibold">OCR 对比</span>

      <select
        className="bg-slate-700 px-2 py-1 rounded max-w-[280px]"
        value={currentEntry?.doc_fid ?? ''}
        onChange={(e) => onSelectDoc(e.target.value)}
      >
        {manifest.map((e) => (
          <option key={e.doc_fid} value={e.doc_fid}>
            {e.doc_name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1">
        <button
          className="px-2 py-1 bg-slate-700 rounded disabled:opacity-40"
          onClick={() => setPage(page - 1)}
          disabled={page <= 0}
        >◀</button>
        <input
          type="number"
          className="w-16 bg-slate-700 px-2 py-1 rounded text-center"
          min={1}
          max={totalPages}
          value={page + 1}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) setPage(Math.min(Math.max(v - 1, 0), totalPages - 1));
          }}
        />
        <span className="text-slate-400">/ {totalPages}</span>
        <button
          className="px-2 py-1 bg-slate-700 rounded disabled:opacity-40"
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages - 1}
        >▶</button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-slate-400">A</span>
        <select
          className="bg-slate-700 px-2 py-1 rounded"
          value={modelA ?? ''}
          onChange={(e) => setModelA(e.target.value)}
        >
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="text-slate-400">vs B</span>
        <select
          className="bg-slate-700 px-2 py-1 rounded"
          value={modelB ?? ''}
          onChange={(e) => setModelB(e.target.value)}
        >
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="ml-auto flex items-center gap-3 text-xs">
        {bundle && (
          <button
            className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600"
            onClick={() => setBundle(null)}
            title="切回在线 R2 示例数据 / 重新拖入新 zip"
          >
            zip 已加载 · 点此卸载
          </button>
        )}
        <Legend color="rgba(244,63,94,0.3)" label="仅 A 有" />
        <Legend color="rgba(16,185,129,0.3)" label="仅 B 有" />
        <Legend color="rgba(251,191,36,0.3)" label="格式不同" />
        <Legend color="rgba(59,130,246,0.18)" label="文本不同" />
        {loading && <span className="text-amber-400">加载中…</span>}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
