# How it works

phone-ref is one zero-dependency server (Node 18+ or Bun) plus two web pages. It builds into a single file, `dist/phone-ref.mjs`, or a standalone binary.

```
src/
  server.mjs   HTTP server, sessions, folder watch, QR code, SSE
  drop.html    desktop page: drop well, zoom toolbar, filmstrip, IG controls, phone-frame preview
  view.html    phone page: zoomable viewer, tap bar, filmstrip, swipe, IG mocks
  panzoom.js   shared zoom/pan engine (wheel, drag, pinch, double-tap, swipe)
vendor/
  qrcode-generator.min.js   QR Code Generator for JavaScript (MIT)
build.mjs      inlines the pages, engine and QR lib into dist/phone-ref.mjs
```

## Flow

1. The server listens on `0.0.0.0:7878`, prints a QR code for your LAN address, and opens the drop page.
2. `/` serves the **drop page** to the computer itself and the **viewer** to everyone else.
3. Dropping a file `PUT`s it to `/push`, where it's saved into the current session folder. Watched-folder files are linked in place, not copied.
4. Every change is broadcast over **Server-Sent Events** (`/events`) to every open page. The phone swaps in the new media immediately.
5. Media is served from `/media/<session>/<id>/<name>` with **HTTP range requests**, which iPhone Safari requires for video.
6. Thumbnails are made by the desktop browser (canvas → JPEG) and stored with the session, so the phone filmstrip stays light.

## Zoom engine

`panzoom.js` resizes the media element rather than CSS-scaling it, so it stays sharp at any zoom. It uses pointer events for mouse, trackpad and touch. It never calls `preventDefault` on a touch start, which keeps iPhone's long-press **Save to Photos** menu working. **Phone follows** sends the desktop's framing (zoom relative to Fit, plus the center point) to the phone as an SSE `view` event.

## Sessions

Each session is a folder under `~/phone-ref/sessions/<timestamp>/` (change it with `--data`):

```
session.json        name, items, current item
001-render.png      copies of dropped files
thumbs/1.jpg        thumbnails
```

The last session reopens on start.

## Security model

- Requests from the computer running phone-ref (loopback or its own interface addresses) can push files, manage sessions, remove items and set watch folders.
- Everyone else on the network can only **view**, **select** an existing item, and switch **IG preview** mode.
- Behind a local HTTPS proxy (e.g. `tailscale serve`), the original client is judged by `X-Forwarded-For`.
- No auth, no cloud, no telemetry. On shared Wi-Fi, stop phone-ref when you're done.

## Endpoints

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/` `/view` | anyone | drop page (local) / viewer |
| GET | `/events?role=phone\|embed` | anyone | live state (SSE) |
| GET | `/media/…` `/thumb/…` | anyone | media (range) and thumbnails |
| POST | `/select` `/ig` | anyone | show an item; IG mode and zones |
| PUT | `/push` | local | upload a file |
| POST | `/push-url` | local | fetch a link or `file://` path |
| PUT | `/thumb/…` | local | store a thumbnail |
| POST | `/remove` `/clear` `/watch` `/view-state` | local | edit history, folder watch, Phone follows |
| GET/POST | `/sessions` `/session/new\|open\|rename` `/open-folder` | local | sessions |

## Building

```bash
npm run build        # dist/phone-ref.mjs
npm start            # node dist/phone-ref.mjs
npm run build:win    # dist/phone-ref.exe          (needs Bun)
npm run build:mac    # dist/phone-ref-mac-arm64 + -intel (needs Bun; ad-hoc signed)
```

The Mac binaries aren't notarized, so macOS asks for a one-time approval (see the user guide). `phone-ref.command` picks the right binary and clears the download quarantine flag.
