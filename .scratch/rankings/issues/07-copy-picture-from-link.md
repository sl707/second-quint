# 07: Copy a picture from a link

**What to build:** When adding or editing a contestant, a player can paste a link to an image instead of uploading. The site copies the image once and treats it exactly like an upload. Images are never hotlinked.

**Blocked by:** 06 (Add contestants and categories).

**Status:** ready-for-agent

- [ ] The picture field accepts either an upload or a pasted image address
- [ ] A server function fetches the image and hands it to the browser, which runs the same shrink-to-512-and-128 WebP process as uploads
- [ ] The server function refuses non-image content, files over 5 MB, and private or internal network addresses, and follows only a limited number of redirects
- [ ] The stored picture never references the original address
- [ ] Failures (broken link, blocked site, too large) show a clear message and leave the form usable
- [ ] Tests cover refusal of private addresses, oversize files, and non-image content
