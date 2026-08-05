import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const docsRoot = new URL('../../docs/', import.meta.url);

const docs = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: docsRoot,
    generateId: ({ entry }) => entry.replace(/\.md$/i, '').replace(/\\/g, '/')
  })
});

export const collections = { docs };
