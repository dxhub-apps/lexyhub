declare module "react-markdown" {
  import type { ComponentType, ReactNode } from "react";

  export interface ReactMarkdownProps {
    children?: ReactNode;
    remarkPlugins?: unknown[];
    components?: Record<string, ComponentType<any>>;
    className?: string;
  }

  const ReactMarkdown: ComponentType<ReactMarkdownProps>;
  export default ReactMarkdown;
}

declare module "remark-gfm" {
  const remarkGfm: any;
  export default remarkGfm;
}
