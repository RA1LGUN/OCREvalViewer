import { useCallback, useState } from 'react';
import { useAppStore } from '../store';
import { loadBundleFromBlob } from '../lib/bundleLoader';
import { resetCache } from '../lib/dataLoader';

interface Props {
  /** Whether to show the "Skip, use built-in data" button */
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
      setError('Please drop a .zip file');
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
            Drag and drop your data zip here
          </div>
          <div className="text-slate-500 text-sm mb-5">
            or
            <label className="text-emerald-600 hover:text-emerald-700 cursor-pointer mx-1 underline">
              click to select file
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
            <div className="font-mono mb-1 text-slate-600">Expected zip structure:</div>
            <pre className="font-mono text-[11px] leading-relaxed">{`bundle.zip
├── manifest.json
├── json/
│   └── <fid>__<name>.json
└── pdfs/
    └── <doc_name>.pdf`}</pre>
            <div className="mt-2">
              All processing happens in your browser. Files are never uploaded to any server.
            </div>
          </div>

          {busy && <div className="text-amber-600 text-sm mt-4">Extracting...</div>}
          {error && <div className="text-rose-600 text-sm mt-4">Error: {error}</div>}

          {allowFallback && (
            <div className="mt-5">
              {/* <button
                className="text-xs text-slate-500 hover:text-slate-700 underline"
                onClick={onFallback}
              >
                 Skip, load online sample data (from R2)
              </button> */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
