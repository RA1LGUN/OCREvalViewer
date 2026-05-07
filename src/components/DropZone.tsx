import { useCallback, useState } from 'react';
import { useAppStore } from '../store';
import { loadBundleFromBlob } from '../lib/bundleLoader';
import { resetCache } from '../lib/dataLoader';

interface Props {
  /** 是否允许显示「跳过，使用内置数据」按钮 */
  allowFallback?: boolean;
  onFallback?: () => void;
}

export function DropZone({ allowFallback, onFallback }: Props) {
  const setBundle = useAppStore((s) => s.setBundle);
  const setManifest = useAppStore((s) => s.setManifest);
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('请拖入 .zip 压缩包');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      resetCache();
      const bundle = await loadBundleFromBlob(file);
      setBundle(bundle);
      setManifest(bundle.manifest);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [setBundle, setManifest]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setHover(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
      className={`flex-1 flex items-center justify-center transition-colors ${
        hover ? 'bg-emerald-50' : 'bg-slate-50'
      }`}
    >
      <div className="max-w-xl w-full mx-auto px-8">
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center ${
            hover ? 'border-emerald-500 bg-emerald-100/40' : 'border-slate-300 bg-white'
          }`}
        >
          <div className="text-slate-700 text-lg font-semibold mb-2">
            拖拽数据包 zip 到这里
          </div>
          <div className="text-slate-500 text-sm mb-5">
            或者
            <label className="text-emerald-600 hover:text-emerald-700 cursor-pointer mx-1 underline">
              点击选择文件
              <input
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </div>

          <div className="text-xs text-slate-500 text-left bg-slate-50 border border-slate-200 rounded p-3">
            <div className="font-mono mb-1 text-slate-600">zip 内部结构：</div>
            <pre className="font-mono text-[11px] leading-relaxed">{`bundle.zip
├── manifest.json
├── json/
│   └── <fid>__<name>.json
└── pdfs/
    └── <doc_name>.pdf`}</pre>
            <div className="mt-2">
              所有解析都在你浏览器里完成，文件不会上传到任何服务器。
            </div>
          </div>

          {busy && <div className="text-amber-600 text-sm mt-4">解压中…</div>}
          {error && <div className="text-rose-600 text-sm mt-4">错误：{error}</div>}

          {allowFallback && (
            <div className="mt-5">
              <button
                className="text-xs text-slate-500 hover:text-slate-700 underline"
                onClick={onFallback}
              >
                跳过，使用项目内置示例数据
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
