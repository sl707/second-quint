# 07: Copy a picture from a link

**What to build:** When adding or editing a contestant, a player can paste a link to an image instead of uploading. The site copies the image once and treats it exactly like an upload. Images are never hotlinked.

**Blocked by:** 06 (Add contestants and categories).

**Status:** done

- [x] The picture field accepts either an upload or a pasted image address
- [x] A server function fetches the image and hands it to the browser, which runs the same shrink-to-512-and-128 WebP process as uploads
- [x] The server function refuses non-image content, files over 5 MB, and private or internal network addresses, and follows only a limited number of redirects
- [x] The stored picture never references the original address
- [x] Failures (broken link, blocked site, too large) show a clear message and leave the form usable
- [x] Tests cover refusal of private addresses, oversize files, and non-image content

## Comments

Implemented in 8305b54.

- **Built**: `copyPictureFromLink` in the catalog service (signed-in, non-banned players only) over `src/server/picture-link.ts`: http(s) only, no credentials in the link; every address the host resolves to must be public (pure `isPublicAddress` in `src/domain/network/address.ts`: IPv4 private/loopback/link-local/CGNAT/documentation/multicast/reserved, IPv6 outside global unicast plus documentation/6to4/Teredo, IPv4-mapped judged as IPv4) and the connection is pinned to the checked address (no DNS rebinding); at most 3 redirects, each re-checked; 5 MB checked against Content-Length and while streaming; JPG/PNG/WebP/GIF by sniffed bytes (`sniffPictureType`), not Content-Type; 10 s for the whole copy. `copyPictureFromLinkAction` returns the bytes to the contestant form ("Or paste an image link" + "Copy picture"), which runs the same `resizePicture` as uploads, so nothing stores the link. Errors show in the form's alert and leave it usable.
- **Tests**: unit tests for address classification and byte sniffing; 10 service tests against a local HTTP server (private literals and odd IPv4 forms, DNS names resolving to internal addresses, re-check on redirect, redirect limit, oversize declared and streamed, non-image content, 404, bad scheme, timeouts, banned/unknown player; refused addresses are never contacted); one e2e (refused link shows a message, then an upload still works).
- **Deviations**:
  - The service function takes test-only options (`trustedAddresses`, `resolveHost`, `timeoutMs`) so tests can stand a loopback server in for a public site; the app never passes them.
  - The e2e covers only the refusal path: the production build refuses the loopback test server, and there's no public internet in tests. The success path's browser half is the same `resizePicture` the upload e2e covers.
  - Any port is allowed; a host with any non-public address is refused even if it also has public ones.
- **Production**: Vercel caps function responses at 4.5 MB, so links to pictures between about 4.5 and 5 MB may fail there with the generic "couldn't be copied" message; if that matters, lower the link limit to 4 MB or shrink server-side.
