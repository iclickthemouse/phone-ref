# Use cases

phone-ref answers one question fast: **what does this look like on a phone?** Here's how it fits into real work.

## 1. Generative image and video work (ComfyUI and friends)

**Setup:** paste your output folder into **Auto-show new files** (e.g. `…\pinokio\api\comfy.git\app\output` or `~/ComfyUI/output`) and click Watch. Prop the phone up next to your keyboard.

**Flow:**
1. Queue a batch.
2. Each image or video shows on the phone once it's fully written. phone-ref waits for files to stop growing, and skips the preview PNG saved next to a video.
3. Everything lands in the session filmstrip, so you can swipe back through the whole batch on the phone.
4. Found a keeper? Double-tap to zoom in and check hands, text and edges at real phone resolution, then long-press → Save to Photos if you want it.

**Why it helps:** you catch phone-scale problems (mushy detail, illegible text, an over-busy composition) before spending time on upscales or edits.

## 2. "Does it look the same?" reference checks

Hold the phone next to the real thing: a print, a product, a set, a paint swatch, another screen.

- **Fit** shows the whole frame. **1:1** shows one image pixel per phone pixel, the file's true sharpness.
- For color, turn off True Tone and Night Shift on the phone. Safari honors embedded color profiles (sRGB, Display P3).

## 3. Social content QA before you post

Turn on **IG preview** from the desktop sidebar or the phone's tap bar.

| Question | Mode | What you'll see |
|---|---|---|
| Will my 9:16 poster work as a feed post? | Feed | It gets cropped to 3:4, losing 25% top and bottom. |
| Does the caption cover my subject? | Reel + Safe zones | The bottom 35% and the button column are shaded. |
| Is my Story text under the header? | Story + Safe zones | The top and bottom 250 px are marked. |
| Does this set look good together? | Grid | Your post as a 3:4 tile, with the rest of the session filling the grid. |

## 4. Client and team reviews

1. Click the session name and rename it ("Acme — round 2").
2. Drop the options in. They form the filmstrip.
3. Hand someone the phone. They swipe through at real size while you watch the same item on your screen.
4. Turn on **Phone follows** and zoom on the desktop to point at a detail. The phone zooms with you.
5. Next week, open **Sessions ▾** and reopen it exactly as you left it.

## 5. UI, type and layout checks

Drop app screens, landing-page comps or slides. Check type size, tap-target size and contrast at real size on a real device. A desktop simulator can't show you how it feels in the hand.

## 6. Video exports

Drop an MP4/MOV to check pacing, burned-in captions and framing on the phone. It streams, loops, and plays sound with a tap. Use H.264 or HEVC; ProRes and MKV usually won't play in iPhone Safari.
