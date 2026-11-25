# SeismoNepal 3D website deployment

**Recommended host: Cloudflare Pages Free with Direct Upload.** The release has 107 files, about 22.6 MB total, with a 2.26 MB maximum single file. It fits the dashboard's 1,000-file and 25 MiB per-file limits. Direct Upload accepts the compiled site and keeps the source repository private. [Cloudflare instructions](https://developers.cloudflare.com/pages/get-started/direct-upload/)

| Alternative | Fit |
| --- | --- |
| Vercel Hobby | Suitable for qualifying personal use. The documented CLI upload limit is 100 MB. [Limits](https://vercel.com/docs/limits) · [Hobby plan](https://vercel.com/docs/plans/hobby) |
| Netlify Free | The build fits the recommended size for dashboard uploads. Deploys, bandwidth and requests use plan credits. [Manual deploy](https://docs.netlify.com/manage/projects/add-new-project/) · [Credits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/) |
| GitHub Pages Free | Fits the 1 GB site limit. Free hosting uses a public repository. The existing workflow is manual and the production site uses relative assets. [GitHub limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) |

## Publish after approval

1. Choose the intended project name in Cloudflare. Set `PUBLIC_SITE_URL` to the final HTTPS address when building the share card metadata. Replace the example address in this command with the selected address.
   ```sh
   npm ci
   npm test
   PUBLIC_SITE_URL=https://example.pages.dev/ npm run build
   ```
2. Open **Workers & Pages**, select **Create application**, then choose the drag-and-drop option for Pages. Enter the project name and upload only `dist/` or a ZIP with its contents at the root. Select **Deploy site**.
3. Open the assigned HTTPS address. If it differs from the planned address, rebuild with the real URL and upload the new build so social crawlers get the absolute image path.
4. Reload `/?view=archive` and `/?view=research` directly. Run the Gorkha example, check the station provenance, export CSV and PDF, and reopen a saved project. Verify worker JavaScript and archive resources return files and that the PDF response is `application/pdf`.

The site uses same-origin relative asset paths and query-parameter workspace URLs. A root 404 page lets Cloudflare return a real missing-file response. The supplied `_headers` gives fingerprinted assets a one-year cache and makes archive and report assets recheck sooner. Cloudflare infers types for standard asset extensions, with a text override for legacy `.dat` recordings. Browser-generated CSVs use their own Blob MIME type. Public HTTPS enables Web Crypto for recording checksums.

Local preview uses `npm run preview -- --host 0.0.0.0 --port 4180`. Loopback is suitable for checksum checks. A phone's ordinary HTTP Wi-Fi preview may lack Web Crypto.
