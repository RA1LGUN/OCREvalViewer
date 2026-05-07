// 远端数据基址。所有 doc_exports/* 与 pdfs/* 都从这里加载。
// 如需切换 CDN / 自建源，仅改这一处。
export const R2_BASE =
  'https://pub-04a8d2818e344259b2ab8339c6c09037.r2.dev/ocr-viewer';

// 探测 PDF 时尝试的语言子目录顺序（manifest 不含 pdf_path 字段时使用）
export const PDF_LANG_DIRS = ['chinese', 'english'] as const;
