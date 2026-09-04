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
    L.setOptions(this, options);

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

  _pixelSize: function () {
    const map = this._map;
    const z = map.getZoom();
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

  _reset: function () {
    const size = this._pixelSize();
    const p = this._map.latLngToLayerPoint(this._centre);
    this._image.style.width = size.x + 'px';
    this._image.style.height = size.y + 'px';
    this._size = size;
    this._pose(p.x - size.x / 2, p.y - size.y / 2, 1);
  },

  _animateZoom: function (e) {
    const map = this._map;
    const scale = map.getZoomScale(e.zoom);
    const p = map._latLngToNewLayerPoint(this._centre, e.zoom, e.center);
    const size = this._size || this._pixelSize();
    this._pose(p.x - size.x / 2, p.y - size.y / 2, scale);
  }
});
