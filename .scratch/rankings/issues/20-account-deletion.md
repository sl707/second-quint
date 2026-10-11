# 20: Account deletion

**What to build:** A player can delete their account. Everything personal disappears; their contributions to the shared catalog and global rankings stay, anonymously.

**Blocked by:** 14 (Personal rankings on profiles).

**Status:** ready-for-agent

- [ ] Signed-in players can delete their account after a confirmation step
- [ ] Deletion removes the profile, display name, and personal rankings, and signs the player out
- [ ] Their matches stay in global rankings, re-pointed to an anonymous placeholder
- [ ] Their contestants and categories stay, showing "Added by a deleted player"
- [ ] Game service tests cover that global rankings are unchanged by deletion and that nothing personal remains
