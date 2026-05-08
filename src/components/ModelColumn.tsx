import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { PluggableList } from 'unified';

interface Props {
  title: string;
  markdown: string;
  /** Plugin returned by semanticDiff that overrides the default parse result with an annotated mdast.
   *  Must be placed after remarkParse, so passing it via remarkPlugins is sufficient. */
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
