# Working rules for Claude in this repository

## Process
- Reply to the user in Italian, tersely.
- Implementation goes to background agents; they commit, push, and check Pages.
- After every push, check the "pages build and deployment" run for the pushed commit.
- Write clean code from the first draft, as if the lint rules applied while writing (no unused
  variables, imports or exports, no dead code, no duplicated helpers, consistent style), not
  cleaned up afterwards.
- Test cadence, counted over changes (commits): 1, 2, LINT, 4, 5, SUITE, then again. The 3rd
  change of each six runs `npm run lint`, the 6th the full suite (`npm test`); every change runs
  the tests related to it. A big change, or a user request, runs lint and the full suite at once.
- Never commit untested or half-done work: the branch deploys to GitHub Pages.
- Never commit the user's data (files they upload, screenshots of them), symlinks, nested git
  repositories or `.claude/worktrees`. Tests use synthetic fixtures only.

## UI layout rules
- **Plot on the left, tables / info / parameters on the right: tops aligned.** The first thing
  written in the right column (its first title, e.g. "PARAMETERS" or "Windows"; the first box
  where there is no title) has its top on the same horizontal line as the top edge of the
  plot's frame on the left, NOT on the line of the plot's selector/toolbar above the frame.
  Applies to every card laid out this way, in every module.
- **Sample selectors** (`snav.js`): the `‹ n/N ›` part has one fixed width everywhere, enough
  for `‹ 000/000 ›`; the name after it takes the room up to the toolbar and is cut with "…"
  only where it would reach it.
