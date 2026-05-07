import { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { loadManifest, loadDoc } from './lib/dataLoader';
import { TopBar } from './components/TopBar';
import { HeatmapBar } from './components/HeatmapBar';
import { PdfPane } from './components/PdfPane';
import { DiffPane } from './components/DiffPane';
import { DropZone } from './components/DropZone';

type Mode = 'choosing' | 'ready';

export default function App() {
  const {
    setManifest, setCurrentDoc, setLoading, currentEntry,
    bundle, manifest,
  } = useAppStore();
  const [mode, setMode] = useState<Mode>('choosing');
  const [hasBuiltin, setHasBuiltin] = useState(false);

  // dev 模式下试探一下是否有内置 doc_exports，作为「跳过」按钮的依据
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    fetch('/doc_exports/manifest.json', { method: 'HEAD' })
      .then((r) => setHasBuiltin(r.ok))
      .catch(() => setHasBuiltin(false));
  }, []);

  // bundle 一旦就位 → 自动切到 ready 并加载第一篇
  useEffect(() => {
    if (!bundle) return;
    (async () => {
      setLoading(true);
      try {
        const m = bundle.manifest;
        setManifest(m);
        if (m.length > 0) {
          const doc = await loadDoc(m[0], bundle);
          setCurrentDoc(m[0], doc);
        }
        setMode('ready');
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle]);

  // bundle 被卸载 → 回到选择页
  useEffect(() => {
    if (!bundle && mode === 'ready' && manifest.length === 0) {
      setMode('choosing');
    }
  }, [bundle, mode, manifest.length]);

  const useBuiltin = async () => {
    setLoading(true);
    try {
      const m = await loadManifest(null);
      setManifest(m);
      if (m.length > 0 && !currentEntry) {
        const doc = await loadDoc(m[0], null);
        setCurrentDoc(m[0], doc);
      }
      setMode('ready');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'choosing') {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-slate-800 text-slate-100 px-4 py-2 text-sm font-semibold">
          OCR 模型对比可视化
        </div>
        <DropZone allowFallback={hasBuiltin} onFallback={useBuiltin} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <HeatmapBar />
      <div className="flex-1 grid grid-cols-[minmax(420px,1fr)_2fr] overflow-hidden">
        <PdfPane />
        <DiffPane />
      </div>
    </div>
  );
}
