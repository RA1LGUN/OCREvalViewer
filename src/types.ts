export interface ManifestEntry {
  doc_name: string;
  doc_fid: string;
  json_file: string;
  markdown_dir: string;
  markdown_files: string[];
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
