// Semantic block-level diff:
// 1) Parse both markdown strings into mdast;
// 2) Align blocks (LCS on block signatures + text similarity), classifying into four categories:
//    equal / text-diff / type-diff / only-A / only-B;
// 3) For text-diff blocks, perform word-level diff internally;
// 4) Encode classification info into mdast node data.hProperties,
//    so react-markdown can color them during rendering.

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { toString as mdastToString } from 'mdast-util-to-string';
import type { Root, RootContent, Parent } from 'mdast';
import { diffWordsWithSpace, type Change } from 'diff';

const parser = unified().use(remarkParse).use(remarkGfm);

export type BlockTag =
  | 'equal'
  | 'text-diff'
  | 'type-diff'
  | 'only-a'
  | 'only-b';

export interface DiffStats {
  totalA: number;
  totalB: number;
  equal: number;
  textDiff: number;
  typeDiff: number;
  onlyA: number;
  onlyB: number;
  /** Higher values indicate greater divergence; used for the heatmap */
  divergenceScore: number;
}

export interface DiffResult {
  /** A-side perspective: keep A's blocks, marking only-a / type-diff / text-diff / equal;
   *  at only-b positions, insert placeholder blocks to hint what B has extra (lightweight: only accumulated in stats, not inserted, to preserve A's readability) */
  aRoot: Root;
  bRoot: Root;
  stats: DiffStats;
}

/** Block signature: type + key attributes. Used for initial filtering during LCS. */
function blockSignature(node: RootContent): string {
  switch (node.type) {
    case 'heading':
      return `heading-${node.depth}`;
    case 'list':
      return `list-${node.ordered ? 'ord' : 'ul'}`;
    case 'code':
      return `code-${node.lang ?? ''}`;
    default:
      return node.type;
  }
}

function normalizeText(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/[ 　]/g, ' ')
    .trim()
    .toLowerCase();
}

/** Compute Jaccard similarity using 1-shingle (character bigrams for CJK + word unigrams), robust across languages.
 *  Simplified here to character bigrams + numeric/English words. */
function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const sa = shingles(a);
  const sb = shingles(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 1 : inter / union;
}

function shingles(s: string): Set<string> {
  const out = new Set<string>();
  const n = normalizeText(s);
  for (let i = 0; i < n.length - 1; i++) {
    const ch = n.slice(i, i + 2);
    if (ch.trim().length > 0) out.add(ch);
  }
  // Word-level supplement (English / numeric)
  for (const w of n.split(/[^\p{L}\p{N}]+/u)) {
    if (w.length >= 2) out.add(`w:${w}`);
  }
  return out;
}

interface BlockMeta {
  index: number;
  sig: string;
  text: string;
  node: RootContent;
}

function buildMeta(root: Root): BlockMeta[] {
  return root.children.map((node, index) => ({
    index,
    sig: blockSignature(node),
    text: mdastToString(node),
    node,
  }));
}

/** Whether two blocks "can be considered corresponding blocks after OCR perturbation" */
function isMatch(a: BlockMeta, b: BlockMeta): boolean {
  if (a.sig === b.sig) {
    // Same type: empty content blocks (e.g. thematic breaks) match directly; others require similarity > 0.4
    if (a.node.type === 'thematicBreak') return true;
    if (a.text.length === 0 && b.text.length === 0) return true;
    return similarity(a.text, b.text) >= 0.4;
  }
  // Cross-type also allows "different type but nearly identical text" → type-diff, a meaningful formatting difference
  if (a.text && b.text) {
    return similarity(a.text, b.text) >= 0.7;
  }
  return false;
}

/** LCS on metas with custom equality. Returns matching pairs [(i,j), ...] in ascending i order. */
function lcsMatch(A: BlockMeta[], B: BlockMeta[]): Array<[number, number]> {
  const n = A.length;
  const m = B.length;
  // Build the DP table (OCR pages typically have <200 blocks, so memory is acceptable)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (isMatch(A[i - 1], B[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (isMatch(A[i - 1], B[j - 1])) {
      pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return pairs.reverse();
}

/** Attach a class to a single mdast node (via data.hProperties.className, which rehype reads) */
function setClass(node: RootContent, cls: string) {
  // mdast nodes can also carry data; react-markdown v9 converts mdast → hast via mdast-util-to-hast,
  // which reads node.data.hProperties and injects them into the hast node properties.
  const n = node as RootContent & { data?: { hProperties?: Record<string, unknown> } };
  n.data = n.data ?? {};
  n.data.hProperties = n.data.hProperties ?? {};
  const existing = (n.data.hProperties.className as string | undefined) ?? '';
  n.data.hProperties.className = (existing ? existing + ' ' : '') + cls;
}

/** Replace the plain text nodes inside a "text-diff" block with word-level diff markup.
 *  Approach: find all text-type nodes in the block, concatenate their text, do word-level diff
 *  against the counterpart block's text, then replace the block's children with a paragraph-like
 *  inline sequence (preserving the original node type).
 *  This is lossy (it discards inline formatting like emphasis/code), but sufficient for OCR comparison. */
