import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useAppStore } from '../store';
import { pdfUrlForDocName } from '../lib/pdfPath';

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

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth - 24);
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (!currentEntry) {
    return <div className="p-4 text-slate-500">请选择文档</div>;
  }

  const url = pdfUrlForDocName(currentEntry.doc_name, bundle);

  if (!url) {
    return <div className="p-4 text-rose-600 text-sm">zip 中找不到 PDF：{currentEntry.doc_name}</div>;
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-slate-100 p-3">
      {error && <div className="text-rose-600 text-sm">PDF 加载失败：{error}</div>}
      <Document
        file={url}
        onLoadSuccess={(p) => { setNumPages(p.numPages); setError(null); }}
        onLoadError={(e) => setError(e.message)}
        loading={<div className="text-slate-500">PDF 加载中…</div>}
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
        PDF 第 {page + 1} 页（共 {numPages || '?'} 页）
      </div>
    </div>
  );
}
