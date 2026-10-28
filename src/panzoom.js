// Shared zoom/pan engine for both pages. Mouse wheel / trackpad pinch zooms at the cursor,
// drag pans, double-click or double-tap toggles Fit <-> close-up, two fingers pinch and pan,
// a quick sideways swipe (when not zoomed in) calls onSwipe(+1 | -1).
// The media is resized (not CSS-scaled) so it stays sharp at any zoom, and nothing here calls
// preventDefault on a touch start, so iPhone's long-press "Save to Photos" menu still works.
function PanZoom(stage) {
  var api = { onTap: null, onChange: null, onSwipe: null, mode: 'fit' };
  var el = null, w = 0, h = 0, s = 1, tx = 0, ty = 0, sw = 0, sh = 0;
  var pts = new Map(), last = null, multi = false, downT = 0, sx = 0, sy = 0, moved = 0, tapT = 0, tapX = 0, tapY = 0, tapTimer = null;
  function oneS() { return 1 / (window.devicePixelRatio || 1); }
  function fitS() { return Math.min(sw / w, sh / h); }
  function fillS() { return Math.max(sw / w, sh / h); }
  function lim(v) { return Math.max(Math.min(fitS(), oneS()) * 0.5, Math.min(Math.max(oneS() * 32, fitS() * 4), v)); }
  function measure() { sw = stage.clientWidth; sh = stage.clientHeight; }
  function clamp() {
    var cw = w * s, ch = h * s;
    tx = cw <= sw ? (sw - cw) / 2 : Math.min(0, Math.max(sw - cw, tx));
    ty = ch <= sh ? (sh - ch) / 2 : Math.min(0, Math.max(sh - ch, ty));
  }
  function apply(silent) {
    if (!el || !w) return;
    clamp();
    el.style.width = w * s + 'px';
    el.style.height = h * s + 'px';
    el.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
    el.style.imageRendering = s / oneS() >= 4 ? 'pixelated' : '';
    if (!silent && api.onChange) api.onChange(api.info());
  }
  function zoomAt(ns, px, py) {
    ns = lim(ns);
    tx = px - (px - tx) * ns / s; ty = py - (py - ty) * ns / s; s = ns; api.mode = 'free'; apply();
  }
  api.load = function (node, nw, nh, mode) {
    el = node; w = nw; h = nh; measure();
    var st = el.style;
    st.cssText = '';
    st.position = 'absolute'; st.left = '0'; st.top = '0'; st.maxWidth = 'none'; st.maxHeight = 'none'; st.transformOrigin = '0 0';
    api.set(mode || 'fit');
  };
  api.clear = function () { el = null; w = h = 0; };
  api.ready = function () { return !!(el && w); };
  api.set = function (m) {
    api.mode = m;
    if (!el || !w) return;
    measure();
    if (!sw || !sh) return;
    s = m === 'fill' ? fillS() : m === 'one' ? oneS() : fitS();
    tx = (sw - w * s) / 2; ty = (sh - h * s) / 2; apply();
  };
  api.zoomBy = function (k) { if (el && w) { measure(); zoomAt(s * k, sw / 2, sh / 2); } };
  api.info = function () {
    return { pct: w ? Math.round(s / oneS() * 100) : 0, mode: api.mode, w: w, h: h,
      z: w ? s / fitS() : 1, cx: w ? (sw / 2 - tx) / (w * s) : 0.5, cy: w ? (sh / 2 - ty) / (h * s) : 0.5 };
  };
  api.view = function (z, cx, cy) {            // copy another screen's framing (relative to Fit)
    if (!el || !w) return;
    measure();
    s = lim(z * fitS()); tx = sw / 2 - cx * w * s; ty = sh / 2 - cy * h * s;
    api.mode = Math.abs(z - 1) < 0.01 ? 'fit' : 'free'; apply(true);
    if (api.onChange) api.onChange(api.info(), true);
  };
  function g() {
    var n = 0, x = 0, y = 0, a = [];
    pts.forEach(function (p) { n++; x += p.x; y += p.y; a.push(p); });
    if (n) { x /= n; y /= n; }
    return { n: n, x: x, y: y, d: n >= 2 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0 };
  }
  stage.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'mouse') { try { stage.setPointerCapture(e.pointerId); } catch (x) {} stage.classList.add('grabbing'); }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { multi = false; downT = Date.now(); sx = e.clientX; sy = e.clientY; moved = 0; } else multi = true;
    last = g();
  });
  stage.addEventListener('pointermove', function (e) {
    var p = pts.get(e.pointerId); if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) moved = Math.max(moved, Math.hypot(e.clientX - sx, e.clientY - sy));
    var c = g();
    if (el && w && last && c.n === last.n) {
      var r = stage.getBoundingClientRect(), lx = last.x - r.left, ly = last.y - r.top;
      if (c.n >= 2 && last.d > 0) {
        var ns = lim(s * c.d / last.d);
        tx = lx - (lx - tx) * ns / s + (c.x - last.x); ty = ly - (ly - ty) * ns / s + (c.y - last.y);
        s = ns; api.mode = 'free'; apply();
      } else if (moved > 3) {
        tx += c.x - last.x; ty += c.y - last.y;
        if (api.mode !== 'fit') api.mode = 'free';
        apply();
      }
    }
    last = c;
  });
  function up(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId); last = g();
    if (!pts.size) stage.classList.remove('grabbing');
    if (e.type !== 'pointerup' || pts.size || multi) return;
    var dx = e.clientX - sx, dy = e.clientY - sy, dt = Date.now() - downT;
    // sideways flick while the picture isn't wider than the screen -> next / previous
    if (api.onSwipe && dt < 700 && Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy) && (!el || !w || w * s <= sw + 1)) {
      api.onSwipe(dx < 0 ? 1 : -1);
      return;
    }
    if (moved > 10 || dt > 350) return;
    var now = Date.now();
    if (now - tapT < 320 && Math.hypot(e.clientX - tapX, e.clientY - tapY) < 40) {
      clearTimeout(tapTimer); tapT = 0;
      if (!el || !w) return;
      var r = stage.getBoundingClientRect();
      if (api.mode === 'fit' || s <= fitS() * 1.02) zoomAt(Math.max(oneS(), fitS() * 2.5), e.clientX - r.left, e.clientY - r.top);
      else api.set('fit');
    } else {
      tapT = now; tapX = e.clientX; tapY = e.clientY;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(function () { if (api.onTap) api.onTap(); }, 300);
    }
  }
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', function (e) {
    if (!el || !w) return;
    e.preventDefault();
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    var r = stage.getBoundingClientRect();
    zoomAt(s * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  if (window.ResizeObserver) new ResizeObserver(function () {
    if (!el || !w) return;
    var ow = sw, oh = sh; measure();
    if (!sw || !sh) return;
    if (api.mode === 'free' && ow && oh) { tx += (sw - ow) / 2; ty += (sh - oh) / 2; apply(); } else api.set(api.mode);
  }).observe(stage);
  ['gesturestart', 'gesturechange'].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false }); });
  return api;
}
