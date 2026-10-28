# IG preview

IG preview puts your file inside a mock of an Instagram screen at real phone size, so you can check crops and UI overlap before posting. Switch it from the **IG preview** card on the desktop or the **IG** row in the phone's tap bar (tap the screen). The desktop shows the same view in a 390×844 phone frame.

> The mock follows Instagram's layout and crop rules but is drawn with generic icons and placeholder text. It isn't affiliated with Instagram and isn't a pixel copy. Instagram changes its layout from time to time; the numbers below were current as of October 2026.

## Rules used

| Surface | Rule in phone-ref | Notes |
|---|---|---|
| Feed photo | Aspect clamped to **1.91:1 … 3:4**, center-cropped outside that | 3:4 uploads have been allowed since mid-2025. Before that the tallest was 4:5. |
| Profile grid | Every tile **3:4**, center-cropped | Since early 2025. A 9:16 reel cover loses 240 px top and bottom of 1920. |
| Reel | **9:16** frame; non-9:16 files show with bars | Safe area: **14% top, 35% bottom, 6% each side**, plus the button column (right ~230 px, up to ~770 px from the bottom of a 1080×1920 frame). |
| Story | **9:16** card | Safe area: top and bottom **250 px** of 1920 (≈13%). |

The tap bar tells you what happens to your file, e.g. *"Feed post 3:4 · trims 25% top + bottom"* or *"Grid tile 3:4 · trims 6% from the sides"*.

## Options

- **Handle:** type it in the desktop card and it appears on every mock.
- **Safe zones:** shades the areas Instagram's UI covers in Reel and Story modes, with a dashed line around the safe area.
- **Grid** fills the other tiles with the current session, newest first, so you can judge a set as a whole.

## Sources

- [Instagram Post Size 2026 — inro.social](https://www.inro.social/blog/instagram-post-size)
- [Instagram now supports 3:4 photos — Business Today](https://www.businesstoday.in/amp/technology/news/story/no-need-to-crop-your-photos-as-instagram-now-supports-34-aspect-ratio-for-photos-478651-2025-06-02)
- [Instagram Reel size and safe zones — Hopper HQ](https://www.hopperhq.com/blog/instagram-reel-size/)
- [Instagram Story size — inro.social](https://www.inro.social/blog/instagram-story-size)
- [Instagram's new grid layout — Kapwing](https://www.kapwing.com/resources/instagrams-new-grid-layout-size-and-dimensions-2025/)
