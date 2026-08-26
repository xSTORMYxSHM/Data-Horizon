import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'renderer'), { recursive: true });

await Promise.all([
  build({
    entryPoints: [path.join(root, 'src/main.ts')],
    outfile: path.join(output, 'main.js'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
    sourcemap: true
  }),
  build({
    entryPoints: [path.join(root, 'src/preload.ts')],
    outfile: path.join(output, 'preload.js'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
    sourcemap: true
  }),
  build({
    entryPoints: [path.join(root, 'src/renderer/app.ts')],
    outfile: path.join(output, 'renderer/app.js'),
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'chrome138',
    sourcemap: true
  })
]);

await Promise.all([
  cp(path.join(root, 'src/renderer/index.html'), path.join(output, 'renderer/index.html')),
  cp(path.join(root, 'src/renderer/runtime.html'), path.join(output, 'renderer/runtime.html')),
  cp(path.join(root, 'src/renderer/styles.css'), path.join(output, 'renderer/styles.css'))
]);

await writeFile(path.join(output, 'renderer/project.js'), 'window.__DATA_HORIZON_PROJECT__ = null;\n', 'utf8');
