# SEM module

The SEM module takes Tescan images and works on them in five steps:

1. it reads them with their metadata;
2. it crops them;
3. it sets their grey levels;
4. it groups them by scale;
5. it lays each group out into a figure with scale bars.

The page has three cards, in this order:
- **File**: the files, ticked in or out, in the list every module has (file and sample label);
- **Groups and scale**: the groups (§4), each with its *Figure composer* button (§5), and *Reset* at the top right;
- **Crop and intensity**, in three columns:
  - three eighths of the width: the images' thumbnails in a box, over the image's details. The box's head holds the selector of the images the intensity applies to (§3.5) and *Link all* (§2.3); each thumbnail carries its chain;
  - three eighths: the image in its editor, the navigator (‹ the image's number › and its label, as in the other modules) over it and the histogram of its crop under it;
  - a quarter: the settings, *Crop*, *Intensity* and *This image*, each with its *Default* box, each field with its name above it, in rows: X and Y; width, height and ratio; normalisation and reference; black and white; brightness, contrast and gamma (and again for this image);
  - the thumbnails' column and the settings start at the image's top edge, and the thumbnails' column is as tall as the row (its thumbnails scroll);
  - one column (the image on top, the thumbnails, then the settings) on a phone, and wherever three columns would cut a field's name short with "…". Each resize tries three columns first, and stacks them when a name would be cut.

  There are no notes under the fields: the crop's size, and what the figure takes of it, are among the image's details.

The groups come first: an image's crop is then set knowing its group, whose common scale may narrow it (dashed in the editor, §4.2).

The code is in four files: `sem-read.js` (reading), `sem-read.worker.js` (reading the
files dropped off the page's thread, §6.3), `sem.js` (the module) and `sem-figure.js`
(the figure, a kind of figure of the composer in `figure.js`).

## 1. Files

### 1.1 What is taken

Only the files the Tescan software (Essence) saves are taken: a grey TIFF, 8 or
16 bits a pixel, uncompressed, in strips, carrying Tescan's own tag 50431. Everything
else is refused, each file with its reason in the list under the drop zone:

- not a TIFF, or a BigTIFF;
- a TIFF without the Tescan tag;
- a compressed, colour, tiled, signed or floating-point TIFF;
- a damaged one: its size needs more bytes than the whole file holds, its pixels run past the end of the file, or they fall short of its size;
- an image (the info bar left out) over 32767 px a side or 268 million px in all (2²⁸: a 16384 × 16384 image is taken), the most a browser draws in one canvas (Firefox's side, Chromium's area), as the editor draws the image whole. An image whose pixels are made square (§1.5) is held to the same, at its square size. The bar is never drawn: a frame over the limits whose image is within them is taken (a 16384 × 16448 frame with its 64-row bar).

**Checked before anything is allocated.** The size the header declares is checked
against the file's length and the strips' byte counts, and against the limits above,
before the pixels are given any memory. To v487 the pixels were allocated first: a
328-byte file declaring 20000 × 20000 px took 800 MB before it was refused (fewer
pixels than its size), and at 40000² or 70000² the list said only *Array buffer
allocation failed*. Now: *a damaged TIFF: its 40000 × 40000 px of 8 bits take 1.6 GB,
more than the whole file (328 bytes)*, with nothing allocated.

**Strips of 16-bit pixels with an odd byte count.** A strip's pixels are its whole
samples; a stray last byte is no pixel. To v487 such a strip was read one byte past its
end (a file whose odd strip ended the file was refused with *Offset is outside the
bounds of the DataView*), and every strip after it landed half a pixel off: a 64 × 64
image with three odd strips of seven loaded with 2176 pixels wrong, and no word. Now it
loads with every pixel right.

A `.hdr` dropped beside its `.tif` is skipped without a message: it holds the same
text as the tag.

**The alerts under the drop zone** (files refused, files already loaded, files loaded
but to check, and images a project opened could not read) belong to the tab they were
made in: another tab, empty or holding the same images, never shows them, and they show
again when their tab is back (the module tells a tab by its line of undo history, which
each state it saves carries; a state with none, as a tab's or a project's put in the
module, starts a new line). Within their tab they are about files: those they name, or,
for the refused and the unreadable, which were never loaded, the files in the list when
they were made (none: while the list is empty). Each shows while those files are in the
list: an alert about an image loaded with a warning goes with an undo past the upload and
comes back with the redo. It goes when they go (an image removed takes its own alerts
with it, *Remove all* all of them), when dismissed, or with the next upload. An undo,
and a project read in and out again (a saved project's CSV exported from the list, the
saved state of a tab compared on its return), leave them as they are, and what such a
project could not read is never said. To v487 every restore wiped them, though they are
about the upload, not the state. Checked with three tabs: the first tab's three alerts
stayed through an undo, two projects read in and out (one with an image that no longer
reads) and an undo and redo past the upload; a new tab showed none, then only its own
refused file; a project with an unreadable image, opened in a third tab, said so; each
tab, switched back to, showed its own again.

### 1.2 The Tescan tag

Tag 50431 holds blocks, each one being:

1. a 32-bit length, counting what follows it;
2. a 16-bit kind;
3. the payload.

| Kind | Payload | Used |
|---|---|---|
| 1 | a JPEG 2000 thumbnail (110 × 127 px on the user's files) | no |
| 2 | the `[MAIN]` section, `key=value` lines | yes |
| 3 | the `[SEM]` section, `key=value` lines | yes |
| 0 | the end | — |

**From `[MAIN]`:**
- `PixelSizeX` and `PixelSizeY` (m): a pixel's width and height (§1.5);
- `Magnification`;
- `ImageStripSize`, the info bar's height in rows;
- `Sign`, the sample's name. The file's `OrigFileName`, then its name, stand in when it is missing.
- `Device`, `Date`, `Time`.

**From `[SEM]`:**
- `HV` (V);
- `WD` (m);
- `Detector`;
- `Detector0Gain` and `Detector0Offset`.

The field of view is `PixelSizeX` × the width (for an image made of square pixels, its
pixel × its width, the same within half a pixel, §1.5). On the user's two files (VEGA,
1024 px wide) it gives 55.84 µm at 5 kx and 13.96 µm at 20 kx, the values printed in
their info bars.

### 1.3 The info bar

The frame is the scanned image with Tescan's info bar under it. The file gives the bar's
height (`ImageStripSize`, 159 rows on the user's files), not its place. No field gives
the image's place or the scan's resolution either. Having the bar at the bottom is
Tescan's layout, seen on every file so far.

The image is therefore the frame less `ImageStripSize` rows from the bottom. On the
user's files that is 1024 × 1183 − 159 = 1024 × 1024.

As a check, not a rule, the bar's first row is its border, one grey level across (25443
on the user's files, where the image's rows hold some 950–1000 distinct levels each).
When that row is not uniform, the image is still cut by the metadata, and a warning
says the bar may not be where Tescan puts it.

### 1.4 Grey levels

The pixels are kept at their depth, scaled to 16 bits (an 8-bit file × 257). A
WhiteIsZero file is turned the usual way round.

Every view of an image (the editor, the thumbnails, the groups, the figure) shows it
through its curve (§3).

### 1.5 Square pixels

Tescan gives a pixel's width (`PixelSizeX`) and height (`PixelSizeY`). Where they
differ by more than 0.1 %, the image is brought to square pixels as it is read
(`sem-read.js` `squarePixels`), so that the crop, the statistics, the grouping by pixel
size, the common scale, the figure and its scale bars all work on it as on any other.
To v487 `PixelSizeY` was read and left unused: such an image was drawn with square
pixels, stretched, and its scale bar held along X only.

- **The size.** The finer of the two. Along the finer side the pixels stay as acquired; along the coarser there are more of them, coarser/finer as many (rounded). Nothing acquired is lost, which the coarser size (an average over the finer side's pixels) would do, and the field is the same. Keeping X and resampling the rows would have reduced the rows where Y is the finer. The coarser side's pixel then differs from the finer's by at most half a pixel over the image (0.05 % over 1000 px).
- **The resampling.** On the 16-bit levels, before the curve, side by side: linear between the two nearest pixels when enlarging (the only case with the finer size), the end ones held; the mean of the pixels covered, in part where covered in part, when reducing.
- **The details** say so: *Image 300 × 300 px, 300 × 200 px as acquired*; *Pixel size 20 nm, square: resampled from 20 × 30 nm pixels*. The CSV's pixel size, image size and crop are in the square pixels.
- **Within 0.1 %** the image is taken as it is, the pixel size `PixelSizeX`: what it shows is what it showed to v487, byte for byte.
- **A project saved to v487** with such an image held its crop in the pixels as acquired: opened now, the crop is brought to the square ones (the same part of the specimen; the default crop stays the default), once, and the image's entry is marked so (`sq`).

**Checked** (v488) on generated images of a disc 4 µm across on a 6 µm field:
- **20 × 30 nm pixels** (300 × 200): read as 300 × 300 at 20 nm, the disc 200 × 200 px = 4.00 × 4.00 µm. To v487 it was 200 × 134 px, 4.00 × 2.68 µm. **30 × 20 nm** (200 × 300): 300 × 300 at 20 nm, the disc 200 × 200 px; to v487 at 30 nm, 134 × 200 px. A square control at 20.5 nm: 195 × 195 px, 4.00 × 4.00 µm.
- **A ramp** of 300 levels a row at 20 × 25 nm: 100 rows became 125, each the line between its two rows (1000, 1210, 1450, 1690… 30490, 30700).
- **Grouping.** The five of the test (the two discs, the ramp, a file within 0.1 % at 20 nm, the control at 20.5 nm) fell into one group; to v487 the 30 × 20 nm one, taken at 30 nm, made its own.
- **A v487 project** with a 150 × 100 px crop (3 × 3 µm) on the 20 × 30 nm image opened with 150 × 150 px, 3 × 3 µm; saved and reopened, unchanged.
- **Within 0.1 %** (20 × 20.019 nm, 21 × 20.98 nm): the editor, the histogram, every thumbnail and card the same pixels as v487.

## 2. Crop

### 2.1 The rectangle

The crop is a rectangle in the original's pixels:

- whole pixels;
- inside the image, never in the bar;
- at least 64 px a side (an image smaller than that is taken whole).

The image itself is never changed. The default crop is the whole image, with the bar
left out. While **Default** is ticked (as a new image starts), the crop is the default
and its fields are locked. Unticked, they open on it; ticked again, the crop goes back
to the default. A drag on the frame in the editor unticks it.

### 2.2 Editing

- **The editor.**
  - Drag a handle or a side to resize the crop, and inside it to move it.
  - By default the view stays fitted to the image: the wheel scrolls the page, and a drag outside the crop does nothing.
  - **The toolbar** over the image, as the plots' toolbar:
    - **Fit** fits the image again;
    - **Pan**: a drag moves the view;
    - **Zoom area**: the rectangle drawn fills the view.
    - While Pan or Zoom area is on, the wheel zooms about the pointer, a double click fits the image, and the crop is not edited. Clicked again, the tool is put down.
  - Shrunk, the image is drawn smoothed; enlarged past 2×, its pixels stay sharp.
- **The fields.** X, Y, width and height, in pixels. A value that would run past the image's edge brings the crop back inside it. The crop's size in µm is in the image's details.
- **The ratio.** 1:1, 4:3, 3:2 or free, applied as width:height. An image starts at the ratio of its default crop (1:1 on the user's files), or free.
  - A locked ratio holds while resizing. A corner scales both sides by the mean of the pointer's two moves; a side sets the other dimension about its middle.
  - A typed side sets the other side.
  - A new ratio keeps the crop's width and middle where it can, else its height.

### 2.3 Several images

- **Linked** images share one crop: setting it on one sets it on all. The chain on a thumbnail links its image, or unlinks it (lit when linked). An image newly linked takes the crop the linked ones share; the first one linked keeps its own.
- **Unlinked**, an image keeps the crop it had. So linking, then unlinking, copies a crop: there is no Copy to any more.
- **Link all** links the images the selector chose (§3.5), around the crop of the image in the editor; others linked before are unlinked, so that there is one linked crop. With all of them linked it reads **Unlink all**.

A crop larger than an image allows is narrowed to fit it (its ratio kept). The image is
then marked (⚠ on its thumbnail and in its details) until its crop is set again.

## 3. Intensity

### 3.1 The curve

Each image's grey levels go through one curve: a table of its 65536 levels, built in
two stages.

1. **The normalisation**, one for the images of a group (§3.5):
   - **none**: the levels as acquired, with 0 black and 65535 white;
   - **percentile stretch** (the default): black and white at two percentiles of the image's own levels, 0.5 and 99.5 % unless set otherwise;
   - **mean and SD of the reference**: v → μ_ref + (v − μ)·σ_ref/σ, on the reference's levels;
   - **histogram of the reference**: a level at a given share of the image's pixels goes to the reference's level at the same share.
2. **Contrast, brightness and gamma.**
   - Contrast scales the levels about mid-grey.
   - Brightness then adds a share of the full scale.
   - Gamma bends the mid-tones (y → y^(1/γ), so above 1 they brighten).

   Each has a value for the group's images (§3.5), and each image has its own correction on top: brightness is added, contrast and gamma are multiplied.

The values are clipped to black and white after each stage.

### 3.2 Statistics

The statistics (percentiles, mean, SD, histogram) are those of each image's crop,
with its saturated pixels (65535) left out. So what is shown is what is normalised, and
a saturated edge does not set the white. A new crop changes them.

### 3.3 The reference

The reference is any loaded image (the first one unless another is chosen). Its own
levels are taken as acquired, so with "none" it looks as the others are made to.

The reference is always one of the images, in the figure like the others (since v442;
a reference loaded only to normalise, *Reference only*, is gone). Its thumbnail carries
◎.

### 3.4 What the normalisations do to the user's two images

The 8-bit grey of each image's preview (its whole 1024 px crop), as mean / SD:

| Normalisation | STO 5kx | STO 20kx |
|---|---|---|
| none | 63.4 / 69.0 | 83.6 / 69.3 |
| percentile 0.5–99.5 | 61.6 / 73.0 | 88.5 / 76.8 |
| mean and SD of 20kx | 83.7 / 68.1 | 83.6 / 69.3 |
| histogram of 20kx | 83.8 / 65.2 | 83.6 / 69.3 |
| mean and SD of 5kx | 63.4 / 69.0 | 67.7 / 65.2, 37 % black |

The two crops differ in content: 5kx is mostly dark substrate (median level 4967), 20kx
mostly particles (22769). Giving one the other's statistics therefore changes what it
shows:
- the 5kx substrate lightens to match 20kx;
- with 5kx as the reference, 20kx's dark substrate falls below black, and 37 % of it clips.

The percentile stretch keeps each image's own content and only sets its range.

### 3.5 All images, or a group at a time

The selector over the thumbnails chooses which images the intensity settings
(normalisation, its percentiles, the reference, contrast, brightness and gamma) apply to.
- **All**: one set for every image.
- **A group**: each group has its own set. The settings shown are those of the group of the image in the editor; the other groups' images are dimmed and keep theirs. Choosing a group shows its first image; clicking a dimmed thumbnail shows that image and chooses its group.
- **From All to a group**, every group starts from All's settings, and each is then changed on its own.
- **From a group back to All**, All takes the settings of the group on show, and every image goes back to one set.

Nothing jumps across a switch. This is the rule of every module's all/one switch (§
Changelog, v442).

**Default** locks the settings at their defaults: percentile stretch 0.5–99.5 %, no
change of contrast, brightness or gamma; the reference is kept. Unticked, the fields open
on the defaults; ticked again, they go back to them. **This image** has its own
*Default*, independent: no correction of its own.

**Checked** on the user's two images and two copies (thumbnails' mean grey, 5 kx and 20 kx):
- **All.** Default unticked and brightness 10: 93 and 118.
- **The 20 kx group.** It inherited brightness 10 (the same greys), then set 30: 93 and 164. The 5 kx thumbnails were dimmed.
- **A 5 kx thumbnail clicked.** The selector went to 5 kx, showing 10.
- **Back to All from 20 kx.** All took 30: 140 and 164. Ticking Default gave 69 and 93, the defaults.

## 4. Groups and scale

### 4.1 Grouping

The images in the figure, those that are included, are grouped by pixel size.

**The rule.** Two images are in one group when every pixel size in it lies within 10 %
of the others (largest/smallest ≤ 1.10). A newly loaded image joins the first group it
fits, else starts its own.

**The name.** A group is named by the magnification of its image with the largest
pixel size, the one its common scale brings the others to.
- The name reads as plain text. Like the project's name, its field shows on hover and while it is edited.
- A name typed there stays; emptied, it goes back to the magnification.

**The box.** Each group is a box 4φ wide to 1 high (6.47 : 1) at full screen. Full
screen means the screen's width, at most the page's 1500 px. It keeps that height
whatever the window, worked out once at the first layout: narrower windows make it
less wide, not lower. Its images take what the height leaves under the head and over
their names, never under 80 px (as on a phone, where the box grows instead).
- At the top left is its name. On the same line, at the top right, is its *Figure composer*, with the scale just left of it as two radio buttons, *common scale* or *own scale*. On a phone the scale goes under the name and the button.
- Then come its images, 112 px each with its name under it, in one row across the whole box.

**Paging.** A row wider than the box shows an arrow at the end where there is more,
boxed, 15 px wide and as tall as the images, with no scrollbar. A click turns a page:
the row slides smoothly by what it shows, and snaps to an image's edge. A finger can
also swipe it. The arrows stand outside the row, never over an image. Their room is
kept at both ends even when no arrow shows, so the row never moves when one appears.

Checked:
- At 900 px, eight images (800 px of row, 180 px more): › alone at first, ‹ alone after one page.
- At 390 px (690 px more): one page moved the row 212 px, and both arrows showed.

**Editing.**
- An image is dragged onto another group, or onto **+ Group** under the groups, to move it there; + Group starts a new group with it. A copy of it follows the pointer and the group under it lights.
  - With a mouse, the drag starts as the pointer moves.
  - With a finger, the image is held still for 0.3 s first (its border lights). A swipe over the images scrolls the page; a sideways one scrolls the group's row.
- **+ Group**, clicked, adds an empty group, to drag images into. Its *Figure composer* is disabled until it has images.
  - A group emptied by dragging stays too, with its name and figure.
  - An empty group is removed with its *Remove*. A group left empty because its images were removed from the file list goes.
  - A newly loaded image never joins an empty group: it has no pixel size to be near.
- **Reset**, at the card's top right, starts again from the pixel sizes. Groups made by hand, empty ones and typed names go; a group made again with the same images keeps its figure and its intensity settings.

### 4.2 Common scale and own scale

A group's images share one scale bar in the figure.

**At common scale** (the default), every image in the group is brought to:
- **The group's largest pixel size.** The others are reduced, each new pixel the mean of the old ones it covers, in part where it covers them in part. They are never enlarged: nothing is invented.
- **The group's smallest field of view**, in µm, width and height apart. Each crop is narrowed about its middle to it, and the crop editor shows the narrowed crop dashed.

The resampling is done on the 16-bit levels, before the curve (§3). The user's crop is
kept as it is, and the narrowing is recomputed whenever a crop in the group changes.

**At own scale**, each image keeps its pixels and its crop, and gets its own scale bar.

### 4.3 Examples

These used the user's two images and two copies of them whose tags give other pixel
sizes:

| Image | Pixel size | Field |
|---|---|---|
| 5 kx | 54.53 nm | 55.84 µm |
| "5.45 kx" | 50.0 nm | 51.2 µm |
| 20 kx | 13.63 nm | 13.96 µm |
| "21.0 kx" | 13.0 nm | 13.31 µm |

**Grouping.** They fell into two groups (ratios 1.09 and 1.05). The groups were named
"5.00 kx" and "20.0 kx".

**Group "5.00 kx".**
- It is at 54.53 nm a pixel, with a field of 51.21 × 51.21 µm, 939 × 939 px.
- The 5 kx crop is narrowed by 16 % of its area.
- The 5.45 kx image keeps its whole crop and is reduced ×0.917.

**Group "20.0 kx".**
- It is at 13.63 nm a pixel, with a field of 13.32 µm, 977 px.

**A narrower crop on 5 kx.** Cropping 5 kx to 800 px (43.63 µm) narrows the other
image's crop to 873 px of its own pixels (43.65 µm), taken to 800 × 800.

## 5. Figure

### 5.1 The page

**One figure per group.** Each group has its own *Figure composer* button and its own
figure, with its own settings. Its file is named after the group (`SEM_5.00_kx`) until
named otherwise. The modal is titled *Figure composer*, as the plots' is, with its
cross at the top right.

**The page and the plot.** The page's width and height are set freely; a new figure
starts as tall as its images need at its width.
- **The plot** is the smallest rectangle round all the images.
- **Auto margins** (the default): the images as large as the page allows, with what lies outside them (names, letters, bars) in the margins, the whole centred. The plot's width and height show what was chosen, locked.
- **Unticked**, the plot's width and height and its alignment on the page open on those values. The page and the plot are then independent: neither changes the other, and a plot larger than the page runs off it, which is seen at once. The images keep their proportions, so the plot's width and height go together: the one set last decides, and the other's field shows what follows. The alignment is picked from the plots' composer's grid of 9.
- A value out of a field's range is refused in both composers: the field shakes red and goes back.

**One composer.** The SEM figure is a kind of figure of the figure composer
(`figure.js`), the plots being the other. The composer is the same for both: its modal,
preview, field kit, rows dragged by their handles and exports; `sem-figure.js` gives the
figure's settings, layout, drawing and controls. So:
- one page in millimetres, previewed as it will be exported, which the wheel zooms and a drag pans;
- the composer's fonts (Inter embedded in the files);
- export as SVG (with the images in it) or as PNG at the chosen dpi on the figure's background, or a PNG copied to the clipboard;
- one composer open at a time, of either kind. A double click on *Figure composer* before its code had loaded, or Enter on the button (still focused under the modal), opened a second one, and the first could no longer be closed (to v480). The focus now goes into the composer, and back to the button when it closes. ← and → no longer step the image behind it.

There are no axes and no legend.

**A PNG too large for the browser.** Before drawing, the export makes its canvas and
checks that it works. Chromium makes none over 65535 px a side or 2²⁸ px in all (measured);
Firefox, Safari and iOS have their own limits. Too large, the composer says so in its
footer, in red, with the most this page takes: *Too large for a PNG in this browser:
33071 × 34507 px. At most 2328 dpi for this page.* (175 × 182.6 mm at 4800 dpi). From then
the footer's line adds *too large for a PNG here: at most 2328 dpi* while that page is
asked for at more. A drawing that will not load, a PNG the browser will not make and an
SVG too large to write each give their own message. All of these failed in silence, with
no file and no word (to v480). A composer closed before its file is made still saves it.

### 5.2 Panels

**Which images.** Each image of the group in the figure is one panel: those that are
included. It enters as its group made it
(§4) and through its curve (§3). The preview uses a copy reduced to 520 px; the export
uses the full one.

**The grid.** It has two levels: **panels** of **images** (in the code, blocks of
panels). The images fill one panel after another, each row by row: 2 × 1 panels of
2 × 2 images hold eight, the first four in the left panel.
- **Automatic** (the default): one panel, the most compact rectangle: ⌈√N⌉ columns and ⌈N/columns⌉ rows (12 images give 4 × 3, not 6 × 2). Its fields show what was chosen, locked; unticked, they start from it.
- **By hand**: the panels' rows and columns, and the rows and columns of images in a panel. Rows of panels are added when too few places are given.
- **The gaps**: one between the images in a panel (1 mm by default), one between the panels (4 mm).
- The columns are equal.
- An image row is as tall as its tallest image at that width, across its row of blocks.
- The controls give the panels first, then the images in a panel.

**Order.** It starts as the file list's. The *Images* list groups the images by
panel, as the plots' composer groups its series, each panel's head with how full it is
(2/4). A row dragged by its handle:
- within its panel, goes to the gap that lights;
- into another panel with room, moves there, the gap lighting and the panel too; the place it leaves stays empty;
- into a full panel, swaps with the image it is dropped on, which is ringed.

*Restore*, at the right of the list's title, puts the file list's order back, with no
empty places. The row's field is the name shown on the image.

**Names.** Each panel carries its sample's name, editable per panel, horizontal or
vertical (upright, reading up; outside on the right, reading down).
- **Placed automatically** (the default), block by block, each block as if it stood alone: outside where there is room, above the block's first row and below its last. The rows between have it inside, at the top for the first half and the middle row (an odd count), at the bottom for the second half. One row: above. Vertical names go the same way by the block's columns: left of the first, right of the last, inside left or right between. Only rows and columns that hold images count. The alignment along the name stays the user's: left, centre or right (top, centre or bottom when vertical).
- **By hand**: the position (inside or outside) and both alignments. Outside, a name is beside an edge, never across the middle.
- Inside, white with an outline by default, which reads on any grey; outside, black on a white page (white on a black one). The colour on the images, the outline and its colour can be changed.
- **The outline's colour**, unless picked, is black or white by the plots' composer's rule (WCAG relative luminance over 0.179: black), as their labels are. To v480 the SEM figure had its own rule (YIQ luma over 0.5), which gave a white outline where this gives a black one to mid-luminance inks: pure reds, pinks and magentas (`#ff0000` to `#ff3399`, `#cc00ff`, `#cc33cc`), oranges (`#cc6600`, `#ff3300`), mid greens (`#009900`, `#00cc00`, `#339933`, `#669900`), azure blues (`#0099ff`), `#6666ff`, `#996699` and the greys `#767676` to `#7f7f7f` (31 of the 216 web colours, and those greys). A project with such an ink and no outline colour picked now draws a black outline. White, black, blue, navy, dark red and green, yellow and cyan are unchanged. Its swatch follows the ink as it is picked (it kept the old colour until the controls were drawn again, to v480).

**Letters.** (a), (b)… in the panels' order, off by default, in the styles a, (a), A
and (A).
- **At the start of the name**: written before it, in its size (the letters' own size is then disabled), where the name is.
- **Apart**: inside or outside, top or bottom, left or right (8 places), in their own size. Outside, a letter shares its band's line with the name, written before it when on the same side. Inside, in the name's corner, the two go on one line.

**Room outside.** What is placed outside an image goes in a band above or below its
row (or beside its column, for vertical names), as deep as the deepest thing in it, the
same for every panel of the row so that the grid stays aligned. A bar shares the line of
the name and letter when on the other side from them, else it takes a line of its own,
next to the image. The bands at the outer edges are the margins round the plot.

### 5.3 Scale bars

- **Which panels.** A group at common scale has one bar, in its last panel in the figure's order, or one on every panel with *One bar per image* (all of one length). A group at its own scale has one in every panel, each its own length: the box is then ticked and disabled.
- **Length.** A round 1, 2 or 5 × 10ⁿ µm nearest (on a log scale) to 22 % of the panel's width, unless typed: any value, as 4.56 µm. It reads in nm under 1 µm.
- **Placing.** As the letters: inside or outside, top or bottom, left or right (inside, bottom right by default). Outside, 0.4 mm above or below the image, flush with its side, the length above the bar over the image or under it below. The upright bars at the sides (v440) are gone.
- **The lengths' fields** are named by what they measure (the image, at own scale); the group's magnification no longer heads them.
- **The text** is centred on the bar, or flush with its outer end when wider than a short bar. The thickness is 0.7 mm.
- Outside, the bar and its length are in the page's ink (black on white), with no outline.

### 5.4 Settings

The figure's settings are the module's: they are saved with the project, and undone
and redone with it (Ctrl+Z inside the open figure too).
- **One step a colour drag.** A change is drawn at once and reaches the module at once, as one undo step; a drag in the colour picker reaches it 250 ms after its last tick, as one step. It made one a tick (30 for 30 ticks, to v480), pushing the crop and intensity steps out of the module's 80. Ctrl+Z, an export, closing the composer, and the page being hidden or left send a waiting change first, so Ctrl+Z right after a drag undoes it and a reload keeps it.
- **The file name** stays the group's after an undo. An undo back to before the first change named it *SEM_figure* (to v480).
- **Undo past *Reset* of the groups** (which makes them anew) closes the figure: its group is gone. It showed an empty figure (to v480).

**Checked** (v439) on the user's two images and two copies with other pixel sizes, four panels:
- **The grid.** It came out 2 × 2: 175 × 175 mm, 4134 × 4134 px at 600 dpi.
- **The bars.** There were two, one per group: 10 µm in the 5 kx group's last panel, 2 µm in the 20 kx group's.
- **Editing.** A typed bar of 4.56 µm, letters, a dragged panel and a 4 × 1 grid were each taken up.
- **The exports.** The PNG came out 4134 × 1016 px. The SVG was 175 mm wide, held the 4 images, and had the font embedded.
- **Reload.** The order, the grid and the bar survived it.

**Checked** (v440) on a group of eight images (the user's 5 kx image and seven copies):
- **Blocks.** 2 × 1 blocks of 2 × 2 panels, gaps 1 and 6 mm: 175 × 84.5 mm, images 41.75 mm wide. The gaps across came out 1, 6, 1 mm and down 1 mm, and the images filled the left block first. As 1 × 2 blocks: 175 × 356 mm, gaps down 1, 6, 1 mm. Asked for one block, the grid went back to two rows of blocks.
- **Names outside.** Above and below, the page grew to 92.1 mm (8 pt names, a 3.81 mm band each). Left and right, the images narrowed to 37.94 mm, the names upright in the band.
- **Bars outside.** Above or below: the bar 0.4 mm from the image, flush with its right edge. Left or right: an upright bar 7.25 mm long, ending at the image's bottom edge.
- **Letter, name and bar all above**: "(a) STO 5kx" on one line, the bar's band under it.
- **Phone width (390 px).** No sideways scroll. A swipe over the group's images scrolled the page 347 px; a 0.45 s hold and a drag moved an image to the other group.
- **Exports.** SVG 6.0 MB; PNG 4134 × 4134 px at 600 dpi.

**Checked** (v449) on eight images in 3 × 3 panels:
- **Names, automatic.** The first row above, the middle row inside at the top, the last below. Vertical: the first column outside left, the middle inside left, the last outside right, reading down.
- **Locked fields.** With names automatic, Vertical and Position read "by row", disabled. With the letter at the start of the name, its position, sides and size are disabled.
- **Letters.** Outside top right: (a) ends on the image's right edge, above it. Inside bottom left and outside bottom left were also checked.
- **Bars.** *One bar per image* drew eight, with one length field. Outside bottom right: 0.4 mm under the image, ending on its right edge. Outside top left and inside top right were also checked.
- **Margins.** Auto gave the plot 175 × 175 mm in a 175 × 182.6 mm page. Unticked, the plot fields opened on 175 × 175. At 100 mm wide, top left, the first image sat at 0, 3.81 mm, under its names' band.
- **Colour picker.** Open on the outline's swatch, it sat beside it, level with its bottom; a click on the preview closed it.

**Checked** (v481, the one composer) on eight generated images in two groups and the three fixtures, against v480:
- **Same figures.** 15 SEM figures (grid and blocks, names automatic, by hand and vertical, letters apart and before the name, bars per group and per image in 8 places, round and typed lengths, own scale, auto margins and a plot set by hand, white and black pages, five inks, Times, the shapes of v439 and before v440) gave the same preview, controls, SVG, PNG and clipboard bytes, but for the outline of the red, `#777`, magenta and `#0099ff` inks (white to black) and `#000`/`#fff` written out in full. A project saved with v480 opened with the same figures.
- **Plots unchanged.** Ten plots (GC, DRS, XRPD, EPR, and a GC bar plot with 2 panels, log Y, a global legend, a division and a texture): every preview, control, dim line, SVG, PNG and clipboard byte the same. So were 42 scripted edits in the two composers (the figures, the SEM undo steps, the plots' presets and memory), but for one fix: Ctrl+Z in the plots' composer no longer also undoes the GC module behind it.
- **PNG limits.** 175 × 182.6 mm at 4800 dpi: the message with 2328 dpi, no file. 1000 × 10 mm at 4800 dpi: 1664 dpi, then 65512 × 655 px at 1664 and the message again at 1665. Plots at 20000 dpi: at most 3136 dpi for 160 × 110 mm.
- **One composer.** A double click with the code 400 ms late opened one; Enter on the button opened none more; Escape closed it.
- **History.** 30 picker ticks made 1 step (30 in v480).

## 6. Project and export

### 6.1 How a project stores the images

A project keeps each file's own bytes: in the module's state as they are, a `Uint8Array` in a RawRef (since v518; to v517 as base64); in the browser once, by their SHA-256, in the bytes store, a project or a tab holding that key (v517); in a `.datatreat` file as base64. A record, a project saved and a project file hold a RawRef in v517's form, `{ id, b64 }`, so that v517 reads them.

- **Why not a typed array, to v517.** `db.js` `encode()` turned a typed array into a plain array of numbers: eight bytes a value in IndexedDB, and a decimal each in a `.json`. v517 stored the bytes apart, by their hash; v518 keeps them in the state as an array.
- **The undo stack.** It compares snapshots with `JSON.stringify` on every edit. The bytes' holder serialises in JSON as its id alone, so a snapshot compares at the cost of its crops: 2 ms an edit with two images.
- **Saved projects and `.json` files.** These keep the bytes. A project with the user's two images exports as a 6.5 MB `.json`.
- **The id.** It is a hash of the bytes. A second copy of a file already loaded, whatever its name, is reported as already loaded.
- **Restoring.** Opened again, a project's images are read again from their bytes. One that no longer reads is left out, with a note. Which still read, and their sizes, are learnt from the headers alone; the pixels are decoded when drawn (§6.3).
- **A malformed project** (a project file edited by hand or damaged) is taken as the module would have made it. To v487 what it held went in as it was: a crop that was not a number threw in the canvas (*Value is not of type 'long'*) and the views drew NaN; a `files` that was not a list, a null entry or a null group threw and left the module empty; a correction of 1e9, a normalisation *evil*, an index of −3, `__proto__` among the groups' settings went in. Now:
  - an image: its bytes, and an id of the form the hash gives (else made from the bytes), once (a second entry of one id is dropped); strings for its name and label; its crop whole pixels inside the image, at least 64 px a side, else the default crop; its ratio one of the four; its correction within the fields' ranges; its *Default* boxes ticked only where the crop and the correction are the defaults;
  - the settings, all groups' and each group's: a normalisation of the four, every number within its field's range, else its default;
  - the groups: ids that are names (no key of a plain object's own, as `__proto__` or `toString`), once each; each image in one group; the scale common or own; the image shown at index 0 or more;
  - a group's figure: each number within its field's range (wider for the grid's counts, the height and the plot, which the layout also sets), each choice one of its options, each box true or false, the ink a colour, else the default; the order, names and bar lengths as the controls write them. To v487 a width that was not a number drew the figure as NaN.

  Checked on 13 projects malformed so, and on the payload fuzz (every string and number prefixed with markup): every one opened, its images, settings and groups sane, an image stepped to and its crop edited, every group's figure drawn without NaN, and no page error; the fuzz found nothing injected.

### 6.2 CSV

The CSV holds one row per included image, with these columns:

| Column | Content |
|---|---|
| `file`, `sample` | the file's name, the sample's label |
| `magnification` | from the file |
| `pixel_size_nm` | from the file |
| `field_of_view_um` | `PixelSizeX` × the width |
| `HV_kV`, `WD_mm` | the beam |
| `detector`, `detector_gain`, `detector_offset` | the detector |
| `date`, `time` | the acquisition |
| `image_width_px`, `image_height_px` | the image, bar left out |
| `info_bar_rows` | `ImageStripSize` |
| `crop_x_px`, `crop_y_px`, `crop_width_px`, `crop_height_px` | the crop |
| `crop_width_um`, `crop_height_um` | the crop's size |
| `crop_mean_level`, `crop_sd_level`, `crop_saturated_pct` | the crop's statistics |
| `intensity_settings` | `all groups`, or `group` where the image's group has its own (§3.5) |
| `normalisation`, `reference` | the normalisation, and the reference's label where it uses one |
| `black_level`, `white_level` | the levels a linear normalisation takes to black and white (empty for the histogram) |
| `brightness_pct`, `contrast`, `gamma` | as applied, the image's own correction included |
| `group`, `scale` | the image's group, and its scale (common or own) |
| `figure_x_px`, `figure_y_px`, `figure_width_px`, `figure_height_px` | the part of the original the figure takes (the crop, narrowed in its group) |
| `figure_pixel_nm` | the pixel size in the figure |
| `figure_out_width_px`, `figure_out_height_px` | the image's size there |

The group columns are empty for an image in no group.

### 6.3 Speed and memory

**Reading files off the page's thread.** Each file dropped is read by a worker
(`sem-read.worker.js`, a module file of the page's origin, as the page's script policy
asks; one for every SEM tab): its id, the image, its 160-px copy, its default crop's
statistics, its card in a group, and its bytes, sent back (to v517 its base64 too). The
page answers meanwhile; the files read join the list together, one step of the history,
as before. While files are read the tab is busy: the reading goes on in a tab left, its
files joining that tab's list as one step, and the tab does not sleep until it ends
(v518); closing the tab asks first (*The reading of SEM files is running in "…": closing
this tab stops it*) and stops it, nothing going into the project. To v517 a switch to
another tab asked first and stopped it. A reading holds the history from the state on show as it starts: undo goes down to
it and no lower, silently there, and above it undo and redo go as ever, the reading going
on; the files read join the list as one step at its end, as before (a step undone
meanwhile cannot be redone after it, as after any new step). Up to v508 undo and redo
waited for the reading's end, a banner saying so. Files dropped meanwhile are read after,
the drop zone reading until the last. Where no worker runs, the files are read on the
page's thread, a frame let through between two, with the same result. To v487 all of it
ran on the page's thread.

**Drawing only what changed.** Each image keeps what was drawn of it with what it was
drawn from: its curve (one for each set of what it is made from: the crop's statistics,
the reference's, the settings, its correction; to v487 three or four an image at every
edit), its thumbnail (its curve and crop), its card in its group (the part of the
original it takes and its size, then its curve: a brightness change puts the curve
again on the levels kept, a crop that leaves the group's field puts nothing), the
editor's image (its curve). An edit draws again only those whose inputs changed; to
v487 every thumbnail and card, each card resampled from its whole crop.
- **The cards are still made from the whole crop**, not from the thumbnails' 160-px copy: a card is drawn at up to 200 px, and a crop of half the image is some 80 px of that copy, which the card would show enlarged, blurred. Kept as they are, they look as they did, pixel for pixel.
- **The same numbers.** The statistics, the resampling and the curves are computed as before, to the last bit: the crop's sums are taken from its histogram where that is exact (a sum of squares under 2⁵², every partial sum then a whole number), else pixel by pixel as before; the resampling adds the same terms in the same order, its weights in flat arrays; a large region goes through a table of each level's whole pixel. The browser's own base64 (`fromBase64`, `toBase64`), where it has it, reads a 8.6 MB file in 13 ms, not 50.
- **A restore** is drawn once the task that made it is over (a microtask, before anything is painted), and learns which images read from their headers alone, decoding none. A project read in and out again is not drawn: for the saved state of a tab compared on its return nothing is decoded; a saved project's CSV decodes the images it includes, for their statistics, and lets them go afterwards, as below (both timed below). To v487 both were drawn, every image of the project decoded and kept.

**Memory** (v518, `sem.js` *What the files are made into*). A file's bytes are one
array whichever tabs hold it. An image of 16 bits in Tescan's order needs no decoding:
its levels are a view of its bytes; another (8 bits, the other order, pixels made
square) is copied, 2 bytes a pixel. The images of the tab on show and of a reading are
kept at full size; the copies of the others within 32 MB (three images of 2048²), the least
recently used let go first, read again from their bytes when needed. What a file is
made into beside (its header, its 160-px copy, its last 4 cards in a group: some
0.15 MB an image of 2048²) is kept while any tab holds the file, awake or asleep, so
that a tab woken draws its thumbnails and cards without reading its images whole. A tab
asleep lets go of its files' bytes, read back from the browser's storage as it wakes.
To v517 every image of the list was kept decoded, and the others up to 128 MB; to v487
every image ever loaded or restored stayed decoded until the page was reloaded.

**Measured** (v488, headless Chromium, eight 2048² images in two groups, v487 against
v488, each edit the time its handler holds the page):

| | v487 16-bit | v488 16-bit | v487 8-bit | v488 8-bit |
|---|---|---|---|---|
| brightness, all images | 279–329 ms | 39–55 ms | 226–269 ms | 44–47 ms |
| contrast, all images | 238–286 | 41–44 | 217–271 | 42–49 |
| brightness, one image | 227–284 | 24–27 | 232–280 | 21–25 |
| crop width, one image | 258–332 | 71–85 | 262–337 | 70–111 |
| crop width, eight linked | 333–413 | 106–135 | 192–294 | 105–151 |
| normalisation: histogram, mean and SD, percentiles | 235, 158, 162 | 61, 40, 26 | 203, 157, 168 | 70, 44, 27 |
| next image | 151 | 22 | 152 | 22 |
| undo (with its drawing) | 152–214 | 27–38 | 156–163 | 29–40 |
| loading: frames held over 50 ms | 8 (each file's, then 787 ms), 1824 ms in all | one, 234 ms | 8, 1342 ms in all, longest 693 | one, 216 ms |

The loading's frames are measured with the tab's saving left out: the tabs' autosave
writes the whole project, every image's base64 in it, into the browser's database on
the page's thread (`db.js`), some 400 ms for these eight (with it, 16-bit: v487 ten
frames, 2838 ms in all; v488 three, 1035 ms). Every view (the editor, the histogram,
every thumbnail and card, the image's details), the CSV and the figure's SVG and PNG
were compared over 22 steps of edits and 16 figure settings: the same, byte for byte.

**A project read in and out again**, three 2048² 16-bit images, in a fresh page: its
saved state 35–44 ms (v487 570–585 ms, every image decoded and drawn); its CSV 255–260 ms
(v487 620–800 ms).

**The heap** (decoded images included), six projects of four 2048² 16-bit images opened
in turn, each also read in and out once, then the first again: v487 124, 160, 196, 232,
267, 267, 267 MB, every image kept; v488 106, 142, 179, 197, 197, 197, 197 MB.

## Changelog

**v436**: the module. Tescan TIFFs are read with their metadata, with the info bar left
out by `ImageStripSize`, and cropped.

**v437**: intensity (§3): a normalisation for all images (none, percentile stretch,
or the reference's mean and SD or histogram), then contrast, brightness and gamma, with
a correction per image. The statistics come from the crop.

**v438**: groups and scale (§4). The images are grouped by pixel size (within 10 %),
named by magnification, and editable. A group at common scale is brought to its largest
pixel size and its smallest field, so one scale bar serves it.

**v439**: the figure (§5). The images are laid out in the figure composer's page: an
automatic grid, draggable panels, names, letters, a scale bar per group, and PNG/SVG
export.

**v440**: the page reordered and one figure per group.
- **Cards.** The groups come before the crop, and crop and intensity are one card. The editor gets the plots' toolbar (fit, pan, zoom area), off by default: the view no longer pans or zooms unless a tool is on.
- **Groups.** An image is dragged between groups, or onto *New group* (a finger holds it first).
- **Figures.** Each group has its own *Figure composer* and figure; the Figure card is gone. In the composer, the panels are reordered by the handles of the *Images* list (no more dragging panels on the page).
- **Grid.** Blocks of panels, each with its own gap.
- **Outside placing.** Names and scale bars can also be placed outside the images (above, below, left, right).
- **Older projects.** A project saved before v440 had one figure; each group's figure starts from its settings, its file named after the group.

**v441**: the cards laid out again, and intensity per group.
- **File list.** It shows the file and the sample label alone, as in the other modules; the magnification column is gone.
- **Groups.** A box 4φ : 1 per group, with its name (a field on hover, as the project's), its scale under it and its figure on the left, and its images (112 px, three quarters of before, the name alone under them) in one row on the right. **+ Group** adds an empty group, and empty groups stay until removed. **Reset** (was Regroup) sits at the card's top right. The group's line of pixel size and field is gone (the crop's note gives it).
- **Crop and intensity.** The card is split into halves. On top are the image with its histogram, and the thumbnails over the image's details, the two sides as tall as each other. Under them are the crop's fields and the intensity's. The *Linked* box became a chain on each thumbnail.
- **Intensity.** It can be set per group (§3.5).

**v442**: groups paged; the crop and intensity card in three columns.
- **Groups.** The name at the top left; the scale on the left and *Figure composer* on the right under it; the images across the whole box, paged by arrows instead of a scrollbar.
- **Navigator.** ‹ the image's number › and its label, as in the other modules.
- **Columns.** The thumbnails and the image's details take a quarter, starting at the image's top edge. Then the image with its histogram, then the settings, two to a row with their names on the left (units in the names: X (px)…).
- **Selector.** It sits over the thumbnails (All or a group, §3.5), with *Link all*. It replaces *Settings for* and *Its own settings*.
- **Defaults.** A *Default* box each for the crop, the intensity and this image, in place of the Default, Copy to…, No correction and Defaults buttons.
- **Notes.** The notes under the fields and the histogram are gone; the crop's size and what the figure takes are in the image's details.
- **Reference only** is gone: the reference is one of the images.
- **Other modules.** The all/one switches of Tauc and XRD now carry values the same way. To one, every sample starts from the common values (Tauc: its parameters and interval lines; XRD: each switch's field). Back to all, the common values are the shown sample's. Before, Tauc's one kept older per-sample values and re-proposed the lines, and XRD's one changed the shown sample alone. GC's switches are as they were.

**v444**: the columns three eighths, three eighths and a quarter (thumbnails and details,
image, settings); the settings' names back above their fields, in rows of two or three.

**v445**: the groups' page arrows outside the row of images, half as wide (15 px), their
room kept when they are not shown.

**v446**: a group's *Figure composer* on its name's line, at the top right, with the scale
just left of it as two radio buttons instead of a menu.

**v447**: the thumbnails in *Images* sized to the window. As many a row as fit at 90 px
or more, stretched to fill it, so a row is a whole number of them with no strip left.
Measured: 5 a row at 93 px at 1500 px, 4 at 97 px at 1280, 3 at 110 px at 1100, 2 at
131 px at 900; on a phone 3 at 93 px. Their copy is now drawn at about 160 px, not 112,
so that a wider thumbnail stays sharp.

**v448**:
- **Groups.** They keep the height of a 4φ : 1 box at full screen, the images fitted to it. Measured with a 1500 px screen: the box 221 px high and the images 138 px, from a 1500 px window down to 700 px; on a phone, where the head takes two lines, 114 px.
- **Crop and intensity.** The card goes to one column as soon as a field's name would be cut. With these files that is at 1250 px; at 1260 it is three columns, and back again on widening.

**v449**: the SEM figure composer reworked, and the plots' one aligned with it.
- **Both composers.** Titled *Figure composer*, with no strapline and the cross at the top right. A setting that means nothing while another is off stays in place, disabled: in the plots' composer the plot's width, height and alignment (Auto margins), the data labels' settings, and the legend frame's.
- **SEM page.** Width and height free; auto margins, the plot (the smallest rectangle round the images) settable when they are off (§5.1).
- **Layout.** Blocks before panels. *Restore* replaces *As the file list*, beside the Images title.
- **Names.** Placed automatically by row (or column), horizontal or vertical, the alignment along them free; by hand, inside or outside and both alignments (§5.2).
- **Letters and bars.** Eight places each; *One bar per image* at common scale; no magnification over the lengths.
- **Type.** The outline's colour is chosen too.
- **Colour picker** (every one in the app). It stays beside its swatch as a panel scrolls, level with the swatch's bottom where its top would run off the window; it no longer stays pinned to the window's foot.
- **Older figures.** Read anew: corners and sides as the new positions; a height that followed the layout becomes the images' natural height.

**v450**:
- **Plot limits.** In both composers the plot's width and height can be no larger than the figure's.
- **Refused values.** In both composers a refused value shakes red and goes back. The plots' composer used to clamp it quietly. The SEM one shook a field it had just replaced, so the shake was never seen.
- **Alignment.** The SEM plot's alignment uses the plots' composer's picker.
- **Names.** Placed automatically within each block. Two blocks of 2 × 2 put each block's first row above and its second below.
- **Colour picker.** It stays open while the controls scroll, following its swatch, as in the plots' composer. v449 had it close when the swatch scrolled out of view.

**v451**:
- **Unsaved changes** (every module). A project is marked unsaved only while it differs from what was saved, its name included. A value changed and set back, an edit undone, or a name changed and restored leaves it saved. Checked in XRD: smoothing 10 → 50 marked it, back to 10 cleared it; undo cleared it and redo marked it.
- **Plot and page.** With auto margins off they are independent in both composers, and the plot may run off the page. This replaces v450's limit. In the plots' composer a 250 mm plot on a 160 mm page ran off it, and the page set to 120 mm left the plot at 250 mm.
- **The SEM plot's sides.** Setting one shows the other: width 100 → 100 × 100, then height 150 → 150 × 150.

**v452**: the colour pickers in every figure composer.
- **Hitbox.** Only the swatch opens one. Its row was a label, so a click anywhere along it opened the picker; it is no longer.
- **States.** The swatch keeps its hover border while its picker is open. A second click on it, or a click elsewhere, closes it.
- **Placing.** It stands centred on its swatch where it can, never nearer than 5 px (25 until v455, 15 until v458, 2 in v458) to the composer's head (the title) or foot (the buttons). While the controls scroll it follows the swatch, centred, and past that range it stays 5 px from the head or the foot. The palette picker does the same.
- **Checked.** A series' swatch: centred at first, then 25 px from the foot or the head as it scrolled past. The ink swatches, low in the panel: 25 px over the foot. A click 80 px right of a swatch opened nothing.

**v453**:
- **Names.** In the SEM composer, blocks are called *panels* and panels *images*.
- **The Images list.** Grouped by panel, rows dragged between panels: moved where there is room, swapped where the panel is full. Checked with 2 × 1 panels of 2 × 2 images and five images: 5kx dragged into panel 2 (1/4) moved there and left an empty place. Once panel 2 was full, 5kD dropped on its first image swapped with 5kB. Within a panel, a row went to the gap.
- **Hint gone.** The *fill one block after another* hint is removed.
- **Shared axis titles and the global legend** (plots' composer). They sat in the page's margins even when the plot was set by hand, so they stayed while the plot moved off the page. They now take their margins from the plot, as the tick numbers always did. A 250 × 160 mm plot on a 160 × 110 mm page took its Y title to x = −187 px, off the page with it.

**v454**: the composers' colour picker moves.
- **The wheel.** Open, the picker stands over the controls it was opened from, so a wheel over it scrolled nothing and it never moved. A wheel over the colour or palette picker now scrolls the panel its swatch is in, and the picker follows.
- **Scroll room.** The controls end with room for their last settings to reach the panel's middle. The ink swatches at the foot can then be brought into the range where the picker stays centred on them.
- **Checked** on the SEM composer's ink swatch under the wheel: centred on it (471/471, then 393/393) where it could, else 25 px from the foot (579).

**v455**: the colour picker opens centred.
- **Margin.** It is now 15 px from the composer's head and foot.
- **Opening.** A swatch low in the panel (the usual case: the ink at the foot) opened its picker pinned to the foot. Opening now first scrolls the panel, as far as it goes, to bring the swatch where the picker can stand centred on it.
- **Checked** at 1500 × 950 and 1366 × 768, SEM ink and a series of the plots' composer. It opened centred on the swatch (471/471; 380/380). Under the wheel it followed it, then held 15 px from the foot or the head.

**v456**: the colour picker under the wheel.
- **Opening.** It now opens in the middle of the range where it can follow its swatch, rather than at the range's end. At the end, the first turn of the wheel one way pinned it at once.
- **Line-mode wheels.** Firefox's mouse wheel counts in lines (3 a notch); forwarded over the popup, it scrolled 3 px. It now scrolls as the browser would, 16 px a line.
- **The limit.** The picker is 538 px tall. The range where it can stand centred is the composer's body less 2 × 15 px less that height: 196 px of travel at a 1500 × 950 window, 54 px at 1366 × 768. Past it, it holds 15 px from the head or the foot, as asked.

**v457**: the picker in two columns in the composers.
- **Why it still did not move.** It is 538 px tall stacked, while a laptop's composer body is 474–614 px (windows 1280 × 620 to 1440 × 760). The range where it could follow its swatch was 46 px, 16 px, or nothing at all.
- **The fix.** In a figure composer, the map, hue and hex now sit on the left and the RGB and HSL sliders, presets and recent colours on the right. The picker is 486 × 303 px. Elsewhere it is as before, one column, 252 × 538.
- **Follow range.** 141 px at 1280 × 620, 171 at 1366 × 650, 251 at 1536 × 730, 481 at 1920 × 960.
- **Checked** under the wheel at 1366 × 650 and 1536 × 730: it followed the swatch centred (261/261, 333/333, 393/393…), then held 15 px from the head or the foot.

**v458**: the picker back in one column, as asked, with its margin from the head and foot at 2 px.
- **Follow range.** The picker is 524 px tall ("none yet" under the recent colours no longer wraps). With 2 px margins the range where it can follow its swatch centred is the body less 528 px: 286 px at a 1920 × 960 window, 86 at 1440 × 760, 56 at 1536 × 730.
- **Small windows.** Where the body is shorter than the picker (1366 × 650, 1280 × 620), it stands 2 px under the head and does not move.

**v459**: the picker's margin from the composer's head and foot set to 5 px. Its follow range is the body less 534 px: 280 px at 1920 × 960, 80 at 1440 × 760, 50 at 1536 × 730.
