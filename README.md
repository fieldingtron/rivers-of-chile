# Rivers of Chile Restructuring Plan

We have implemented the following features and modifications:

1.  **Vercel Site Modifications**
    - Configured `<meta name="robots" content="noindex, nofollow" />` in the `<Layout>` component so the site will not be indexed.
    - Updated `next.config.js` to redirect all river pages to `riversofchile.com` EXCEPT for `rio-niblinto-de-malleco`. The redirects are pre-generated from the old WP GraphQL list and saved to `scripts/redirects.json`.
    - Modified `getStaticPaths` and `getStaticProps` to build statically and mock all paths except for the specific sample page.

2.  **Strategy for WP Takedown**
    The WordPress site `wp.riversofchile.com` is protected by Wordfence, which initially blocked scraping. To take it down:
    - **Step A:** Whitelist the IP of the server running the export, or disable Wordfence temporarily.
    - **Step B:** Export data using WP Admin (Tools -> Export), or use an automated script (like we tried with GraphQL/REST APIs) to download all content and images into JSON and markdown files.
    - **Step C:** Configure a 301 redirect map on your new DNS provider or hosting (e.g., Vercel, Netlify) so that requests to `riversofchile.com/` properly route to their new homes.
