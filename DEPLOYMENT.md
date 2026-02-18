# Railway Deployment

## Quick Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/nJ-5yD?referralCode=r6T2Zn)

## Manual Deployment

1. Connect GitHub repository to Railway
2. Railway auto-detects `railpack.json`
3. Build: `yarn install` → `yarn build`
4. Deploy: Caddy serves from `/app/dist`
5. Health check: `/health` returns 200

## Configuration

### railpack.json

```json
{
  "$schema": "https://schema.railpack.com",
  "steps": {
    "install": {
      "inputs": ["."],
      "commands": ["yarn install --frozen-lockfile"],
      "caches": ["node_modules"]
    },
    "build": {
      "inputs": [{ "step": "install" }],
      "commands": ["yarn build"]
    }
  },
  "deploy": {
    "base": {
      "image": "cgr.dev/chainguard/caddy:latest"
    },
    "startCommand": "caddy run --config Caddyfile --adapter caddyfile",
    "inputs": [
      { "step": "build", "include": ["dist"] },
      { "local": true, "include": ["Caddyfile"] }
    ]
  }
}
```

### Caddyfile

```caddyfile
:{$PORT:3000} {
  root * /app/dist
  file_server
  encode gzip
  try_files {path} /index.html
  respond /health 200
}
```

## Environment Variables

- `NODE_ENV=production`
- `PORT` (auto-set by Railway)

## Caching

- Assets/Fonts/WASM/Workers: 1 year
- HTML: No cache
