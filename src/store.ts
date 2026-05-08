import { create } from 'zustand';
import type { DocJson, ManifestEntry } from './types';
import type { Bundle } from './lib/bundleLoader';
import { disposeBundle } from './lib/bundleLoader';

interface AppState {
  manifest: ManifestEntry[];
  currentEntry: ManifestEntry | null;
  currentDoc: DocJson | null;
  page: number; // 0-indexed
  modelA: string | null;
  modelB: string | null;
  loading: boolean;
  bundle: Bundle | null;

  setManifest: (m: ManifestEntry[]) => void;
  setCurrentDoc: (entry: ManifestEntry, doc: DocJson) => void;
  setPage: (p: number) => void;
  setModelA: (m: string) => void;
  setModelB: (m: string) => void;
  setLoading: (b: boolean) => void;
  setBundle: (b: Bundle | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  manifest: [],
  currentEntry: null,
  currentDoc: null,
  page: 0,
  modelA: null,
  modelB: null,
  loading: false,
  bundle: null,

  setManifest: (m) => set({ manifest: m }),
  setCurrentDoc: (entry, doc) => {
    const models = doc.ocr_results.map((r) => r.model_id);
    set({
      currentEntry: entry,
      currentDoc: doc,
      page: 0,
      modelA: models[0] ?? null,
      modelB: models[1] ?? models[0] ?? null,
    });
  },
  setPage: (p) => set({ page: Math.max(0, p) }),
  setModelA: (m) => set({ modelA: m }),
  setModelB: (m) => set({ modelB: m }),
  setLoading: (b) => set({ loading: b }),
  setBundle: (b) => {
    // Release old bundle
    const prev = get().bundle;
    if (prev && prev !== b) disposeBundle(prev);
    set({ bundle: b, currentEntry: null, currentDoc: null, manifest: [] });
  },
}));
