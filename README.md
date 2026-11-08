# Zapple Pay frontend (self-hosted fork)

Static single-page build of the Zapple Pay frontend, published to nsite and
talking to a self-hosted [zapple-pay-backend](https://github.com/higedamc/zapple-pay-backend).

Differences from upstream:

- Every state-changing call (`/set-user`, `/create-subscription`, `/wallet-auth`)
  is a POST carrying a NIP-98 `Authorization` header signed by a NIP-07
  browser extension. The backend only stores config for the key that signed,
  so the npub in the form must be the extension's key.
- `/wallet-auth` sends its budget as a JSON body (no query string), or no body
  at all when there is no budget.
- No server rendering, no Vercel adapter: `dist/public` is the whole site.
  `404.html` is a copy of `index.html` so nsite gateways still serve the app
  for deep links such as `/autozap/<npub>`.

## Build

```
cp .env.example .env            # set VITE_ZAPPLE_API_URL to the backend host
pnpm install
pnpm run build                  # -> dist/public (index.html, 404.html, assets/)
```

`VITE_ZAPPLE_API_URL` is baked into the bundle. It must equal the backend's
`--public-url` without the `https://` prefix, byte for byte: NIP-98 compares
the signed URL against that value and fails closed on any mismatch.

## Publish to nsite

```
nak nsite upload --root -y -s <blossom server> --title "Zapple Pay" dist/public <relay...>
```

with `NOSTR_SECRET_KEY` set to the site's publishing key.

## Develop

```
pnpm install
pnpm run dev
```
