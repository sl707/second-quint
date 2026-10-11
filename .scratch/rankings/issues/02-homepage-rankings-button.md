# 02: Homepage Rankings button

**What to build:** A small "Rankings" pill button in the top-right corner of the existing GIF homepage that opens the ranking app in the same tab. The GIF stays full-screen and nothing else on the homepage changes.

**Blocked by:** 01 (Working skeleton), so the link goes somewhere real.

**Status:** done

- [x] The homepage shows a small "Rankings" pill button fixed to the top-right corner, over the GIF
- [x] Clicking it opens `https://rankings.secondquint.com` in the same tab
- [x] The GIF still fills the screen on phone and desktop; the button doesn't shift or crop it
- [x] The homepage stays plain static HTML/CSS on GitHub Pages (no framework)

## Comments

- Done in `d823c36`: a `position: fixed` link (no `target`, so same tab) added before the GIF container; the GIF markup and styles are untouched.
- Checked in headless Chrome at 390×844 and 1440×900: the image element stays exactly viewport-sized, the page doesn't scroll, and the pill sits 16px from the top-right corner.
- The link works once `rankings.secondquint.com` is deployed (owner DNS/Vercel step from ticket 01).
