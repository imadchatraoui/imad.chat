import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Element, ElementContent } from "hast";

const STARTS_ARABIC = /^[\s"'«»(\[]*[؀-ۿ]/;

function firstText(node?: Element): string {
  if (!node) return "";
  for (const child of node.children as ElementContent[]) {
    if (child.type === "text" && child.value.trim()) return child.value;
    if (child.type === "element") {
      const inner = firstText(child);
      if (inner) return inner;
    }
  }
  return "";
}

const components: Components = {
  p({ node, children }) {
    const arabic = STARTS_ARABIC.test(firstText(node));
    return (
      <p dir="auto" lang={arabic ? "ar" : undefined}>
        {children}
      </p>
    );
  },
  blockquote({ children }) {
    return <blockquote dir="auto">{children}</blockquote>;
  },
  a({ href, children }) {
    const internal = !!href && (href.startsWith("/") || href.startsWith("#"));
    return (
      <a href={href} target={internal ? undefined : "_blank"} rel={internal ? undefined : "noopener noreferrer"}>
        {children}
      </a>
    );
  },
};

/** Rende Markdown con la voce del diario. Funziona sia sul server sia nel browser. */
export default function Prose({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`prose ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
