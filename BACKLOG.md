# Backlog

Things looked at and deliberately left for later. Each says what was found and what
was proposed; nothing here is in the code yet.

## GC

- **CSV fields in quotes.** `splitCSVLine` splits on the delimiter even inside quotes,
  so a comma-separated export with quoted comma decimals (`"0,5089"`) shifts the
  columns: H₂ reads 0 and O₂ takes the next column. Semicolon files with comma
  decimals are fine. Proposed: split on delimiters outside quotes only.
- **Impossible dates.** `parseGCDate` takes month/day/year and does not check the
  ranges: `13/10/2025` silently becomes 10 Jan 2026, `2/30/2025` 2 Mar. Proposed:
  refuse a date that does not exist (or detect day/month order from the file).

## XRPD

- **Profile fit (debug).** The whole-pattern fit is a debug view, kept out of the
  Results and the module export. To be restructured; its results (intensities,
  crystallite size and the rest) are to go under the Analysis ones in the Results.
