# aphex-landing

Landing page for Aphex: a single `index.html` plus a Three.js particle scene in `src/particles.ts`.

Add `?show` or `#show` to the URL for kiosk mode (logo and Instagram QR) at live shows.

## Build

```sh
npm ci
npm run build   # type-checks and bundles src/particles.ts into dist/particles.js
```

## Hosting

The site is hosted on GitHub Pages. `.github/workflows/deploy.yml` builds and deploys on every push to `main`.

A GitHub Pages site serves exactly one custom domain. The primary domain is set in the repo's **Settings → Pages → Custom domain** (the `CNAME` file in the repo root mirrors it; with Actions-based deploys GitHub reads the setting, not the file).

| Domain | Role |
| --- | --- |
| `aphex.cx` | Primary custom domain on GitHub Pages |
| `www.aphex.cx` | GitHub Pages redirects it to the primary automatically |
| `aphex.dj`, `www.aphex.dj` | 301 redirect to `https://aphex.cx`, set up at the DNS provider |

### DNS for the primary domain

Claim the domain on GitHub before publishing any DNS records, so no other Pages site can grab it in between:

1. Verify the domain under your GitHub account's **Settings → Pages** (add the TXT record GitHub shows you and click Verify).
2. Enter the domain in the repo's **Settings → Pages → Custom domain** and save.

Then, at the DNS provider (apex records point at GitHub Pages):

| Name | Type | Value |
| --- | --- | --- |
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |
| `@` | AAAA | `2606:50c0:8000::153` |
| `@` | AAAA | `2606:50c0:8001::153` |
| `@` | AAAA | `2606:50c0:8002::153` |
| `@` | AAAA | `2606:50c0:8003::153` |
| `www` | CNAME | `aphexcx.github.io` |

Remove any other A, AAAA or CNAME records on those names. Back in the repo's **Settings → Pages**, wait for the DNS check to pass, then tick **Enforce HTTPS**.

### Redirecting aphex.dj

Because Pages can't serve a second domain, `aphex.dj` forwards to `aphex.cx`. Paths and query strings are preserved, so `aphex.dj/?show` opens show mode.

**If aphex.dj's DNS is on Cloudflare** (recommended, since it handles HTTPS for the redirect):

1. Add records `@` A `192.0.2.1` and `www` A `192.0.2.1`, both **Proxied** (orange cloud). The address is a placeholder; Cloudflare answers before it is used.
2. Rules → Redirect Rules → create a rule: when hostname is `aphex.dj` or `www.aphex.dj`, dynamic redirect to `concat("https://aphex.cx", http.request.uri.path)`, status 301, preserve query string.

**Otherwise**, use the registrar's URL forwarding: forward `aphex.dj` and `www.aphex.dj` to `https://aphex.cx`, permanent (301), with path forwarding on. Check that `https://aphex.dj` works afterwards; some registrar forwarders only handle plain HTTP.

### Making aphex.dj the primary instead

Swap the roles, following the same order as above: verify `aphex.dj` in your account's Pages settings, change the repo's custom domain (and the `CNAME` file) to `aphex.dj`, then put the GitHub Pages records above on `aphex.dj` and re-enable **Enforce HTTPS**. Finally, redirect `aphex.cx` to `aphex.dj` the same way.
