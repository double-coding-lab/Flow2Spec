import type { APIRoute, GetStaticPaths } from 'astro';
import { readdir, readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const assetsDir = fileURLToPath(new URL('../../../../docs/images/', import.meta.url));
const contentTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

export const getStaticPaths = (async () => {
  const files = await readdir(assetsDir);
  return files
    .filter((file) => contentTypes[extname(file).toLowerCase()])
    .map((file) => ({ params: { path: file }, props: { file } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const file = String(props.file);
  return new Response(await readFile(resolve(assetsDir, file)), {
    headers: { 'Content-Type': contentTypes[extname(file).toLowerCase()] ?? 'application/octet-stream' }
  });
};
