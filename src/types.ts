export interface ManifestEntry {
  doc_name: string;
  doc_fid: string;
  json_file: string;
  markdown_dir: string;
  markdown_files: string[];
  /**
   * Optional: relative path of the PDF on R2 (relative to R2_BASE), e.g. "pdfs/chinese/9787115353009.pdf".
   * When not provided, the frontend probes pdfs/<lang>/<doc_name> and pdfs/<doc_name> in PDF_LANG_DIRS order.
   */
  pdf_path?: string;
}

export interface PageResult {
  page_num: number;
  result: string;
}

export interface ModelResult {
  model_id: string;
  pages: PageResult[];
}

export interface DocJson {
  doc_name: string;
  doc_fid: string;
  ocr_results: ModelResult[];
}
