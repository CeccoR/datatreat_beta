# Working rules for Claude in this repository

## Process
- Reply to the user in Italian, tersely.
- Implementation goes to background agents; they commit, push, and check Pages.
- After every push, check the "pages build and deployment" run for the pushed commit.
- Tests: run the full suite (`npm test`) every 5 changes, or at once for a big change; otherwise
  `npm run lint` and the tests related to the change.
- Never commit untested or half-done work: the branch deploys to GitHub Pages.
- Never commit the user's data (files they upload, screenshots of them), symlinks, nested git
  repositories or `.claude/worktrees`. Tests use synthetic fixtures only.

## UI layout rules
- **Plot on the left, tables / info / parameters on the right: tops aligned.** The top edge of
  the right column's first box (table, info, parameter block) lies on the same horizontal line
  as the top edge of the plot's frame on the left; the rows above them (a box's title, the
  plot's selector and toolbar) share a line too. Applies to every card laid out this way.
- **Sample selectors** (`snav.js`): the `‹ n/N ›` part has one fixed width everywhere, enough
  for `‹ 000/000 ›`; the name after it takes the room up to the toolbar and is cut with "…"
  only where it would reach it.
