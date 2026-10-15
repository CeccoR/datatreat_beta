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
- **Crop and intensity**, in two halves:
  - on top, on the left, the image in its editor with the histogram of its crop under it; on the right, the images' thumbnails in a box (each with its chain, §2.3) over the image's details. The two halves are as tall as each other: the left one sets the height, and the thumbnails scroll in theirs;
  - under them, the crop's fields (§2) on the left and the intensity's (§3) on the right;
  - on a phone, one column.

The groups come first: an image's crop is then set knowing its group, whose common scale may narrow it (dashed in the editor, §4.2).

The code is in three files: `sem-read.js` (reading), `sem.js` (the module) and
`sem-figure.js` (the figure).

## 1. Files

### 1.1 What is taken

Only the files the Tescan software (Essence) saves are taken: a grey TIFF, 8 or
16 bits a pixel, uncompressed, in strips, carrying Tescan's own tag 50431. Everything
else is refused, each file with its reason in the list under the drop zone:

- not a TIFF, or a BigTIFF;
- a TIFF without the Tescan tag;
- a compressed, colour, tiled, signed or floating-point TIFF;
- a damaged one (its pixels run past the end of the file, or fall short of its size).

A `.hdr` dropped beside its `.tif` is skipped without a message: it holds the same
text as the tag.

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
- `PixelSizeX` and `PixelSizeY` (m);
- `Magnification`;
- `ImageStripSize`, the info bar's height in rows;
- `Sign`, the sample's name. The file's `OrigFileName`, then its name, stand in when it is missing.
- `Device`, `Date`, `Time`.

**From `[SEM]`:**
- `HV` (V);
- `WD` (m);
- `Detector`;
- `Detector0Gain` and `Detector0Offset`.

The field of view is `PixelSizeX` × the width. On the user's two files (VEGA, 1024 px
wide) it gives 55.84 µm at 5 kx and 13.96 µm at 20 kx, the values printed in their
info bars.

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

## 2. Crop

### 2.1 The rectangle

The crop is a rectangle in the original's pixels:

- whole pixels;
- inside the image, never in the bar;
- at least 64 px a side (an image smaller than that is taken whole).

