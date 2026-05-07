import type { Bundle } from './bundleLoader';
import { getPdfUrl } from './bundleLoader';

export function pdfUrlForDocName(docName: string, bundle: Bundle | null): string | null {
  if (bundle) {
    return getPdfUrl(bundle, docName);
  }
  return `/pdfs/${docName}`;
}
