# PathBoard

A portrait-kiosk departure board for the [Port Authority Trans-Hudson (PATH)](https://www.panynj.gov/path) rail system. Pick any station on the line, see live arrival countdowns for both directions, and star a home station for quick return.

Live arrivals are fetched from the Port Authority's public RidePATH feed every 30 seconds via a CloudFront same-origin proxy (no CORS). If the feed is unreachable the board falls back to embedded sample data and flags it.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Infra | AWS CDK v2 (TypeScript) |
| Hosting | S3 + CloudFront |

## Local development

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/bin/portauthority/ridepath.json` to `www.panynj.gov` — configure this in `web/vite.config.ts` if you need to change the upstream.

## Deploy

```bash
cd web && npm run build   # outputs web/dist/

cd ../infra
npm install
npm run bootstrap         # once per AWS account/region
npm run deploy
```

`cdk deploy` uploads `web/dist/` to S3 and invalidates the CloudFront cache. The stack outputs the distribution URL on completion.

## Architecture

CloudFront serves the static site from a private S3 bucket (via Origin Access Control) and adds a second behavior at `/bin/portauthority/ridepath.json` that proxies the live PATH feed from `www.panynj.gov`. This keeps the feed same-origin in the browser, avoids CORS, and caches responses for ~20 seconds to spare Port Authority's servers.
