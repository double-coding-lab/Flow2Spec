import { findDocByMarkdownPath } from './src/data/docs.mjs';

const splitTarget = (value) => {
  const hashIndex = value.indexOf('#');
  return hashIndex === -1 ? [value, ''] : [value.slice(0, hashIndex), value.slice(hashIndex)];
};

const rewriteHref = (value, base) => {
  if (!value || /^(?:https?:|mailto:|#)/i.test(value)) return value;
  const [pathname, hash] = splitTarget(value);
  if (/README\.zh-CN\.md$/i.test(pathname)) return `${base}/`;
  if (/(?:^|\/)README\.md$/i.test(pathname)) return `${base}/en/`;
  if (!/\.md$/i.test(pathname)) return value;
  const match = findDocByMarkdownPath(pathname);
  return match ? `${base}/${match.english ? 'en/' : ''}docs/${match.doc.id}/${hash}` : value;
};

const rewriteImage = (value, base) => {
  if (!value || /^(?:https?:|data:|\/)/i.test(value)) return value;
  if (!value.includes('images/')) return value;
  return `${base}/docs-assets/${value.split('/').pop()}`;
};

const textContent = (node) => node.type === 'text'
  ? node.value
  : (node.children ?? []).map(textContent).join('');

const mermaidCodeNode = (node) => {
  if (node.type !== 'element' || node.tagName !== 'pre') return null;
  const code = node.children?.find((child) => child.type === 'element' && child.tagName === 'code');
  if (!code) return null;
  const language = node.properties?.['data-language'] ?? node.properties?.dataLanguage;
  const classes = code.properties?.className ?? [];
  const classList = Array.isArray(classes) ? classes : [classes];
  const isMermaid = String(language).toLowerCase() === 'mermaid'
    || classList.some((name) => String(name).toLowerCase() === 'language-mermaid');
  return isMermaid ? code : null;
};

const isLanguageSwitcher = (node) => {
  if (node.type !== 'element' || node.tagName !== 'p') return false;
  const text = textContent(node).trim();
  if (!/(?:中文|English)/.test(text)) return false;
  return text
    .replace(/中文|English|项目首页|Project home/g, '')
    .replace(/[|·\s]/g, '') === '';
};

export default function rehypeDocLinks({ base = '' } = {}) {
  return (tree) => {
    const visit = (node) => {
      const mermaidCode = mermaidCodeNode(node);
      if (mermaidCode) {
        node.tagName = 'div';
        node.properties = { className: ['mermaid'] };
        node.children = [{ type: 'text', value: textContent(mermaidCode).trim() }];
        return;
      }
      if (node.children) node.children = node.children.filter((child) => !isLanguageSwitcher(child));
      if (node.type === 'element' && node.properties) {
        if (node.tagName === 'a') node.properties.href = rewriteHref(node.properties.href, base);
        if (node.tagName === 'img') node.properties.src = rewriteImage(node.properties.src, base);
      }
      if (node.type === 'raw' && typeof node.value === 'string') {
        node.value = node.value
          .replace(/href=(['"])(.*?)\1/g, (_match, quote, href) => `href=${quote}${rewriteHref(href, base)}${quote}`)
          .replace(/src=(['"])(.*?)\1/g, (_match, quote, src) => `src=${quote}${rewriteImage(src, base)}${quote}`);
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
