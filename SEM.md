# SEM module

The SEM module takes Tescan images, reads their metadata, and crops them. Later
versions are planned to normalise their intensity and their scale and to lay them out
into figures. The code is in `sem-read.js` (reading) and `sem.js` (the module).

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

Until the intensity settings come, an image is shown with black and white at the
0.5 and 99.5 percentiles of its own pixels, the bar left out.

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

## 3. Project and export

### 3.1 How a project stores the images

A project keeps each file's own bytes, as base64, in the module's state.

- **Why not a typed array.** `db.js` `encode()` turns a typed array into a plain array of numbers: eight bytes a value in IndexedDB, and a decimal each in a `.json`.
- **The undo stack.** It compares snapshots with `JSON.stringify` on every edit. The bytes' holder serialises in JSON as its id alone, so a snapshot compares at the cost of its crops: 2 ms an edit with two images.
- **Saved projects and `.json` files.** These keep the bytes. A project with the user's two images exports as a 6.5 MB `.json`.
- **The id.** It is a hash of the bytes. A second copy of a file already loaded, whatever its name, is reported as already loaded.
- **Restoring.** Opened again, a project's images are read again from their bytes. One that no longer reads is left out, with a note.

### 3.2 CSV

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

## Changelog

**v436**: the module. Tescan TIFFs are read with their metadata, with the info bar left
out by `ImageStripSize`, and cropped.
