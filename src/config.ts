// Remote data base URL. All doc_exports/* and pdfs/* are loaded from here.
// To switch CDN / self-hosted source, only change this line.
export const R2_BASE =
  'https://pub-04a8d2818e344259b2ab8339c6c09037.r2.dev/ocr-viewer';

// Language subdirectory order for PDF probing (used when manifest lacks pdf_path field)
export const PDF_LANG_DIRS = ['chinese', 'english'] as const;
