import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { PluggableList } from 'unified';

interface Props {
  title: string;
  markdown: string;
  /** 由 semanticDiff 返回的 plugin，用「已标注的 mdast」覆盖默认解析结果。
   *  必须放在 remarkParse 之后，因此通过 remarkPlugins 传入即可。 */
  extraPlugin?: () => (tree: any) => void;
}

export function ModelColumn({ title, markdown, extraPlugin }: Props) {
  const remarkPlugins: PluggableList = extraPlugin
    ? [remarkGfm, extraPlugin]
    : [remarkGfm];

  return (
    <div className="h-full overflow-auto border border-slate-200 bg-white">
      <div className="sticky top-0 bg-slate-100 border-b border-slate-200 px-3 py-1.5 text-xs font-mono text-slate-700 z-10">
        {title}
      </div>
      <div className="markdown-body p-4">
        <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={[rehypeRaw]}>
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
