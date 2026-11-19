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

  // A white symbol in the pin's head for the places visitors look for most, so
  // a pin says what it is without learning sixteen colours; other categories
  // keep the plain white eye. Filled shapes on a 24x24 grid (evenodd), one
  // definition for the canvas pins, the quick-find tiles and the map key.
  const ICONS = {
    'comfort-rooms':                       // a man and a woman
      'M8.6 4.4a1.9 1.9 0 1 1-3.8 0a1.9 1.9 0 1 1 3.8 0Z M4.6 7.4h4.2a1 1 0 0 1 1 1V15H8.5v6.6H6.9V15H5.6v6.6H4V15H3.6V8.4a1 1 0 0 1 1-1Z' +
      'M19.2 4.4a1.9 1.9 0 1 1-3.8 0a1.9 1.9 0 1 1 3.8 0Z M15.8 7.4h3.4l2.6 8.4h-2.4v5.8h-1.5v-5.8h-0.8v5.8h-1.5v-5.8h-2.4Z',
    'food-commercial':                     // fork and knife
      'M5 2h1.5v5.5h1V2H9v5.5h1V2h1.5v7a3 3 0 0 1-2.2 2.9V22H7.2V11.9A3 3 0 0 1 5 9Z M17.6 2C20 3.5 20.5 7 20.5 10.5H18.4V22h-2.1V2.2Z',
    'health-services':                     // a cross
      'M9.4 3h5.2v6.4H21v5.2h-6.4V21H9.4v-6.4H3V9.4h6.4Z',
    'waiting':                             // a bench (waiting areas, filed under parking)
      'M3 9.5h18v3H3Z M4.5 12.5h2.2V19H4.5Z M17.3 12.5h2.2V19h-2.2Z M4.5 5h15v2.8h-15Z',
    'parking-waiting':                     // P
      'M6 3h7.2a5.6 5.6 0 0 1 0 11.2H9.6V21H6Z M9.6 6.3v4.6h3.4a2.3 2.3 0 0 0 0-4.6Z',
    'libraries':                           // an open book
      'M2.5 5.2c3.2-1.2 6.4-.9 8.6.9v14.4c-2.3-1.5-5.5-1.7-8.6-.6Z M21.5 5.2c-3.2-1.2-6.4-.9-8.6.9v14.4c2.3-1.5 5.5-1.7 8.6-.6Z',
    'laboratories':                        // a flask
      'M8.6 2h6.8v2h-1.3v4.7l5.8 10.1A2.2 2.2 0 0 1 18 22H6a2.2 2.2 0 0 1-1.9-3.2L9.9 8.7V4H8.6Z',
    'admin-offices':                       // a briefcase
      'M9 3h6a1.6 1.6 0 0 1 1.6 1.6V6.5H20a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h3.4V4.6A1.6 1.6 0 0 1 9 3Z M9.4 5v1.5h5.2V5Z',
    'lodging':                             // a bed (dormitories, guest rooms)
      'M2.5 5h2.2v7.2h16.8V20h-2.2v-2.6H4.7V20H2.5Z M9.6 9.6a2.1 2.1 0 1 1-4.2 0a2.1 2.1 0 1 1 4.2 0Z M10.8 8h7.2a3.5 3.5 0 0 1 3.5 3.5v.2H10.8Z',
    'classrooms':                          // a graduation cap
      'M12 3.5 1 9l11 5.5L21 10v6h2V9Z M5.6 13v3.9C7.3 18.6 9.6 19.5 12 19.5s4.7-.9 6.4-2.6V13L12 16.2Z'
  };
  const iconPaths = {};
  function iconPath(cat) {
    if (!ICONS[cat]) return null;
    return iconPaths[cat] || (iconPaths[cat] = new Path2D(ICONS[cat]));
  }
  // The same symbol as an SVG, white on nothing - for page elements.
  function iconSvg(cat) {
    if (!ICONS[cat]) return '';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="' +
      ICONS[cat] + '"/></svg>';
  }

  // One stamp per colour and symbol, drawn once: the pin with its outline, its
  // white symbol or eye, and a soft shadow.
  const stamps = {};
  function pinStamp(color, icon) {
    const key = color + '|' + (iconPath(icon) ? icon : '');
    if (stamps[key]) return stamps[key];
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
    ctx.fillStyle = MARK_EDGE;
    const symbol = iconPath(icon);
    if (symbol) {
      // 13px across, centred on the head
      ctx.save();
      ctx.translate(12 - 6.5, PIN_HEAD_Y - 6.5);
      ctx.scale(13 / 24, 13 / 24);
      ctx.fill(symbol, 'evenodd');
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(12, PIN_HEAD_Y, 4.1, 0, Math.PI * 2);
      ctx.fill();
    }
    return (stamps[key] = c);
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
      r._ctx.drawImage(pinStamp(this.options.fillColor, this.options.icon),
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

  // icon: the place's category id - its symbol, if it has one (ICONS)
  function placeMarker(latlng, color, renderer, pinZoom, icon) {
    return new PlaceMarker(latlng, {
      renderer: renderer, radius: DOT_R, weight: 1.5, color: MARK_EDGE,
      fillColor: color, fillOpacity: 1, pinZoom: pinZoom, icon: icon,
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
  const GATE_COLOUR = '#3F7A4B';                    // --slsu-green, the seal's green
  const GATE_INK = '#2C5A36';                       // the same green, darker, for text

  // A gate's sign: a green disc with a white archway and two bars, drawn above
  // its name so the ways in and out of the campus stand out from buildings.
  function drawGateIcon(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = GATE_COLOUR;
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.strokeStyle = LABEL_HALO;
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, r * 0.17);
    const w = r * 0.5, top = cy - r * 0.08, foot = cy + r * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - w, foot);
    ctx.lineTo(cx - w, top);
    ctx.arc(cx, top, w, Math.PI, 0);
    ctx.lineTo(cx + w, foot);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    [-w / 3, w / 3].forEach(dx => { ctx.moveTo(cx + dx, top - w * 0.55); ctx.lineTo(cx + dx, foot); });
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

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
      this._pxBounds = L.bounds(p.subtract([180, 70]), p.add([180, 90]));
    },

    _updatePath: function () {
      const r = this._renderer;
      if (!r._drawing || this._empty()) return;
      const ctx = r._ctx;
      const gate = this.options.gate;
      const px = Math.round(labelPx(this._map) * this.options.scale);
      ctx.font = this.options.font.replace('{px}', px);
      const lines = wrapLabel(ctx, this.options.text, px * LABEL_MAX_WIDTH);
      const lineH = px * 1.15;
      const w = Math.max(...lines.map(l => ctx.measureText(l).width));
      const h = lineH * lines.length;
      // a gate's icon sits on its point and the name hangs below it
      const iconR = gate ? px * 0.95 : 0;
      const p = gate ? this._point.add([0, iconR + 3 + h / 2]) : this._point;
      const top = gate ? this._point.y - iconR - 2 : p.y - h / 2 - 3;
      const box = [p.x - Math.max(w / 2, iconR) - 4, top, p.x + Math.max(w / 2, iconR) + 4, p.y + h / 2 + 3];
      if (r._placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) return;
      r._placed.push(box);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, px / 4);
      ctx.strokeStyle = LABEL_HALO;
      ctx.fillStyle = gate ? GATE_INK : LABEL_INK;
      lines.forEach((line, i) => {
        const y = p.y - h / 2 + lineH * (i + 0.5);
        ctx.strokeText(line, p.x, y);
        ctx.fillText(line, p.x, y);
      });
      if (gate) drawGateIcon(ctx, this._point.x, this._point.y, iconR);
    },

    _containsPoint: function () { return false; }
  });

  // Names sit above the floor drawing and the routes and pins (pane z 450), and
  // under the page-element markers (markerPane 600, tooltipPane 650). Taps go
  // straight through to whatever is underneath, so a name never blocks a pin.
  // options.scale: text size relative to the default (the kiosk, read from a
  // step back, draws them larger than the phone).
  function addBuildingLabels(map, labels, toLatLng, options) {
    const scale = (options && options.scale) || 1;
    map.createPane('labelPane');
    map.getPane('labelPane').style.zIndex = 450;
    map.getPane('labelPane').style.pointerEvents = 'none';
    const font = '700 {px}px ' + getComputedStyle(document.body).fontFamily;
    const renderer = new LabelCanvas({ pane: 'labelPane', padding: 0.2 });
    const layer = L.layerGroup((labels || []).map(l =>
      new BuildingLabel(toLatLng(l.at), { renderer: renderer, text: l.text, gate: !!l.gate, font: font, scale: scale }))
    ).addTo(map);
    // The size changes with the zoom, so every name is re-measured once the
    // zoom settles (the renderer repaints on the moveend that follows).
    map.on('zoomend', () => layer.eachLayer(l => l._project && l._project()));
    return layer;
  }

  // The red map pin, as map apps mark a place found: the kiosk drops it on what
  // was chosen (app.js dropFindPin) and the phone marks its destination with
  // it, so the place is marked alike on both screens. Draw it 40x54, tip at
  // (20, 52); style.css .find-pin and mobile.html .dest-pin drop it in once.
  const FIND_PIN_SVG = '<svg viewBox="0 0 40 54" aria-hidden="true">' +
    '<path d="M20 1.5C9.8 1.5 1.5 9.6 1.5 19.7c0 13.4 15.6 29.6 17.3 31.4a1.7 1.7 0 0 0 2.4 0C22.9 49.3 38.5 33.1 38.5 19.7 38.5 9.6 30.2 1.5 20 1.5Z" fill="#EA4335" stroke="#B31412" stroke-width="1.5"/>' +
    '<circle cx="20" cy="19.5" r="6.5" fill="#B31412"/></svg>';

  return { placeMarker, redrawOnPinZoom, pinSvg, addBuildingLabels, MARK_EDGE, FIND_PIN_SVG, ICONS, iconSvg };
})();
