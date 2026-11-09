// What both maps draw over the floor plans, so the kiosk and the phone show
// them alike: the place markers (a dot zoomed out, a pin zoomed in, in the
// place's category colour) and the building and gate names.
//
// Loaded by index.html (app.js sections 8 and 8b) and mobile.html (mobile.js).
// tools/build-web.mjs copies it into the GitHub Pages build.
//
// Both are painted on canvases, not as page elements: on the Raspberry Pi a
// page element per place made every zoom slow, and on the canvas a redraw is a
// few hundred small stamps. During a zoom the canvas is scaled as a picture
// and repainted once when the zoom settles.
/* global L */
const MapMarks = (function () {
  const PIN_PATH = 'M12 0.9C5.9 0.9 1 5.8 1 11.9c0 7.8 9.4 18.1 10.1 18.9a1.2 1.2 0 0 0 1.8 0C13.6 30 23 19.7 23 11.9 23 5.8 18.1 0.9 12 0.9Z';
  const PIN_W = 24, PIN_H = 32, PIN_TIP = 30;   // the tip sits 30px down, on the place
  const PIN_PAD = 10;                           // room for the shadow around a stamp
  const PIN_HEAD_Y = 11.9;                      // centre of the pin's round head
  const MARK_EDGE = '#FEFDF9';                  // --map-paper, the pins' outline
  const DOT_R = 6;

  // One stamp per colour, drawn once: the pin with its outline, white eye and
  // a soft shadow.
  const stamps = {};
  function pinStamp(color) {
    if (stamps[color]) return stamps[color];
    const dpr = window.devicePixelRatio || 1;
    const c = document.createElement('canvas');
    c.width = (PIN_W + PIN_PAD * 2) * dpr;
    c.height = (PIN_H + PIN_PAD * 2) * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.translate(PIN_PAD, PIN_PAD);
    const shape = new Path2D(PIN_PATH);
    ctx.shadowColor = 'rgba(51, 51, 51, 0.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = color;
    ctx.fill(shape);
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = MARK_EDGE;
    ctx.stroke(shape);
    ctx.beginPath();
    ctx.arc(12, PIN_HEAD_Y, 4.1, 0, Math.PI * 2);
    ctx.fillStyle = MARK_EDGE;
    ctx.fill();
    return (stamps[color] = c);
  }

  // The same pin as an SVG, for a marker that is a page element - the
  // phone's destination, drawn larger than the rest.
  function pinSvg(color) {
    return '<svg viewBox="0 0 24 32" aria-hidden="true"><path d="' + PIN_PATH + '" fill="' + color +
      '" stroke="' + MARK_EDGE + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<circle cx="12" cy="' + PIN_HEAD_Y + '" r="4.1" fill="' + MARK_EDGE + '"/></svg>';
  }

  // A circle marker that draws itself as a pin from options.pinZoom in.
  // Leaflet's canvas renderer still does the projecting, culling and hit
  // testing; only the shape it paints and the box it occupies change.
  const PlaceMarker = L.CircleMarker.extend({
    _isPin: function () {
      return !!this._map && this._map.getZoom() >= this.options.pinZoom;
    },

    _updateBounds: function () {
      if (!this._isPin()) return L.CircleMarker.prototype._updateBounds.call(this);
      const p = this._point;
      this._pxBounds = L.bounds(
        [p.x - PIN_W / 2 - PIN_PAD, p.y - PIN_TIP - PIN_PAD],
        [p.x + PIN_W / 2 + PIN_PAD, p.y - PIN_TIP + PIN_H + PIN_PAD]);
    },

    _updatePath: function () {
      if (!this._isPin()) return L.CircleMarker.prototype._updatePath.call(this);
      const r = this._renderer;
      if (!r._drawing || this._empty()) return;
      const p = this._point;
      r._ctx.drawImage(pinStamp(this.options.fillColor),
        p.x - PIN_W / 2 - PIN_PAD, p.y - PIN_TIP - PIN_PAD,
        PIN_W + PIN_PAD * 2, PIN_H + PIN_PAD * 2);
    },

    _containsPoint: function (pt) {
      if (!this._isPin()) return L.CircleMarker.prototype._containsPoint.call(this, pt);
      const p = this._point;
      return pt.x >= p.x - PIN_W / 2 && pt.x <= p.x + PIN_W / 2 &&
             pt.y >= p.y - PIN_TIP && pt.y <= p.y - PIN_TIP + PIN_H;
    },

    // where a finger aims: the dot itself, or the pin's round head
    _aim: function () {
      return this._isPin() ? this._point.subtract([0, PIN_TIP - PIN_HEAD_Y]) : this._point;
    }
  });

  function placeMarker(latlng, color, renderer, pinZoom) {
    return new PlaceMarker(latlng, {
      renderer: renderer, radius: DOT_R, weight: 1.5, color: MARK_EDGE,
      fillColor: color, fillOpacity: 1, pinZoom: pinZoom,
      // a tap on a marker is the marker's, not also the map's
      bubblingMouseEvents: false
    });
  }

  // Crossing pinZoom changes every marker's shape and size: re-measure them
  // all and repaint.
  function redrawOnPinZoom(map, layer, pinZoom) {
    let pins = map.getZoom() >= pinZoom;
    map.on('zoomend', () => {
      const now = map.getZoom() >= pinZoom;
      if (now === pins) return;
      pins = now;
      layer.eachLayer(m => m.redraw());
    });
  }

  // ---- building and gate names ----
  // They size with the zoom the way a street map's do: small over the whole
  // campus, larger closer in, and where two would collide the one earlier in
  // building-labels.js is drawn and the other waits.
  const LABEL_INK = '#12294D';                      // --slsu-navy-deep
  const LABEL_HALO = 'rgba(254, 253, 249, 0.92)';   // --map-paper
  const LABEL_MAX_WIDTH = 9;                        // wrap after about this many ems

  // 10px over the whole campus (zoom ~1.2 above GEO_ZOOM_SHIFT), 18px from ~3.5 in.
  function labelPx(map) {
    const z = map.getZoom() - GEO_ZOOM_SHIFT;
    return Math.round(Math.max(10, Math.min(18, 10 + (z - 1.2) * 3.5)));
  }

  // Each full repaint starts with nothing placed, so the collision check
  // only ever compares names drawn in the same pass.
  const LabelCanvas = L.Canvas.extend({
    _draw: function () {
      this._placed = [];
      L.Canvas.prototype._draw.call(this);
    }
  });

  function wrapLabel(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    words.forEach(w => {
      const next = line ? line + ' ' + w : w;
      if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = w; }
      else line = next;
    });
    if (line) lines.push(line);
    return lines;
  }

  // A label is a circle marker that paints text instead of a circle - the same
  // trick as PlaceMarker - so Leaflet's canvas renderer projects and culls it.
  const BuildingLabel = L.CircleMarker.extend({
    options: { interactive: false, radius: 1, stroke: false, fill: false },

    // Generous, so a name is never culled while any of it is on screen.
    _updateBounds: function () {
      const p = this._point;
      this._pxBounds = L.bounds(p.subtract([140, 50]), p.add([140, 50]));
    },

    _updatePath: function () {
      const r = this._renderer;
      if (!r._drawing || this._empty()) return;
      const ctx = r._ctx;
      const px = labelPx(this._map) - (this.options.gate ? 1 : 0);
      ctx.font = this.options.font.replace('{px}', px);
      const lines = wrapLabel(ctx, this.options.text, px * LABEL_MAX_WIDTH);
      const lineH = px * 1.15;
      const w = Math.max(...lines.map(l => ctx.measureText(l).width));
      const h = lineH * lines.length;
      const p = this._point;
      const box = [p.x - w / 2 - 4, p.y - h / 2 - 3, p.x + w / 2 + 4, p.y + h / 2 + 3];
      if (r._placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) return;
      r._placed.push(box);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, px / 4);
      ctx.strokeStyle = LABEL_HALO;
      ctx.fillStyle = LABEL_INK;
      lines.forEach((line, i) => {
        const y = p.y - h / 2 + lineH * (i + 0.5);
        ctx.strokeText(line, p.x, y);
        ctx.fillText(line, p.x, y);
      });
    },

    _containsPoint: function () { return false; }
  });

  // Names sit above the floor drawing and the routes and pins (pane z 450), and
  // under the page-element markers (markerPane 600, tooltipPane 650). Taps go
  // straight through to whatever is underneath, so a name never blocks a pin.
  function addBuildingLabels(map, labels, toLatLng) {
    map.createPane('labelPane');
    map.getPane('labelPane').style.zIndex = 450;
    map.getPane('labelPane').style.pointerEvents = 'none';
    const font = '700 {px}px ' + getComputedStyle(document.body).fontFamily;
    const renderer = new LabelCanvas({ pane: 'labelPane', padding: 0.2 });
    const layer = L.layerGroup((labels || []).map(l =>
      new BuildingLabel(toLatLng(l.at), { renderer: renderer, text: l.text, gate: !!l.gate, font: font }))
    ).addTo(map);
    // The size changes with the zoom, so every name is re-measured once the
    // zoom settles (the renderer repaints on the moveend that follows).
    map.on('zoomend', () => layer.eachLayer(l => l._project && l._project()));
    return layer;
  }

  return { placeMarker, redrawOnPinZoom, pinSvg, addBuildingLabels, MARK_EDGE };
})();
