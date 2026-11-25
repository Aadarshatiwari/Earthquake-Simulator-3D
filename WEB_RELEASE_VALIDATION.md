# Responsive website release validation

The responsive website is available on port 4180 through localhost and the Mac's Wi-Fi address. The public release requires approval. Phase 7.2 and native development are on hold.

## Verification

- All 106 tests passed, with 7 Node and 99 Vitest tests. The Vite production build succeeded. The solver, scientific data, CSV calculation and report code were preserved.
- The desktop browser rendered the homepage model. The 390-pixel mobile browser viewport rendered a 364-pixel building canvas and showed no page overflow. The mobile Explore route loaded the archive with 293 events, and the 3D terrain view mounted.
- Local HTTP tests returned 200 for Home, the archive deep link, catalogue JSON, a historical waveform, the five-page research PDF, and JavaScript worker assets. The served catalogue, waveform and PDF matched the production files byte for byte. The Wi-Fi address responded successfully from the Mac.
- The [desktop and mobile browser screenshots](docs/screenshots/web-release/) show the production preview. Physical phones, other browser engines, a fresh browser save and restore, and browser-triggered PDF and CSV downloads still need separate testing.

## Performance and artifact

The site contains 107 files totaling approximately 22.6 MB. The historical archive contains 17.1 MB, including 16.3 MB of recordings that are loaded on demand. The largest individual asset is the lazy 2.26 MB illustrative debris bundle. The main JavaScript bundle is 282.08 kB uncompressed and 90.63 kB gzip. Loopback HTTP response times for five HTML requests ranged from 0.42 ms to 0.63 ms. This measures the HTML transfer over loopback. Cold page load, browser first paint, cellular performance and production CDN metrics remain unmeasured.

The deployment package contains site files only. See [deployment instructions](WEB_DEPLOYMENT_GUIDE.md) for the post-approval upload and HTTPS smoke test.
