// ==========================================
// 2. ROTATED CAMPUS OVERLAY
// ==========================================
//
// L.ImageOverlay stretches an image between two latlngs, which can only ever
// produce a north-aligned rectangle. The campus drawing may sit at an angle to
// true north, so this subclass positions the image by its centre and applies
// the bearing as a CSS rotation instead. Scale stays uniform, so the artwork is
// never sheared.

const GeoImageOverlay = L.ImageOverlay.extend({
  initialize: function (url, options) {
    this._url = url;
    L.setOptions(this, L.extend({ lowResWidth: 640 }, options));

    const w = this.options.canvasWidth;
    const h = this.options.canvasHeight;

    this._bearing = this.options.bearingDeg || 0;
    this._centre = L.latLng(svgToLatLng([w / 2, h / 2]));
    this._bounds = L.latLngBounds(canvasCornersLatLng(w, h).map(c => L.latLng(c)));

    // Mid-edge pairs: the pixel distance between each pair is the on-screen
    // width and height of the image, and taking vector lengths keeps that
    // correct at any bearing.
    this._spanX = [L.latLng(svgToLatLng([0, h / 2])), L.latLng(svgToLatLng([w, h / 2]))];
    this._spanY = [L.latLng(svgToLatLng([w / 2, 0])), L.latLng(svgToLatLng([w / 2, h]))];
  },

  _pixelSize: function (zoom) {
    const map = this._map;
    const z = zoom === undefined ? map.getZoom() : zoom;
    const a = map.project(this._spanX[0], z);
    const b = map.project(this._spanX[1], z);
    const c = map.project(this._spanY[0], z);
    const d = map.project(this._spanY[1], z);
    return {
      x: Math.hypot(b.x - a.x, b.y - a.y),
      y: Math.hypot(d.x - c.x, d.y - c.y)
    };
  },

  // transform-origin sits at the centre, so rotate and scale both pivot there
  // and the translate only has to place the top-left corner.
  _pose: function (x, y, scale) {
    const img = this._image;
    img.style.transformOrigin = '50% 50%';
    img.style.transform =
      'translate3d(' + x + 'px,' + y + 'px,0)' +
      (scale !== 1 ? ' scale(' + scale + ')' : '') +
      (this._bearing ? ' rotate(' + this._bearing + 'deg)' : '');
  },

  // Place the image so it covers `target` (its true on-screen size) while laid
  // out at this._size: the difference is made up by scale, which only moves an
  // already painted picture and never makes the browser redraw the SVG.
  _place: function (p, target) {
    this._pose(p.x - this._size.x / 2, p.y - this._size.y / 2, target.x / this._size.x);
  },

  // A flyTo moves the zoom a little every frame. Resizing the image each time
  // makes the browser redraw the whole SVG each time, which a Raspberry Pi
  // cannot do at frame rate. So mid-flight the drawing keeps the size it was
  // last painted at and is only scaled; it is resized - painted sharp again -
  // once, when the zoom settles.
  getEvents: function () {
    const events = { zoom: this._onZoom, viewreset: this._reset, zoomend: this._reset };
    if (this._zoomAnimated) events.zoomanim = this._animateZoom;
    return events;
  },

  _onZoom: function () {
    if (!this._size) { this._reset(); return; }
    this._place(this._map.latLngToLayerPoint(this._centre), this._pixelSize());
  },

  // A faint floor under the one being viewed does not need to be sharp. Low
  // resolution paints it once, small, and from then on only scales it - the
  // two floors not on view cost next to nothing however the map zooms.
  setLowRes: function (on) {
    if (this._lowRes === !!on) return this;
    this._lowRes = !!on;
    if (this._map) this._reset();
    return this;
  },

  _reset: function () {
    const size = this._pixelSize();
    const laidOut = this._lowRes
      ? { x: this.options.lowResWidth, y: this.options.lowResWidth * size.y / size.x }
      : size;
    if (!this._size || this._size.x !== laidOut.x || this._size.y !== laidOut.y) {
      this._image.style.width = laidOut.x + 'px';
      this._image.style.height = laidOut.y + 'px';
      this._size = laidOut;
    }
    this._place(this._map.latLngToLayerPoint(this._centre), size);
  },

  _animateZoom: function (e) {
    const map = this._map;
    if (!this._size) this._reset();
    const p = map._latLngToNewLayerPoint(this._centre, e.zoom, e.center);
    this._place(p, this._pixelSize(e.zoom));
  }
});
