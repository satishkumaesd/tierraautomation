// Production build: type-checked by `tsc --noEmit` first (see package.json),
// then bundled, minified and fingerprinted with esbuild into ./dist.
import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile, stat } from 'node:fs/promises';

const OUT = 'dist';
await rm(OUT, { recursive: true, force: true });
await mkdir(`${OUT}/assets`, { recursive: true });

const result = await build({
  entryPoints: ['src/main.ts', 'src/styles.css'],
  bundle: true,
  minify: true,
  sourcemap: false,
  target: ['es2020'],
  outdir: `${OUT}/assets`,
  entryNames: '[name]-[hash]',
  legalComments: 'none',
  external: ['/brand/*'],
  metafile: true,
  logLevel: 'warning',
});

const outputs = Object.keys(result.metafile.outputs).map((f) => f.replace(/^dist\//, ''));
const js = outputs.find((f) => f.endsWith('.js'));
const css = outputs.find((f) => f.endsWith('.css'));
if (!js || !css) throw new Error('Build did not produce both JS and CSS bundles');

await cp('public', OUT, { recursive: true });

let html = await readFile('index.html', 'utf8');

if (!html.includes('<!--BUILD:CSS-->') || !html.includes('<!--BUILD:JS-->')) {
  throw new Error('index.html is missing build placeholders');
}
html = html
  .replace('<!--BUILD:CSS-->', `<link rel="stylesheet" href="/${css}">`)
  .replace('<!--BUILD:JS-->', `<script type="module" src="/${js}"></script>`);
await writeFile(`${OUT}/index.html`, html);

for (const f of ['index.html', js, css]) {
  const { size } = await stat(`${OUT}/${f}`);
  console.log(`  dist/${f}  ${(size / 1024).toFixed(1)} kB`);
}
console.log('Build complete.');
