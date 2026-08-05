import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import rehypeDocLinks from './rehype-doc-links.mjs';

export default defineConfig({
  site: 'https://double-coding-lab.github.io',
  base: '/Flow2Spec',
  output: 'static',
  markdown: {
    processor: unified({ rehypePlugins: [[rehypeDocLinks, { base: '/Flow2Spec' }]] }),
    shikiConfig: {
      langAlias: { Plain: 'plaintext' }
    }
  },
  build: {
    format: 'directory'
  }
});
