# aphex-landing

Landing page for Aphex, served at **https://aphex.cx**.

## Build

```sh
npm ci
npm run build   # typechecks and bundles src/particles.ts → dist/particles.js
```

## Hosting & domains

The site is deployed to **GitHub Pages** by `.github/workflows/deploy.yml` on
every push to `main`. The custom domain is set by the `CNAME` file.

GitHub Pages allows **one** custom domain per repository, so `CNAME` holds only
`aphex.cx`. Additional domains have to be redirected to it at the registrar or
DNS level — they cannot be added to this repo.

| Domain     | Registrar / DNS | Setup                                                      |
|------------|-----------------|------------------------------------------------------------|
| `aphex.cx` | (primary)       | A/AAAA → GitHub Pages IPs; listed in `CNAME`               |
| `aphex.dj` | Netim           | Netim web forwarding: `aphex.dj` + `www` → `https://aphex.cx` (301) |

If `aphex.dj` should ever become the primary domain instead, replace the
contents of `CNAME` with `aphex.dj`, point its DNS at GitHub Pages, and set up
the reverse forwarding for `aphex.cx`.