function annotateTextDiff(
  selfNode: RootContent,
  selfText: string,
  otherText: string,
  side: 'a' | 'b',
) {
  if (!('children' in selfNode)) return;
  const changes: Change[] = diffWordsWithSpace(
    side === 'a' ? selfText : otherText,
    side === 'a' ? otherText : selfText,
  );
  // In A's view: keep unchanged + removed (words unique to A, shown in red)
  // In B's view: keep unchanged + added (words unique to B, shown in green)
  const inline: Array<{ type: 'text' | 'span'; value: string; cls?: string }> = [];
  for (const c of changes) {
    if (side === 'a') {
      if (c.added) continue;
      inline.push(c.removed
        ? { type: 'span', value: c.value, cls: 'diff-del' }
        : { type: 'text', value: c.value });
    } else {
      if (c.removed) continue;
      inline.push(c.added
        ? { type: 'span', value: c.value, cls: 'diff-add' }
        : { type: 'text', value: c.value });
    }
  }
  // Convert to mdast inline nodes: text + html span
  const newChildren: any[] = [];
  for (const seg of inline) {
    if (seg.type === 'text' || !seg.cls) {
      newChildren.push({ type: 'text', value: seg.value });
    } else {
      // Wrap in an html span node (rehype-raw will restore it)
      const escaped = seg.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      newChildren.push({ type: 'html', value: `<span class="${seg.cls}">${escaped}</span>` });
    }
  }
  // For multi-level structures like list / table, directly overwriting children would break structure;
  // only replace children in "single-level text containers" (heading / paragraph); other blocks only get overall coloring.
  if (selfNode.type === 'heading' || selfNode.type === 'paragraph') {
    (selfNode as Parent).children = newChildren;
  }
  // Other structures (list / table / blockquote) keep original children, only get a light blue background via outer class
}

export interface ComputeOptions {
  /** The counterpart text for word diff against A's text (passed externally to avoid repeated toString) */
}

/** Internal: parse + align + annotate, returning stats and a "plugin for rendering" */
function annotate(aMd: string, bMd: string) {
  const aRoot = parser.parse(aMd) as Root;
  const bRoot = parser.parse(bMd) as Root;

  const aMeta = buildMeta(aRoot);
  const bMeta = buildMeta(bRoot);
  const pairs = lcsMatch(aMeta, bMeta);

  const matchedA = new Set<number>();
  const matchedB = new Set<number>();
  const pairMap = new Map<number, number>();
  for (const [i, j] of pairs) {
    matchedA.add(i);
    matchedB.add(j);
    pairMap.set(i, j);
  }

  let equal = 0;
  let textDiff = 0;
  let typeDiff = 0;
  let onlyA = 0;
  let onlyB = 0;

  // Process A side first
  for (let i = 0; i < aMeta.length; i++) {
    const a = aMeta[i];
    if (!matchedA.has(i)) {
      setClass(a.node, 'blk-only-a');
      onlyA++;
      continue;
    }
    const j = pairMap.get(i)!;
    const b = bMeta[j];
    const sameSig = a.sig === b.sig;
    const sameText = normalizeText(a.text) === normalizeText(b.text);
    if (sameSig && sameText) {
      equal++;
      // No coloring
    } else if (!sameSig) {
      setClass(a.node, 'blk-type-diff');
      typeDiff++;
      // Cross-type also does word-level diff (but children replacement only works inside paragraph/heading)
      annotateTextDiff(a.node, a.text, b.text, 'a');
    } else {
      setClass(a.node, 'blk-text-diff');
      textDiff++;
      annotateTextDiff(a.node, a.text, b.text, 'a');
    }
  }
  // Process B side
  for (let j = 0; j < bMeta.length; j++) {
    const b = bMeta[j];
    if (!matchedB.has(j)) {
      setClass(b.node, 'blk-only-b');
      onlyB++;
      continue;
    }
    // Find the corresponding block in A
    let i = -1;
    for (const [k, v] of pairMap.entries()) if (v === j) { i = k; break; }
    if (i === -1) continue;
    const a = aMeta[i];
    const sameSig = a.sig === b.sig;
    const sameText = normalizeText(a.text) === normalizeText(b.text);
    if (sameSig && sameText) {
      // equal, no coloring
    } else if (!sameSig) {
      setClass(b.node, 'blk-type-diff');
      annotateTextDiff(b.node, b.text, a.text, 'b');
    } else {
      setClass(b.node, 'blk-text-diff');
      annotateTextDiff(b.node, b.text, a.text, 'b');
    }
  }

  // divergence: higher values indicate greater divergence (used for heatmap)
  const divergenceScore = onlyA + onlyB + typeDiff * 0.7 + textDiff * 0.3;

  return {
    aRoot,
    bRoot,
    stats: {
      totalA: aMeta.length,
      totalB: bMeta.length,
      equal,
      textDiff,
      typeDiff,
      onlyA,
      onlyB,
      divergenceScore,
    },
  };
}

/** Compute the semantic diff of two markdown strings, returning:
 *   - aPlugin / bPlugin: can be plugged into react-markdown's remarkPlugins array,
 *     overriding react-markdown's own AST with the pre-annotated mdast during parsing,
 *     so that data.hProperties.className propagates all the way to hast → DOM.
 *   - stats: used for heatmap and legend statistics. */
export function semanticDiff(aMd: string, bMd: string): {
  aPlugin: () => (tree: Root) => void;
  bPlugin: () => (tree: Root) => void;
  stats: DiffStats;
} {
  const result = annotate(aMd, bMd);
  // Build plugin: replace tree.children with our annotated children
  const aPlugin = () => (tree: Root) => {
    tree.children = result.aRoot.children;
  };
  const bPlugin = () => (tree: Root) => {
    tree.children = result.bRoot.children;
  };
  return { aPlugin, bPlugin, stats: result.stats };
}
