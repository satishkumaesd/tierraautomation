# tierra-automation-platform
Official TIERRA AUTOMATION 3D Website & Business Platform

Live: https://tierraautomation.in

## Stack
- Hand-written WebGL renderer (no runtime dependencies) for the ribbon-sphere logo:
  `src/gl/sphere.ts` builds the mark as a helical band and morphs it into a coil and an engineering wireframe on scroll.
- TypeScript + esbuild build (`build.mjs`), static output in `dist/`.
- Served in production by Caddy (see `Dockerfile`, `Caddyfile`), deployed on Railway.

## Commands
```bash
npm install
npm run build     # type-check + bundle into dist/
npm run preview   # serve dist/ on http://localhost:4173
```

## Content
Copy lives in `index.html`; the lab robot illustration is `src/robot.svg`; brand assets are in `public/brand/`.
