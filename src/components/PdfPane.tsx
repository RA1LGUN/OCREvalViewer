import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useAppStore } from '../store';
import { resolvePdfUrl } from '../lib/pdfPath';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export function PdfPane() {
  const { currentEntry, page, bundle } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth - 24);
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!currentEntry) { setUrl(null); return; }
    let cancelled = false;
    setResolving(true);
    setError(null);
    resolvePdfUrl(currentEntry, bundle)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setResolving(false); });
    return () => { cancelled = true; };
  }, [currentEntry, bundle]);

  if (!currentEntry) {
    return <div className="p-4 text-slate-500">Select a document</div>;
  }

  if (resolving && !url) {
    return <div className="p-4 text-slate-500 text-sm">Locating PDF...</div>;
  }

  if (!url) {
    return (
      <div className="p-4 text-rose-600 text-sm">
        PDF not found: {currentEntry.doc_name}
        {bundle ? ' (not included in zip)' : ' (not found on remote R2)'}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-slate-100 p-3">
      {error && <div className="text-rose-600 text-sm">PDF load failed: {error}</div>}
      <Document
        file={url}
        onLoadSuccess={(p) => { setNumPages(p.numPages); setError(null); }}
        onLoadError={(e) => setError(e.message)}
        loading={<div className="text-slate-500">Loading PDF...</div>}
      >
        {numPages > 0 && (
          <Page
            pageNumber={Math.min(page + 1, numPages)}
            width={width}
            renderAnnotationLayer={false}
            renderTextLayer={false}
          />
        )}
      </Document>
      <div className="text-center text-xs text-slate-500 mt-2">
        PDF page {page + 1} (of {numPages || '?'} pages)
      </div>
    </div>
  );
}
