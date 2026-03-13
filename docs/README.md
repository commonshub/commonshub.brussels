# Commons Hub Brussels — Docs

Built with [Tome](https://tome.center).

## Development

```bash
cd docs
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Serving with the main site

From the project root:

```bash
npm run docs:dev    # dev server
npm run docs:build  # production build
```

The docs are a standalone site. To serve under `/docs` on the main website, either:

1. **Reverse proxy** — Configure your web server to proxy `/docs` to the Tome build output
2. **Next.js rewrite** — Add a rewrite in `next.config.mjs`:
   ```js
   rewrites: async () => [
     { source: '/docs/:path*', destination: 'http://localhost:3001/:path*' }
   ]
   ```
3. **Static export** — Run `tome build` and copy the output to `public/docs/`
