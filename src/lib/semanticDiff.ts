// 语义块级 diff：
// 1) 把两份 markdown 解析为 mdast；
// 2) 按块对齐（LCS on block signatures + 文本相似度），分四类：
//    equal / text-diff / type-diff / only-A / only-B；
// 3) text-diff 块内做词级 diff；
// 4) 把分类信息编码到 mdast 节点的 data.hProperties 上，
//    交给 react-markdown 在渲染时上色。

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
  /** 越大表示分歧越大，用于热力图 */
  divergenceScore: number;
}

export interface DiffResult {
  /** A 视角：保留 A 的块，标 only-a / type-diff / text-diff / equal；
   *  并在 only-b 块的位置插入「占位」块以提示 B 多了什么（轻量方式：仅累计在 stats，不插入，避免破坏 A 的可读性） */
  aRoot: Root;
  bRoot: Root;
  stats: DiffStats;
}

/** 块签名：类型 + 关键属性。用于 LCS 时初筛。 */
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

/** 用 1-shingle (字符 bigram for CJK + 词 unigram) 算 Jaccard，便于跨语言鲁棒。
 *  这里简化为字符 bigram + 数字/英文词。 */
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
  // 词级补充（英文/数字）
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

/** 两块是否「可以认为是同一段经过 OCR 微扰后的对应块」 */
function isMatch(a: BlockMeta, b: BlockMeta): boolean {
  if (a.sig === b.sig) {
    // 同类型时：内容空块（如分隔线）直接 match；其它要求相似度 > 0.4
    if (a.node.type === 'thematicBreak') return true;
    if (a.text.length === 0 && b.text.length === 0) return true;
    return similarity(a.text, b.text) >= 0.4;
  }
  // 跨类型也允许「类型不同但文本几乎相同」→ type-diff，是有意义的格式差异
  if (a.text && b.text) {
    return similarity(a.text, b.text) >= 0.7;
  }
  return false;
}

/** LCS on metas with custom equality. 返回匹配对 [(i,j), ...]，按 i 升序。 */
function lcsMatch(A: BlockMeta[], B: BlockMeta[]): Array<[number, number]> {
  const n = A.length;
  const m = B.length;
  // 为了控制内存，先构建表（OCR 一页通常 <200 块，可承受）
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

/** 给单个 mdast 节点附 class（通过 data.hProperties.className，rehype 会读取） */
function setClass(node: RootContent, cls: string) {
  // mdast 节点也可以挂 data，react-markdown 通过 rehype 转换会保留
  // 但实际上 react-markdown v9 是 mdast → hast 走 mdast-util-to-hast，
  // 该工具会读取 node.data.hProperties，把它注入到 hast 节点 properties 里。
  const n = node as RootContent & { data?: { hProperties?: Record<string, unknown> } };
  n.data = n.data ?? {};
  n.data.hProperties = n.data.hProperties ?? {};
  const existing = (n.data.hProperties.className as string | undefined) ?? '';
  n.data.hProperties.className = (existing ? existing + ' ' : '') + cls;
}

/** 把一段「text-diff」块内部的纯文本节点替换为词级 diff 标记。
 *  做法：找节点里所有 text 类节点，把整块文本拼起来与对方块文本做词级 diff，
 *  然后把整块的 children 替换为一个 paragraph-like 内联序列（保留原节点类型）。
 *  这是有损的（会丢失 emphasis/code 的内联格式），但对 OCR 对比已足够。 */
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
  // 在 A 视角：保留 unchanged + removed（A 独有的词，红色）
  // 在 B 视角：保留 unchanged + added（B 独有的词，绿色）
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
  // 转换为 mdast 内联节点：text + html span
  const newChildren: any[] = [];
  for (const seg of inline) {
    if (seg.type === 'text' || !seg.cls) {
      newChildren.push({ type: 'text', value: seg.value });
    } else {
      // 用 html 节点包成 span（rehype-raw 会还原它）
      const escaped = seg.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      newChildren.push({ type: 'html', value: `<span class="${seg.cls}">${escaped}</span>` });
    }
  }
  // 对于 list / table 这类多层结构，直接覆盖 children 会破坏结构；
  // 仅在「单层文本容器」（heading / paragraph）里做替换，其它块只整体上色。
  if (selfNode.type === 'heading' || selfNode.type === 'paragraph') {
    (selfNode as Parent).children = newChildren;
  }
  // 其它结构（list / table / blockquote）保持原 children，仅靠外层 class 上整体淡蓝底
}

export interface ComputeOptions {
  /** 用 A 文本做 word diff 的对端文本（外部传入，避免重复 toString） */
}

/** 内部：解析 + 对齐 + 标注，返回 stats 与「用于渲染的 plugin」 */
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

  // 先处理 A 视角
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
      // 不上色
    } else if (!sameSig) {
      setClass(a.node, 'blk-type-diff');
      typeDiff++;
      // 跨类型时也做词级 diff（但 children 替换只在 paragraph/heading 内有效）
      annotateTextDiff(a.node, a.text, b.text, 'a');
    } else {
      setClass(a.node, 'blk-text-diff');
      textDiff++;
      annotateTextDiff(a.node, a.text, b.text, 'a');
    }
  }
  // 处理 B 视角
  for (let j = 0; j < bMeta.length; j++) {
    const b = bMeta[j];
    if (!matchedB.has(j)) {
      setClass(b.node, 'blk-only-b');
      onlyB++;
      continue;
    }
    // 找 A 中对应的
    let i = -1;
    for (const [k, v] of pairMap.entries()) if (v === j) { i = k; break; }
    if (i === -1) continue;
    const a = aMeta[i];
    const sameSig = a.sig === b.sig;
    const sameText = normalizeText(a.text) === normalizeText(b.text);
    if (sameSig && sameText) {
      // equal，不上色
    } else if (!sameSig) {
      setClass(b.node, 'blk-type-diff');
      annotateTextDiff(b.node, b.text, a.text, 'b');
    } else {
      setClass(b.node, 'blk-text-diff');
      annotateTextDiff(b.node, b.text, a.text, 'b');
    }
  }

  // divergence: 越大表示分歧越大（用于热力图）
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

/** 计算两份 markdown 的语义 diff，返回：
 *   - aPlugin / bPlugin：可塞进 react-markdown 的 remarkPlugins 数组，
 *     在解析阶段用「已标注好的 mdast」覆盖 react-markdown 自己解析的 AST，
 *     从而把 data.hProperties.className 一直传递到 hast → DOM。
 *   - stats：用于热力图与图例统计。 */
export function semanticDiff(aMd: string, bMd: string): {
  aPlugin: () => (tree: Root) => void;
  bPlugin: () => (tree: Root) => void;
  stats: DiffStats;
} {
  const result = annotate(aMd, bMd);
  // 构造 plugin：把 tree.children 替换为我们标注后的 children
  const aPlugin = () => (tree: Root) => {
    tree.children = result.aRoot.children;
  };
  const bPlugin = () => (tree: Root) => {
    tree.children = result.bRoot.children;
  };
  return { aPlugin, bPlugin, stats: result.stats };
}