The image itself is never changed. **Default** is the whole image, with the bar left
out.

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
- **The fields.** X, Y, width and height in pixels, with the crop's size in µm beside them. A value that would run past the image's edge brings the crop back inside it.
- **The ratio.** 1:1, 4:3, 3:2 or free, applied as width:height. An image starts at the ratio of its default crop (1:1 on the user's files), or free.
  - A locked ratio holds while resizing. A corner scales both sides by the mean of the pointer's two moves; a side sets the other dimension about its middle.
  - A typed side sets the other side.
  - A new ratio keeps the crop's width and middle where it can, else its height.

### 2.3 Several images

- **Copy to…** gives the chosen images the current crop: the same rectangle in pixels, with its ratio.
- **Linked** images share one crop: setting it on one sets it on all. The chain on a thumbnail links its image, or unlinks it (lit when linked). An image newly linked takes the crop the linked ones share; the first one linked keeps its own.

A crop larger than an image allows is narrowed to fit it (its ratio kept). The image is
then marked (⚠ on its thumbnail, a note under its crop) until its crop is set again.

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

A reference meant only for this is loaded with the others and ticked *Reference only*:
it is used to normalise the others and kept out of the figure. Its thumbnail carries ◎.

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

### 3.5 Settings for all groups, or for one

The settings (normalisation, its percentiles, the reference, contrast, brightness and
gamma) are those of **all groups** unless a group has its own.
- **Settings for** chooses what the fields set: all groups, or one group.
- A group chosen follows all groups' settings, its fields showing them disabled, until *Its own settings* is ticked. It then starts from all groups' settings, and its own are changed apart from them.
- Unticked, the group follows all groups' settings again.
- *Defaults* puts back the defaults of the settings chosen.
- A group with its own settings is marked *(own settings)* in the selector, and the note under the histogram names it.
- An image that is the reference of any settings in use, ticked *Reference only*, is kept out of the figure.

Each image's own correction (*This image, on top*) goes on top of its group's settings
either way.

**Checked** on the user's two images and two copies:
- The 20 kx group was given its own settings, with brightness +20. Its thumbnails' mean grey went from 93 to 142; the 5 kx group's stayed at 47.
- All groups' brightness was then set to −10. The 5 kx thumbnails went to 35, while the 20 kx ones kept 142.
- The CSV's `intensity_settings` read *group* for the 20 kx images and *all groups* for the others.
- Undone, the settings went back.

## 4. Groups and scale

### 4.1 Grouping

The images in the figure are grouped by pixel size: those that are included, and not a
reference kept out of the figure.

**The rule.** Two images are in one group when every pixel size in it lies within 10 %
of the others (largest/smallest ≤ 1.10). A newly loaded image joins the first group it
fits, else starts its own.

**The name.** A group is named by the magnification of its image with the largest
pixel size, the one its common scale brings the others to.
- The name reads as plain text. Like the project's name, its field shows on hover and while it is edited.
- A name typed there stays; emptied, it goes back to the magnification.

**The box.** Each group is a box 4φ wide to 1 high (6.47 : 1). On the left are its name,
its scale under it and its *Figure composer*. On the right are its images, 112 px, each
with its name under it, in one row that scrolls sideways when they do not fit. On a
phone the name, scale and button sit over the images, and the box grows to hold them.

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
figure, with its own settings; the figure is titled with the group's name, and its file
is named after it (`SEM_5.00_kx`) until named otherwise.

The images are laid out as the figure composer (`figure.js`) lays out plots, with the
same modal and controls:
- one page in millimetres, previewed as it will be exported, which the wheel zooms and a drag pans;
- the composer's fonts (Inter embedded in the files);
- export as SVG (with the images in it) or as PNG at the chosen dpi, or a PNG copied to the clipboard.

There are no axes and no legend.

### 5.2 Panels

**Which images.** Each image of the group in the figure is one panel: those that are
included, and not a reference kept out of the figure. It enters as its group made it
(§4) and through its curve (§3). The preview uses a copy reduced to 520 px; the export
uses the full one.

**The grid.** It has two levels: **blocks** of **panels**. The images fill one block
after another, each row by row; 2 × 1 blocks of 2 × 2 panels hold eight images, the
first four in the left block.
- **Automatic** (the default): one block, the most compact rectangle: ⌈√N⌉ columns and ⌈N/columns⌉ rows (12 images give 4 × 3, not 6 × 2). Its fields show what was chosen, locked; unticked, they start from it.
- **By hand**: the panels' rows and columns in a block, and the blocks' rows and columns. Rows of blocks are added when too few places are given.
- **The gaps**: one between the panels in a block (1 mm by default), one between the blocks (4 mm).
- The columns are equal.
- An image row is as tall as its tallest image at that width, across its row of blocks.
- The height follows from the layout unless set by hand. A set height narrows the images to fit (never widens them), with the grid centred.

**Order.** It starts as the file list's. In the *Images* list, a row dragged by its
handle goes to the gap that lights, and the panels follow, as the plots' series are
reordered in the composer. *As the file list* puts the order back. The row's field is
the name shown on the panel.

**Names.** Each panel carries its sample's name, editable per panel:
- in a corner of the image (top left by default), white with a dark outline by default, which reads on any grey; the colour and the outline can be changed;
- or outside it: above, below, left or right. Outside, the name is in black on a white page (white on a black one), along the image at the sides, reading upward on the left and downward on the right.

**Letters.** (a), (b)… in the panels' order, off by default, in the styles a, (a), A
and (A).
- They are placed apart from the name: in a corner, where a name sharing the corner moves one line in, or above the image, on one line with a name above.
- Or they are placed before the name.

**Room outside.** What is placed outside an image takes a band beside it, the same
for every panel so that the grid stays aligned: next to the image the scale bar's band,
outside it the name's. The images narrow to leave room for the bands at the sides.

### 5.3 Scale bars

- **Which panels.** A group at common scale has one bar, in its last panel in the figure's order. A group at its own scale has one in every panel.
- **Length.** A round 1, 2 or 5 × 10ⁿ µm nearest (on a log scale) to 22 % of the panel's width, unless typed: any value, as 4.56 µm. It reads in nm under 1 µm.
- **Placing.** In a corner of the image (bottom right by default), or outside it:
  - above or below, flush with the image's right edge, the length above the bar or under it;
  - left or right, upright along the image from its bottom, the length along it.
- **The text** is centred on the bar, or flush with its outer end when wider than a short bar. The thickness is 0.7 mm.
- Outside, the bar and its length are in the page's ink (black on white), with no outline.

### 5.4 Settings

The figure's settings are the module's: they are saved with the project, and undone
and redone with it (Ctrl+Z inside the open figure too).

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

## 6. Project and export

### 6.1 How a project stores the images

A project keeps each file's own bytes, as base64, in the module's state.

- **Why not a typed array.** `db.js` `encode()` turns a typed array into a plain array of numbers: eight bytes a value in IndexedDB, and a decimal each in a `.json`.
- **The undo stack.** It compares snapshots with `JSON.stringify` on every edit. The bytes' holder serialises in JSON as its id alone, so a snapshot compares at the cost of its crops: 2 ms an edit with two images.
- **Saved projects and `.json` files.** These keep the bytes. A project with the user's two images exports as a 6.5 MB `.json`.
- **The id.** It is a hash of the bytes. A second copy of a file already loaded, whatever its name, is reported as already loaded.
- **Restoring.** Opened again, a project's images are read again from their bytes. One that no longer reads is left out, with a note.

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

The group columns are empty for a reference kept out of the figure.

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
