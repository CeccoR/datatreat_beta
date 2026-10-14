# SEM module

The SEM module takes Tescan images, reads their metadata, crops them, sets their grey
levels, and groups them by scale. A later version is planned to lay them out into
figures. The code is in `sem-read.js` (reading) and `sem.js` (the module).

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

Every view of an image (the crop editor, the thumbnails, the intensity preview) shows
it through its curve (§3).

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
  - Drag outside it to pan.
  - The wheel zooms about the pointer (it never scrolls the page under it). The −, Fit and + buttons zoom about the crop's middle.
  - A double click outside the crop fits the image again.
  - Shrunk, the image is drawn smoothed; enlarged past 2×, its pixels stay sharp.
- **The fields.** X, Y, width and height in pixels, with the crop's size in µm beside them. A value that would run past the image's edge brings the crop back inside it.
- **The ratio.** 1:1, 4:3, 3:2 or free, applied as width:height. An image starts at the ratio of its default crop (1:1 on the user's files), or free.
  - A locked ratio holds while resizing. A corner scales both sides by the mean of the pointer's two moves; a side sets the other dimension about its middle.
  - A typed side sets the other side.
  - A new ratio keeps the crop's width and middle where it can, else its height.

### 2.3 Several images

- **Copy to…** gives the chosen images the current crop: the same rectangle in pixels, with its ratio.
- **Linked** images share one crop: setting it on one sets it on all. An image newly linked takes the crop the linked ones share; the first one linked keeps its own.

A crop larger than an image allows is narrowed to fit it (its ratio kept). The image is
then marked (⚠ on its thumbnail, a note under its crop) until its crop is set again.

## 3. Intensity

### 3.1 The curve

Each image's grey levels go through one curve: a table of its 65536 levels, built in
two stages.

1. **The normalisation**, one for all images:
   - **none**: the levels as acquired, with 0 black and 65535 white;
   - **percentile stretch** (the default): black and white at two percentiles of the image's own levels, 0.5 and 99.5 % unless set otherwise;
   - **mean and SD of the reference**: v → μ_ref + (v − μ)·σ_ref/σ, on the reference's levels;
   - **histogram of the reference**: a level at a given share of the image's pixels goes to the reference's level at the same share.
2. **Contrast, brightness and gamma.**
   - Contrast scales the levels about mid-grey.
   - Brightness then adds a share of the full scale.
   - Gamma bends the mid-tones (y → y^(1/γ), so above 1 they brighten).

   Each has a value for all images, and each image has its own correction on top: brightness is added, contrast and gamma are multiplied.

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

## 4. Groups and scale

### 4.1 Grouping

The images in the figure are grouped by pixel size: those that are included, and not a
reference kept out of the figure.

**The rule.** Two images are in one group when every pixel size in it lies within 10 %
of the others (largest/smallest ≤ 1.10). A newly loaded image joins the first group it
fits, else starts its own.

**The name.** A group is named by the magnification of its image with the largest
pixel size, the one its common scale brings the others to. A name typed in its field
stays; emptied, it goes back to the magnification.

**Editing.**
- An image is moved to another group, or to a new one, with the menu under it. There can be up to one group per image.
- Empty groups disappear.
- **Regroup** starts again from the pixel sizes.

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

## 5. Project and export

### 5.1 How a project stores the images

A project keeps each file's own bytes, as base64, in the module's state.

- **Why not a typed array.** `db.js` `encode()` turns a typed array into a plain array of numbers: eight bytes a value in IndexedDB, and a decimal each in a `.json`.
- **The undo stack.** It compares snapshots with `JSON.stringify` on every edit. The bytes' holder serialises in JSON as its id alone, so a snapshot compares at the cost of its crops: 2 ms an edit with two images.
- **Saved projects and `.json` files.** These keep the bytes. A project with the user's two images exports as a 6.5 MB `.json`.
- **The id.** It is a hash of the bytes. A second copy of a file already loaded, whatever its name, is reported as already loaded.
- **Restoring.** Opened again, a project's images are read again from their bytes. One that no longer reads is left out, with a note.

### 5.2 CSV

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
