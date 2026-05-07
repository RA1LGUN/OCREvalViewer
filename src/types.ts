export interface ManifestEntry {
  doc_name: string;
  doc_fid: string;
  json_file: string;
  markdown_dir: string;
  markdown_files: string[];
  /**
   * 可选：PDF 在 R2 上的相对路径（相对于 R2_BASE），如 "pdfs/chinese/9787115353009.pdf"。
   * 不提供时，前端会按 PDF_LANG_DIRS 顺序探测 pdfs/<lang>/<doc_name> 与 pdfs/<doc_name>。
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
