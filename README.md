# georgeyumnam.github.io

Personal academic website for George Yumnam, a postdoctoral researcher in experimental quantum magnetism. The site highlights research initiatives, selected publications, teaching and mentoring activities, and provides basic contact information.

## Structure

- `index.html` – main landing page with hero, research, publications, teaching, and contact sections.
- `styles.css` – layout, typography, and responsive design.
- `script.js` – basic interactivity (e.g., navigation behaviour on small screens).
- `analysis.js`, `neutron-analysis.js`, `mossbauer.js`, `neutron-scattering.js` – page scripts for the analysis tools and interactive instrument pages.
- `images/` – figures used to illustrate research initiatives (e.g., magnon–phonon coupling, high-entropy oxides, artificial honeycomb lattices, and quantum magnetism).

## Security notes

- Every page carries a Content-Security-Policy `<meta>` tag that only allows scripts from this site and `cdn.plot.ly`. Keep page JavaScript in `.js` files: inline `<script>` blocks and `onclick=` attributes are blocked. When adding a new external script, stylesheet, font, or image host, add it to the policy on every page.
- CDN files are pinned with `integrity` hashes. When upgrading a library version, update its hash too (cdnjs lists them), or the browser will refuse to load it.
- Text that comes from uploaded files (file names, column headers) must be inserted with `textContent` or escaped, never concatenated into `innerHTML`.
- Strip location metadata from photos before committing them.

## Local development

You can preview the site locally by serving the repository as a static site, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

The site is deployed via GitHub Pages from the `main` branch.