# phone-ref

Drop an image or video on your computer and it shows up on your phone right away. You can zoom in on both screens, keep a history of everything you've sent, and preview how a file will look on Instagram.

## Start it

**Windows:** double-click `phone-ref.exe` (or `phone-ref.cmd` if you have Node.js 18+).
**Mac:** double-click `phone-ref.command`. The first time on a Mac, see "First time on a Mac" below.

A console window opens (keep it open) and the drop page opens in your browser. To stop it, close the window or press Ctrl+C.

## First time on the phone

1. Scan the QR code on the drop page with the iPhone camera.
2. In Safari, tap **Share → Add to Home Screen**. After that it opens full-screen like an app.
3. The phone has to be on the same Wi-Fi as the computer.

The link uses your computer's local IP address. If your router gives the computer a new IP, the home-screen icon stops working. To prevent that, set a DHCP reservation for the computer in your router.

## First time on Windows

- **SmartScreen** may say "Windows protected your PC" because the .exe isn't signed. Click *More info* → *Run anyway*.
- **Firewall** will ask whether phone-ref may use the network. Tick **Private networks** and allow it, or the phone can't connect.
- Set your network to **Private** (Settings → Network & internet → your network). A "Public" network blocks the phone.

## First time on a Mac

macOS blocks apps downloaded from outside the App Store, so it needs one approval:

- **Quickest:** open Terminal, type `xattr -dr com.apple.quarantine ` (with a space at the end), drag the phone-ref folder into the window, and press Return. Then double-click `phone-ref.command`.
- **Or:** double-click `phone-ref.command`. When macOS says it can't verify it, open **System Settings → Privacy & Security**, scroll down, click **Open Anyway**, and confirm.

The folder includes builds for both Apple Silicon and Intel Macs. The launcher picks the right one. If macOS asks whether phone-ref may accept incoming connections or find devices on your local network, click **Allow**.

## Sending things

- **Drop** a file on the well, **click** the well to pick one, or **paste** with Ctrl+V / ⌘V. Pasting works well for screenshots.
- **Drag an image out of the ComfyUI web page** straight onto the well.
- **Auto-show new files:** paste a folder path in the sidebar and click Watch. Each new file saved in that folder shows on the phone once it's fully written. A preview PNG saved next to a video is skipped. Examples: `…\pinokio\api\comfy.git\app\output` on Windows, `~/ComfyUI/output` on a Mac.

## History and sessions

Everything you send goes into the **filmstrip** under the drop area, and into a filmstrip on the phone (tap the screen to see it).

- **PC:** click a thumbnail to show it on the phone. **←** and **→** step through. Hover a thumbnail and click **×** to remove it.
- **Phone:** tap a thumbnail, or swipe left/right on the picture when you aren't zoomed in.
- **Sessions:** a history belongs to a session. Click the session name to rename it (e.g. "Client X review"). **New session** starts a fresh one, and **Sessions ▾** reopens older ones. phone-ref reopens your last session when it starts.
- **Storage:** sessions are saved in `phone-ref/sessions/` in your home folder (**Folder** opens the current one). Dropped files are copied in. Files from a watched folder stay where they are and are only linked. To save sessions somewhere else, start once with `--data "E:\phone-ref"`; phone-ref remembers it.

## Zoom and pan

- **PC:** scroll to zoom at the cursor, drag to pan, double-click to zoom in or back to fit. The toolbar has − / + / Fit / Fill / 1:1. Keys: `+` `-` zoom, `0` fit, `F` fill, `1` actual pixels.
- **Phone follows:** tick it in the toolbar and the phone copies your computer's zoom and position live.
- **iPhone:** pinch to zoom, drag to pan, double-tap to zoom in or back to fit. Tap once for the bar with history, Fit / Fill / 1:1, Sound and IG.
- **1:1** means one image pixel per screen pixel, so it shows how sharp the file really is. From 400% up, pixels show as hard squares.

## IG preview

Pick **Feed, Reel, Story or Grid**, either in the **IG preview** card on the PC or in the phone's tap bar. The phone shows a full-screen mock of that Instagram screen with your file in it. The PC shows the same thing in a phone-sized frame. Put your handle in the box so it shows on the mock.

The mock follows Instagram's layout and crop rules. It isn't a pixel copy, and it uses generic icons.

- **Feed:** photos display between 1.91:1 (wide) and 3:4 (tall). Anything taller or wider is center-cropped. The bar tells you how much gets trimmed.
- **Grid:** the profile grid shows every post as a 3:4 tile, center-cropped. The other tiles are the rest of this session, so you can see how a set looks together.
- **Reel:** 9:16, with the caption, buttons and tab bar where Instagram puts them. **Safe zones** shows the area Meta recommends keeping clear: about 14% at the top, 35% at the bottom and 6% at each side, plus the button column on the right.
- **Story:** 9:16 card with the header and reply bar. **Safe zones** marks the top and bottom 250 px (of 1920) that the UI covers.

Instagram changes its layout from time to time. These numbers are the published guidance as of October 2026.

## Save to Photos

- **Images:** press and hold the image on the iPhone, then tap **Save to Photos**.
- **Videos:** iPhone only lets a web page save a video through the Share sheet, and only on secure (HTTPS) pages. phone-ref's local link is plain HTTP, so videos can't be saved from it.
- **Optional, with Tailscale:** if you use Tailscale on both devices, run `tailscale serve --bg 7878` on the computer and open its `https://….ts.net` address on the phone. A **Save** button appears that saves images and videos. This also works away from home.

## What works on iPhone

- Images: JPG, PNG, WebP (animated too), GIF, HEIC, AVIF, TIFF.
- Video: MP4/MOV in H.264 or HEVC. In ComfyUI's Video Combine node, use `video/h264-mp4`.
- Likely **won't** play: ProRes, MKV, some WebM. **Won't** show: PSD, EXR, camera RAW. Export first.
- If videos only show "Tap to play", the phone is in Low Power Mode, which blocks autoplay.

## Comparing color

Safari on iPhone is color-managed and honors embedded profiles (sRGB, Display P3). For fair comparisons, turn off True Tone and Night Shift on the phone.

## Privacy

Only the computer running phone-ref can send files, change sessions or delete things. Anyone else on the same Wi-Fi who knows the address could *view* what's showing and browse this session, so stop phone-ref on shared or public networks.

## Options

```
--watch "folder"   auto-show new files from a folder
--data "folder"    where sessions are saved (remembered)
--port 7879        different port (default 7878)
--no-open          don't open the browser
```

On Windows add these after `phone-ref.exe` in a terminal. On a Mac, run `./phone-ref.command --watch ~/ComfyUI/output` from Terminal.

---
Single file, no dependencies. Includes QR Code Generator for JavaScript © 2009 Kazuhiko Arase (MIT).
