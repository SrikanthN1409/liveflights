import * as am5 from "@amcharts/amcharts5";
import * as am5map from "@amcharts/amcharts5/map";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import am5geodata_worldLow from "@amcharts/amcharts5-geodata/worldLow";
import { getSolarPosition } from "./solar";
import "./style.css";

// ═══════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════
// Auto-detect backend — same host in production, localhost:3000 in dev
const IS_PROD   = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
const API_BASE  = IS_PROD ? `${window.location.protocol}//${window.location.host}` : "http://localhost:3000";
const WS_URL    = IS_PROD ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}` : "ws://localhost:3000";
const MAX_PLANES = 4000;
const UPDATE_MS  = 4500;
const PLANE_SVG  = "M0,-16 C1,-12 2,-8 2,-4 L14,4 L14,7 L2,3 L2,10 L5,12 L5,14 L0,13 L-5,14 L-5,12 L-2,10 L-2,3 L-14,7 L-14,4 L-2,-4 C-2,-8 -1,-12 0,-16 Z";

// ═══════════════════════════════════════════════════════════
//  COLOUR SCHEMES
// ═══════════════════════════════════════════════════════════
function altColor(alt) {
  if (!alt || alt <= 0) return { fill: 0xaaaaaa, stroke: 0x777777 };
  if (alt < 5000)       return { fill: 0x00cc44, stroke: 0x009933 };
  if (alt < 15000)      return { fill: 0x00ddff, stroke: 0x00aacc };
  if (alt < 25000)      return { fill: 0xffdd00, stroke: 0xcc9900 };
  if (alt < 35000)      return { fill: 0xff8800, stroke: 0xcc5500 };
  return                       { fill: 0xff3333, stroke: 0xcc0000 };
}

function speedColor(spd) {
  if (!spd || spd <= 0)  return { fill: 0xaaaaaa, stroke: 0x777777 };
  if (spd < 100)         return { fill: 0x4488ff, stroke: 0x2266cc };
  if (spd < 250)         return { fill: 0x00ddff, stroke: 0x00aacc };
  if (spd < 400)         return { fill: 0x00cc44, stroke: 0x009933 };
  if (spd < 500)         return { fill: 0xffdd00, stroke: 0xcc9900 };
  if (spd < 600)         return { fill: 0xff8800, stroke: 0xcc5500 };
  return                        { fill: 0xff3333, stroke: 0xcc0000 };
}

function sourceColor(source) {
  if (source === "adsb")    return { fill: 0x00eeff, stroke: 0x00aacc };
  if (source === "opensky") return { fill: 0xaa88ff, stroke: 0x8855cc };
  return                           { fill: 0xaaaaaa, stroke: 0x777777 };
}

let colourMode = "altitude"; // altitude | speed | source

function planeColor(plane) {
  if (colourMode === "speed")  return speedColor(plane.spd);
  if (colourMode === "source") return sourceColor(plane.source);
  return altColor(plane.alt);
}

// ═══════════════════════════════════════════════════════════
//  FILTER STATE
// ═══════════════════════════════════════════════════════════
const filters = {
  altMin: 0, altMax: 45000,
  spdMin: 0, spdMax: 700,
  typePrefix: "all",
  airborne: true, ground: true
};

function matchesFilter(p) {
  if (!filters.airborne && p.alt > 0)  return false;
  if (!filters.ground   && p.alt <= 0) return false;
  if (p.alt > filters.altMax || p.alt < filters.altMin) return false;
  if (p.spd > filters.spdMax || p.spd < filters.spdMin) return false;
  if (filters.typePrefix !== "all" && p.type &&
      !p.type.toUpperCase().startsWith(filters.typePrefix.toUpperCase())) return false;
  return true;
}

function activeFilterCount() {
  let n = 0;
  if (filters.altMin > 0 || filters.altMax < 45000) n++;
  if (filters.spdMin > 0 || filters.spdMax < 700)   n++;
  if (filters.typePrefix !== "all") n++;
  if (!filters.airborne || !filters.ground) n++;
  return n;
}

function updateFilterBadge() {
  const n   = activeFilterCount();
  const el  = document.getElementById("filter-badge");
  if (!el) return;
  el.textContent = n;
  el.style.display = n > 0 ? "inline" : "none";
}

// ═══════════════════════════════════════════════════════════
//  GLOBE SETUP
// ═══════════════════════════════════════════════════════════
const root = am5.Root.new("chartdiv");

// Force resize after short delay — fixes mobile blank globe on first load
setTimeout(() => { root.dom.style.width = "100%"; window.dispatchEvent(new Event("resize")); }, 300);
setTimeout(() => { window.dispatchEvent(new Event("resize")); }, 800);

// Re-render on orientation change (mobile)
window.addEventListener("orientationchange", () => {
  setTimeout(() => window.dispatchEvent(new Event("resize")), 400);
});
root.setThemes([am5themes_Animated.new(root)]);

const chart = root.container.children.push(
  am5map.MapChart.new(root, {
    projection: am5map.geoOrthographic(),
    panX: "rotateX", panY: "rotateY",
    wheelY: "zoom", pinchZoom: true,
    maxZoomLevel: 16, homeZoomLevel: 1.3
  })
);
chart.set("rotationX", -78);
chart.set("rotationY", -20);
chart.set("zoomLevel", 1);

// Auto-rotate
let autoRotate = true;
root.events.on("framestarted", () => {
  if (!autoRotate) return;
  chart.set("rotationX", (chart.get("rotationX") || 0) - 0.05);
});
chart.events.on("dragstart",    () => { autoRotate = false; });
chart.events.on("dragstop",     () => { autoRotate = true; });
chart.events.on("wheelstarted", () => { autoRotate = false; });
chart.events.on("wheelended",   () => { setTimeout(() => { autoRotate = true; }, 2000); });

// Ocean
const background = chart.series.push(am5map.MapPolygonSeries.new(root, { geoJSON: { type: "Sphere" } }));
background.mapPolygons.template.setAll({ fill: am5.color(0x0a1929), strokeOpacity: 0 });

// Atmosphere
const atmosphere = chart.series.push(am5map.MapPolygonSeries.new(root, { geoJSON: { type: "Sphere" } }));
atmosphere.mapPolygons.template.setAll({
  fillGradient: am5.RadialGradient.new(root, {
    stops: [
      { color: am5.color(0x4488ff), opacity: 0.3  },
      { color: am5.color(0x88ccff), opacity: 0.15 },
      { color: am5.color(0x000033), opacity: 0    }
    ]
  }),
  strokeOpacity: 0
});

// Rim
const rimSeries = chart.series.push(am5map.MapPolygonSeries.new(root, { geoJSON: { type: "Sphere" } }));
rimSeries.mapPolygons.template.setAll({ fillOpacity: 0, strokeWidth: 4, stroke: am5.color(0x66ddff), strokeOpacity: 0.6 });

// Countries
const polygonSeries = chart.series.push(
  am5map.MapPolygonSeries.new(root, { geoJSON: am5geodata_worldLow })
);
polygonSeries.mapPolygons.template.setAll({ stroke: am5.color(0x2a4a5a), strokeWidth: 0.5, strokeOpacity: 0.5 });

// Country labels
const labelSeries = chart.series.push(am5map.MapPointSeries.new(root, {}));
polygonSeries.events.on("datavalidated", () => {
  const out = [];
  polygonSeries.mapPolygons.each(poly => {
    const c = poly.geoCentroid(), geo = poly.dataItem?.dataContext;
    if (!c || !geo?.name) return;
    if (geo.properties?.area && geo.properties.area < 150000) return;
    out.push({ geometry: { type: "Point", coordinates: [c.longitude, c.latitude] }, name: geo.name });
  });
  labelSeries.data.setAll(out);
});
labelSeries.bullets.push(() =>
  am5.Bullet.new(root, {
    sprite: am5.Label.new(root, {
      text: "{name}", fill: am5.color(0xffffff), fontSize: 10,
      fontWeight: "500", centerX: am5.p50, centerY: am5.p50,
      populateText: true, shadowColor: am5.color(0x000000), shadowBlur: 4
    })
  })
);
chart.events.on("frameended", () => {
  if (!layerStates.labels) return;
  const zoom = chart.get("zoomLevel") || 1;
  labelSeries.dataItems.each(di => {
    const sprite = di.bullets?.[0]?.get("sprite");
    if (!sprite) return;
    const coords = di.dataContext?.geometry?.coordinates;
    if (!coords) { sprite.set("visible", false); return; }
    const pt = chart.convert({ longitude: coords[0], latitude: coords[1] });
    sprite.set("visible", !!(pt && pt.z >= 0 && zoom >= 1.5));
    if (pt?.z >= 0) sprite.set("fontSize", Math.min(18, 8 + zoom * 2));
  });
});

// ── Sun / Day-Night ───────────────────────────────────────
const sunSeries = chart.series.push(am5map.MapPointSeries.new(root, {}));
sunSeries.bullets.push(() => {
  const glow = am5.Circle.new(root, { radius: 30, fill: am5.color(0xffaa00), fillOpacity: 0.25 });
  glow.animate({ key: "scale", from: 1, to: 1.5, duration: 2000, loops: Infinity, easing: am5.ease.yoyo(am5.ease.cubic) });
  const mid  = am5.Circle.new(root, { radius: 18, fill: am5.color(0xffcc00), fillOpacity: 0.5 });
  const core = am5.Circle.new(root, { radius: 10, fill: am5.color(0xffee00), stroke: am5.color(0xffffff), strokeWidth: 2 });
  const c = am5.Container.new(root, {});
  c.children.push(glow, mid, core);
  return am5.Bullet.new(root, { sprite: c });
});

let currentSolar = getSolarPosition(new Date());
polygonSeries.mapPolygons.template.adapters.add("fill", (_, target) => {
  if (!layerStates.daynight) return am5.color(0x2d5a3e);
  const cent = target.geoCentroid();
  if (!cent) return am5.color(0x2d5a3e);
  const r = Math.PI / 180;
  const cos = Math.sin(cent.latitude * r) * Math.sin(currentSolar.latitude * r) +
              Math.cos(cent.latitude * r) * Math.cos(currentSolar.latitude * r) *
              Math.cos((cent.longitude - currentSolar.longitude) * r);
  const b = Math.max(0, Math.min(1, 0.3 + Math.max(0, cos) * 0.7));
  return am5.Color.interpolate(b, am5.color(0x1a3d2e), am5.color(0x6b9b78));
});

function updateScene(date) {
  currentSolar = getSolarPosition(date);
  sunSeries.data.setAll([{
    geometry: { type: "Point", coordinates: [currentSolar.longitude, currentSolar.latitude] }
  }]);
  sunSeries.set("visible", layerStates.daynight);
  polygonSeries.markDirtyValues();
}

// ── Airport markers ───────────────────────────────────────
const airportSeries = chart.series.push(
  am5map.MapPointSeries.new(root, { latitudeField: "latitude", longitudeField: "longitude" })
);
airportSeries.bullets.push((root, series, dataItem) => {
  const iata = dataItem?.dataContext?.iata || "";
  const name = dataItem?.dataContext?.name || "";
  const container = am5.Container.new(root, { cursorOverStyle: "pointer" });

  container.children.push(am5.Circle.new(root, {
    radius: 4, fill: am5.color(0x00eeff), fillOpacity: 0.95,
    stroke: am5.color(0xffffff), strokeWidth: 1.5,
  }));

  // Label with white background — only visible when zoomed in
  const lbl = container.children.push(am5.Label.new(root, {
    text: iata,
    fill: am5.color(0x000000),
    fontSize: 9,
    fontWeight: "700",
    fontFamily: "monospace",
    centerX: am5.p50,
    dy: -16,
    visible: false,
    background: am5.RoundedRectangle.new(root, {
      fill: am5.color(0xffffff),
      fillOpacity: 0.95,
      stroke: am5.color(0x00aaff),
      strokeWidth: 1,
      cornerRadiusTL: 3, cornerRadiusTR: 3,
      cornerRadiusBL: 3, cornerRadiusBR: 3,
    }),
    paddingTop: 2, paddingBottom: 2, paddingLeft: 5, paddingRight: 5,
  }));

  const tooltip = am5.Tooltip.new(root, {
    getFillFromSprite: false, paddingTop: 6, paddingBottom: 6,
    paddingLeft: 10, paddingRight: 10,
    background: am5.RoundedRectangle.new(root, {
      fill: am5.color(0x050f1e), stroke: am5.color(0x00eeff), strokeWidth: 1,
      cornerRadiusTL: 6, cornerRadiusTR: 6, cornerRadiusBL: 6, cornerRadiusBR: 6
    })
  });
  tooltip.label.setAll({ fontSize: 12, fill: am5.color(0xffffff) });
  container.set("tooltip", tooltip);
  container.set("tooltipText", `${iata} — ${name}`);

  chart.events.on("frameended", () => {
    const z = chart.get("zoomLevel") || 1;
    lbl.set("visible", z > 2);
  });

  return am5.Bullet.new(root, { sprite: container });
});

let airportDataLoaded = false;
let airportList = [];
function loadAirports(airports) {
  if (airportDataLoaded) return;
  airportDataLoaded = true;
  airportList = airports;
  airportSeries.data.setAll(airports.map(a => ({
    latitude: a.lat, longitude: a.lon, iata: a.iata, name: a.name
  })));
  // Feed into flight search autocomplete
  if (typeof mergeServerAirports === "function") mergeServerAirports(airports);
}

// ═══════════════════════════════════════════════════════════
//  FLIGHT ROUTE — FlightAware-style great-circle path
//  Shows: flown segment (white/bright) + remaining segment
//  (dashed cyan) + animated plane dot on the line
// ═══════════════════════════════════════════════════════════

// ── Flown segment (solid white, like FA's completed path) ──
const flownSeries = chart.series.push(am5map.MapLineSeries.new(root, { useGeodata: false }));
flownSeries.mapLines.template.setAll({
  stroke:        am5.color(0xffffff),
  strokeWidth:   2.5,
  strokeOpacity: 0.9,
});

// ── Remaining segment (dashed cyan) ───────────────────────
const remainSeries = chart.series.push(am5map.MapLineSeries.new(root, { useGeodata: false }));
remainSeries.mapLines.template.setAll({
  stroke:         am5.color(0x00eeff),
  strokeWidth:    1.8,
  strokeOpacity:  0.7,
  strokeDasharray:[6, 5],
});

// ── Origin airport dot ────────────────────────────────────
const originDotSeries = chart.series.push(
  am5map.MapPointSeries.new(root, { latitudeField: "latitude", longitudeField: "longitude" })
);
originDotSeries.bullets.push(() => {
  const outer = am5.Circle.new(root, { radius: 7, fill: am5.color(0xffffff), fillOpacity: 0.15, stroke: am5.color(0xffffff), strokeWidth: 1.5 });
  const inner = am5.Circle.new(root, { radius: 3.5, fill: am5.color(0xffffff) });
  const c = am5.Container.new(root, {});
  c.children.push(outer, inner);
  return am5.Bullet.new(root, { sprite: c });
});

// ── Destination airport dot ───────────────────────────────
const destDotSeries = chart.series.push(
  am5map.MapPointSeries.new(root, { latitudeField: "latitude", longitudeField: "longitude" })
);
destDotSeries.bullets.push(() => {
  const outer = am5.Circle.new(root, { radius: 8, fill: am5.color(0x00eeff), fillOpacity: 0.15, stroke: am5.color(0x00eeff), strokeWidth: 1.5 });
  outer.animate({ key: "scale", from: 1, to: 1.5, duration: 1200, loops: Infinity, easing: am5.ease.yoyo(am5.ease.cubic) });
  const inner = am5.Circle.new(root, { radius: 3.5, fill: am5.color(0x00eeff), stroke: am5.color(0xffffff), strokeWidth: 1.5 });
  const c = am5.Container.new(root, {});
  c.children.push(outer, inner);
  return am5.Bullet.new(root, { sprite: c });
});

// ── Origin / Dest labels ──────────────────────────────────
const routeLabelSeries = chart.series.push(
  am5map.MapPointSeries.new(root, { latitudeField: "latitude", longitudeField: "longitude" })
);
routeLabelSeries.bullets.push((root, series, dataItem) => {
  const iata  = dataItem.dataContext?.iata  || "";
  const isOrg = dataItem.dataContext?.isOrigin;
  const lbl   = am5.Label.new(root, {
    text:       iata,
    fill:       am5.color(isOrg ? 0xffffff : 0x00eeff),
    fontSize:   11,
    fontWeight: "700",
    fontFamily: "JetBrains Mono",
    centerX:    am5.p50,
    dy:         -18,
    background: am5.RoundedRectangle.new(root, {
      fill:         am5.color(isOrg ? 0x1a1a2e : 0x001a2e),
      fillOpacity:  0.85,
      stroke:       am5.color(isOrg ? 0x555577 : 0x00eeff),
      strokeWidth:  1,
      cornerRadiusTL: 4, cornerRadiusTR: 4,
      cornerRadiusBL: 4, cornerRadiusBR: 4,
    }),
    paddingTop: 3, paddingBottom: 3, paddingLeft: 7, paddingRight: 7,
  });
  return am5.Bullet.new(root, { sprite: lbl });
});

// ── Animated plane dot on the route line ─────────────────
const routePlaneSeries = chart.series.push(
  am5map.MapPointSeries.new(root, { latitudeField: "latitude", longitudeField: "longitude" })
);
routePlaneSeries.bullets.push((root, series, dataItem) => {
  const hdg = dataItem.dataContext?.hdg ?? 0;
  const PLANE = "M0,-16 C1,-12 2,-8 2,-4 L14,4 L14,7 L2,3 L2,10 L5,12 L5,14 L0,13 L-5,14 L-5,12 L-2,10 L-2,3 L-14,7 L-14,4 L-2,-4 C-2,-8 -1,-12 0,-16 Z";
  const shadow = am5.Graphics.new(root, {
    svgPath: PLANE, fill: am5.color(0x000000), fillOpacity: 0.35,
    scale: 1.1, rotation: hdg, dx: 2, dy: 2, centerX: am5.p50, centerY: am5.p50
  });
  const plane = am5.Graphics.new(root, {
    svgPath: PLANE,
    fill: am5.color(0xffffff), stroke: am5.color(0x00eeff),
    strokeWidth: 1.2, scale: 1.05, rotation: hdg,
    centerX: am5.p50, centerY: am5.p50,
    filter: "drop-shadow(0 0 6px rgba(0,238,255,0.9))"
  });
  const c = am5.Container.new(root, {});
  c.children.push(shadow, plane);
  return am5.Bullet.new(root, { sprite: c });
});

let selectedHex   = null;
let arcAnimHandle = null;
let trackingMode  = false;

function clearArc() {
  flownSeries.data.setAll([]);
  remainSeries.data.setAll([]);
  originDotSeries.data.setAll([]);
  destDotSeries.data.setAll([]);
  routeLabelSeries.data.setAll([]);
  routePlaneSeries.data.setAll([]);
  if (arcAnimHandle) { clearInterval(arcAnimHandle); arcAnimHandle = null; }
}

// ── Great-circle interpolation ─────────────────────────────
// Returns N evenly-spaced [lon,lat] points along the great circle from p1→p2
function greatCirclePoints(lat1, lon1, lat2, lon2, n = 64) {
  const R = Math.PI / 180;
  const φ1 = lat1 * R, λ1 = lon1 * R;
  const φ2 = lat2 * R, λ2 = lon2 * R;

  // Angular distance
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((φ2 - φ1) / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2
  ));

  if (d < 0.001) return [[lon1, lat1], [lon2, lat2]];

  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) / R;
    const lon = Math.atan2(y, x) / R;
    pts.push([lon, lat]);
  }
  return pts;
}

// ── Find airport lat/lon from loaded list ──────────────────
function findAirportCoords(iata) {
  if (!iata) return null;
  const code = iata.trim().toUpperCase();
  const a = airportList.find(x => x.iata === code);
  if (a) return { lat: a.lat, lon: a.lon, name: a.name };
  // Also check AIRPORT_DB in the flight search module
  const b = (typeof AIRPORT_DB !== "undefined") && AIRPORT_DB.find(x => x.iata === code);
  if (b) return { lat: null, lon: null, name: b.name }; // no coords in search DB
  return null;
}

// ── Progress along route (0–1) based on great-circle ──────
function routeProgress(orgLat, orgLon, dstLat, dstLon, curLat, curLon) {
  const totalPts  = greatCirclePoints(orgLat, orgLon, dstLat, dstLon, 200);
  // Find closest point on route to current position
  let bestIdx = 0, bestDist = Infinity;
  totalPts.forEach(([lon, lat], i) => {
    const d = (lat - curLat) ** 2 + (lon - curLon) ** 2;
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  });
  return bestIdx / (totalPts.length - 1);
}

// ── Main draw function ─────────────────────────────────────
function drawArc(plane) {
  clearArc();
  if (!plane) return;

  const curLat = plane.lat, curLon = plane.lon;
  const hdg    = plane.hdg ?? 0;

  // Parse origin / destination IATA codes
  const originCode = (plane.origin || "").trim().split(/[\s,\/]/)[0].toUpperCase() || null;
  const destCode   = (plane.dest   || "").trim().split(/[\s,\/]/)[0].toUpperCase() || null;

  const originApt  = originCode ? findAirportCoords(originCode) : null;
  const destApt    = destCode   ? findAirportCoords(destCode)   : null;

  const hasOrigin  = originApt && originApt.lat != null;
  const hasDest    = destApt   && destApt.lat   != null;

  // ── Case 1: Full route known — draw great-circle arc ─────
  if (hasOrigin && hasDest) {
    const orgLat = originApt.lat, orgLon = originApt.lon;
    const dstLat = destApt.lat,   dstLon = destApt.lon;

    // How far along the route is the plane?
    const progress = routeProgress(orgLat, orgLon, dstLat, dstLon, curLat, curLon);
    const splitIdx = Math.round(progress * 64);

    const allPts    = greatCirclePoints(orgLat, orgLon, dstLat, dstLon, 64);
    const flownPts  = allPts.slice(0, Math.max(2, splitIdx + 1));
    const remainPts = allPts.slice(Math.max(0, splitIdx));

    // Flown path — solid white
    flownSeries.data.setAll([{
      geometry: { type: "LineString", coordinates: flownPts }
    }]);

    // Remaining path — dashed cyan
    remainSeries.data.setAll([{
      geometry: { type: "LineString", coordinates: remainPts }
    }]);

    // Origin dot + label
    originDotSeries.data.setAll([{ latitude: orgLat, longitude: orgLon }]);
    destDotSeries.data.setAll([{ latitude: dstLat, longitude: dstLon }]);
    routeLabelSeries.data.setAll([
      { latitude: orgLat, longitude: orgLon, iata: originCode, isOrigin: true  },
      { latitude: dstLat, longitude: dstLon, iata: destCode,   isOrigin: false },
    ]);

    // Plane dot at current position on route
    routePlaneSeries.data.setAll([{ latitude: curLat, longitude: curLon, hdg }]);

  // ── Case 2: Only destination known — draw from current pos ──
  } else if (hasDest) {
    const dstLat = destApt.lat, dstLon = destApt.lon;
    const pts    = greatCirclePoints(curLat, curLon, dstLat, dstLon, 48);
    remainSeries.data.setAll([{ geometry: { type: "LineString", coordinates: pts } }]);
    destDotSeries.data.setAll([{ latitude: dstLat, longitude: dstLon }]);
    routeLabelSeries.data.setAll([{ latitude: dstLat, longitude: dstLon, iata: destCode, isOrigin: false }]);
    routePlaneSeries.data.setAll([{ latitude: curLat, longitude: curLon, hdg }]);

  // ── Case 3: No route data — draw heading projection line ──
  } else {
    const hdgRad = hdg * Math.PI / 180;
    const dist   = 25;
    const lat2   = Math.max(-89, Math.min(89, curLat + dist * Math.cos(hdgRad)));
    const lon2   = ((curLon + dist * Math.sin(hdgRad)) + 540) % 360 - 180;
    const pts    = greatCirclePoints(curLat, curLon, lat2, lon2, 20);
    remainSeries.data.setAll([{ geometry: { type: "LineString", coordinates: pts } }]);
    routePlaneSeries.data.setAll([{ latitude: curLat, longitude: curLon, hdg }]);
  }

  // ── Live update: keep plane dot moving on route ───────────
  arcAnimHandle = setInterval(() => {
    const live = flightDataMap.get(plane.hex);
    if (!live) return;
    // Update plane marker position
    if (routePlaneSeries.dataItems.length > 0) {
      try {
        routePlaneSeries.dataItems[0].set("latitude",  live.lat);
        routePlaneSeries.dataItems[0].set("longitude", live.lon);
        const sprite = routePlaneSeries.dataItems[0].bullets?.[0]?.get("sprite");
        if (sprite) {
          // Update heading of both children (shadow + plane)
          sprite.children?.each?.(child => { if (child.get) child.set("rotation", live.hdg ?? 0); });
        }
        // Update flown segment end to current position
        if (hasOrigin && hasDest) {
          const orgLat = originApt.lat, orgLon = originApt.lon;
          const dstLat = destApt.lat,   dstLon = destApt.lon;
          const progress = routeProgress(orgLat, orgLon, dstLat, dstLon, live.lat, live.lon);
          const splitIdx = Math.round(progress * 64);
          const allPts   = greatCirclePoints(orgLat, orgLon, dstLat, dstLon, 64);
          flownSeries.data.setAll([{ geometry: { type: "LineString", coordinates: allPts.slice(0, Math.max(2, splitIdx + 1)) } }]);
          remainSeries.data.setAll([{ geometry: { type: "LineString", coordinates: allPts.slice(Math.max(0, splitIdx)) } }]);
        }
      } catch (_) {}
    }
  }, 5000);
}

// ═══════════════════════════════════════════════════════════
//  ALTITUDE SPARKLINE (canvas)
// ═══════════════════════════════════════════════════════════
const altHistory = new Map(); // hex → [alt, ...]
const MAX_HIST   = 20;

function recordAlt(hex, alt) {
  if (!altHistory.has(hex)) altHistory.set(hex, []);
  const arr = altHistory.get(hex);
  arr.push(alt);
  if (arr.length > MAX_HIST) arr.shift();
}

function drawAltSparkline(hex) {
  const canvas = document.getElementById("fp-alt-chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.offsetWidth || 238;
  const H = canvas.height;
  canvas.width = W;
  ctx.clearRect(0, 0, W, H);

  const history = altHistory.get(hex) || [];
  if (history.length < 2) {
    ctx.fillStyle = "rgba(0,238,255,0.1)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0,238,255,0.3)";
    ctx.font = "10px JetBrains Mono";
    ctx.textAlign = "center";
    ctx.fillText("Collecting data…", W/2, H/2 + 4);
    return;
  }

  const maxAlt = Math.max(...history, 1000);
  const minAlt = Math.min(...history);
  const range  = maxAlt - minAlt || 1;

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,   "rgba(0,238,255,0.35)");
  grad.addColorStop(1,   "rgba(0,238,255,0.02)");

  ctx.beginPath();
  history.forEach((v, i) => {
    const x = (i / (history.length - 1)) * W;
    const y = H - ((v - minAlt) / range) * (H - 4) - 2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  // Close fill
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  history.forEach((v, i) => {
    const x = (i / (history.length - 1)) * W;
    const y = H - ((v - minAlt) / range) * (H - 4) - 2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#00eeff";
  ctx.lineWidth   = 1.5;
  ctx.stroke();
}

// ═══════════════════════════════════════════════════════════
//  FLIGHT PANEL
// ═══════════════════════════════════════════════════════════
const panel      = document.getElementById("flight-panel");
const panelClose = document.getElementById("panel-close");

function showFlightPanel(d) {
  selectedHex = d.hex;
  const c = planeColor(d);

  document.getElementById("fp-flight").textContent   = d.flight   || d.hex    || "N/A";
  document.getElementById("fp-alt-val").textContent  = d.alt  != null ? `${Math.round(d.alt).toLocaleString()}` : "—";
  document.getElementById("fp-spd-val").textContent  = d.spd  != null ? `${Math.round(d.spd)}` : "—";
  document.getElementById("fp-hdg-val").textContent  = d.hdg  != null ? `${Math.round(d.hdg)}°` : "—";
  document.getElementById("fp-alt-val").style.color  = `#${c.fill.toString(16).padStart(6,"0")}`;

  document.getElementById("fp-type").textContent       = d.type    || "Unknown";
  document.getElementById("fp-reg").textContent        = d.reg     || "N/A";
  document.getElementById("fp-squawk").textContent     = d.squawk  || "N/A";
  document.getElementById("fp-datasource").textContent = d.source  || "—";
  document.getElementById("fp-src-badge").textContent  = d.source === "adsb" ? "ADS-B" : d.source === "opensky" ? "OpenSky" : "LIVE";

  // Route bar
  const originParts = (d.origin || "").split(" ");
  document.getElementById("fp-origin-code").textContent = originParts[0] || "—";
  document.getElementById("fp-origin-name").textContent = originParts.slice(1).join(" ") || "Origin";
  document.getElementById("fp-dest-code").textContent   = d.dest  || "—";
  document.getElementById("fp-dest-name").textContent   = d.dest  ? "Destination" : "Unknown";

  panel.classList.add("visible");
  drawArc(d);
  drawAltSparkline(d.hex);

  if (!trackingMode) {
    autoRotate = false;
    // If we have a full route, centre the globe on the midpoint of the route
    const originCode = (d.origin || "").trim().split(/[\s,\/]/)[0].toUpperCase();
    const destCode   = (d.dest   || "").trim().split(/[\s,\/]/)[0].toUpperCase();
    const originApt  = originCode ? findAirportCoords(originCode) : null;
    const destApt    = destCode   ? findAirportCoords(destCode)   : null;

    let targetLat = d.lat, targetLon = d.lon;
    if (originApt?.lat != null && destApt?.lat != null) {
      // Centre on route midpoint for best full-route view
      targetLat = (originApt.lat + destApt.lat) / 2;
      targetLon = (originApt.lon + destApt.lon) / 2;
    }
    chart.animate({ key: "rotationX", to: -targetLon, duration: 900, easing: am5.ease.out(am5.ease.cubic) });
    chart.animate({ key: "rotationY", to: -targetLat, duration: 900, easing: am5.ease.out(am5.ease.cubic) });
    setTimeout(() => { autoRotate = true; }, 4500);
  }
}

panelClose?.addEventListener("click", () => {
  panel.classList.remove("visible");
  clearArc();
  selectedHex = null;
  trackingMode = false;
  const tb = document.getElementById("fp-track-btn");
  if (tb) tb.classList.remove("active");
});

// Track button
document.getElementById("fp-track-btn")?.addEventListener("click", () => {
  trackingMode = !trackingMode;
  const tb = document.getElementById("fp-track-btn");
  if (tb) { tb.classList.toggle("active", trackingMode); tb.textContent = trackingMode ? "📍 Tracking" : "📍 Track"; }
  if (trackingMode) { autoRotate = false; showToast("Tracking enabled"); }
  else              { autoRotate = true;  showToast("Tracking off"); }
});

// Copy button
document.getElementById("fp-copy-btn")?.addEventListener("click", () => {
  if (!selectedHex) return;
  const d = flightDataMap.get(selectedHex);
  if (!d) return;
  const text = [
    `Flight: ${d.flight || d.hex}`, `Aircraft: ${d.type || "?"}`,
    `Reg: ${d.reg || "?"}`, `Alt: ${d.alt} ft`, `Speed: ${d.spd} kts`,
    `Heading: ${d.hdg}°`, `Lat/Lon: ${d.lat.toFixed(4)}, ${d.lon.toFixed(4)}`,
    `Source: ${d.source}`
  ].join("\n");
  navigator.clipboard?.writeText(text).then(() => showToast("Copied!"));
});

// ═══════════════════════════════════════════════════════════
//  LEGEND
// ═══════════════════════════════════════════════════════════
function buildLegend() {
  const legend = document.getElementById("alt-legend");
  if (!legend) return;
  const tiers = [
    { label: "Ground",    color: "#aaaaaa" },
    { label: "< 5k ft",   color: "#00cc44" },
    { label: "5–15k ft",  color: "#00ddff" },
    { label: "15–25k ft", color: "#ffdd00" },
    { label: "25–35k ft", color: "#ff8800" },
    { label: "> 35k ft",  color: "#ff3333" },
  ];
  legend.innerHTML = tiers.map(t =>
    `<div class="legend-item">
       <span class="legend-dot" style="background:${t.color}"></span>
       <span>${t.label}</span>
     </div>`
  ).join("");
}
buildLegend();

// ═══════════════════════════════════════════════════════════
//  FLIGHT SERIES
// ═══════════════════════════════════════════════════════════
const flightSeries = chart.series.push(
  am5map.MapPointSeries.new(root, { latitudeField: "latitude", longitudeField: "longitude" })
);
const flightDataMap = new Map();

flightSeries.bullets.push((root, series, dataItem) => {
  const ctx    = dataItem.dataContext;
  const hdg    = ctx?.hdg ?? 0;
  const cached = ctx?.hex ? flightDataMap.get(ctx.hex) : null;
  const colors = planeColor(cached || { alt: ctx?.alt ?? 0, spd: 0, source: "" });

  const plane = am5.Graphics.new(root, {
    svgPath: PLANE_SVG,
    fill: am5.color(colors.fill), stroke: am5.color(colors.stroke),
    strokeWidth: 0.5, scale: 0.9,
    centerX: am5.p50, centerY: am5.p50,
    rotation: hdg, cursorOverStyle: "pointer"
  });

  const tooltip = am5.Tooltip.new(root, {
    getFillFromSprite: false, autoTextColor: false,
    paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 12,
    background: am5.RoundedRectangle.new(root, {
      fill: am5.color(0x050f1e), fillOpacity: 0.97,
      stroke: am5.color(0x00eeff), strokeWidth: 1,
      cornerRadiusTL: 6, cornerRadiusTR: 6, cornerRadiusBL: 6, cornerRadiusBR: 6
    })
  });
  tooltip.label.setAll({ fontSize: 12, fontWeight: "700", fill: am5.color(0xffffff) });
  plane.set("tooltip", tooltip);

  plane.events.on("pointerover", () => {
    const hex  = dataItem.dataContext?.hex;
    const data = hex ? flightDataMap.get(hex) : null;
    plane.set("scale", 1.5);
    plane.set("fill",   am5.color(0xffffff));
    plane.set("stroke", am5.color(0x00eeff));
    if (data) {
      const route = data.origin && data.dest ? `${data.origin} → ${data.dest}` : "";
      plane.set("tooltipText", [
        data.flight || data.hex || "",
        data.type   ? `✈ ${data.type}${data.reg ? "  ·  " + data.reg : ""}` : "",
        data.alt    ? `⬆ ${Math.round(data.alt).toLocaleString()} ft` : "",
        data.spd    ? `⚡ ${Math.round(data.spd)} kts` : "",
        route
      ].filter(Boolean).join("\n"));
    }
  });

  plane.events.on("pointerout", () => {
    const hex   = dataItem.dataContext?.hex;
    const full  = hex ? flightDataMap.get(hex) : null;
    const isSel = hex === selectedHex;
    plane.set("scale", 0.9);
    if (isSel) {
      plane.set("fill",   am5.color(0xffffff));
      plane.set("stroke", am5.color(0x00eeff));
    } else {
      const c = planeColor(full || { alt: ctx?.alt ?? 0, spd: 0, source: "" });
      plane.set("fill",   am5.color(c.fill));
      plane.set("stroke", am5.color(c.stroke));
    }
  });

  plane.events.on("click", () => {
    const hex = dataItem.dataContext?.hex;
    if (hex) showFlightPanel(flightDataMap.get(hex) || {});
  });

  return am5.Bullet.new(root, { sprite: plane });
});

// ═══════════════════════════════════════════════════════════
//  SMOOTH MOVEMENT
// ═══════════════════════════════════════════════════════════
const smoothHandles = new Map();

function smoothMoveTo(dataItem, hex, toLat, toLon) {
  if (smoothHandles.has(hex)) { clearInterval(smoothHandles.get(hex)); smoothHandles.delete(hex); }
  const fromLat = dataItem.get("latitude")  ?? toLat;
  const fromLon = dataItem.get("longitude") ?? toLon;
  if (fromLat === toLat && fromLon === toLon) return;
  if (Math.abs(toLon - fromLon) > 180) {
    dataItem.set("latitude", toLat); dataItem.set("longitude", toLon); return;
  }
  const steps = 45, interval = Math.floor(UPDATE_MS / steps);
  let step = 0;
  const handle = setInterval(() => {
    step++;
    const t   = step / steps;
    const lat = fromLat + (toLat - fromLat) * t;
    const lon = fromLon + (toLon - fromLon) * t;
    try {
      dataItem.set("latitude", lat); dataItem.set("longitude", lon);
      if (hex === selectedHex) {
        const p = flightDataMap.get(hex);
        if (p) { p.lat = lat; p.lon = lon; }
        if (trackingMode) {
          chart.set("rotationX", -lon);
          chart.set("rotationY", -lat);
        }
      }
    } catch (_) {}
    if (step >= steps) { clearInterval(handle); smoothHandles.delete(hex); }
  }, interval);
  smoothHandles.set(hex, handle);
}

// ═══════════════════════════════════════════════════════════
//  APPLY FLIGHT DATA
// ═══════════════════════════════════════════════════════════
let isFirstLoad = true;
const dataItemMap = new Map();

function applyFlightData(rawFlights) {
  // Record altitude history
  rawFlights.forEach(p => { if (p.hex && p.alt != null) recordAlt(p.hex, p.alt); });

  // Apply filters
  const flights = rawFlights.filter(matchesFilter);
  const sorted  = [...flights].sort((a, b) => (b.alt || 0) - (a.alt || 0));
  const visible = sorted.slice(0, MAX_PLANES);

  flightDataMap.clear();
  visible.forEach(p => flightDataMap.set(p.hex, p));

  updateStats(rawFlights);
  updateMiniStats(visible);

  // If selected flight no longer visible, update panel anyway
  if (selectedHex && !flightDataMap.has(selectedHex)) {
    // keep arc, just update sparkline
  }
  if (selectedHex && flightDataMap.has(selectedHex)) {
    const d = flightDataMap.get(selectedHex);
    document.getElementById("fp-alt-val").textContent = d.alt != null ? `${Math.round(d.alt).toLocaleString()}` : "—";
    document.getElementById("fp-spd-val").textContent = d.spd != null ? `${Math.round(d.spd)}` : "—";
    document.getElementById("fp-hdg-val").textContent = d.hdg != null ? `${Math.round(d.hdg)}°` : "—";
    drawAltSparkline(selectedHex);
  }

  if (isFirstLoad) {
    flightSeries.data.setAll(visible.map(p => ({
      latitude: p.lat, longitude: p.lon,
      hex: p.hex, hdg: p.hdg ?? 0, flight: p.flight || "", alt: p.alt ?? 0
    })));
    setTimeout(() => {
      flightSeries.dataItems.forEach(di => {
        const hex = di.dataContext?.hex;
        if (hex) dataItemMap.set(hex, di);
      });
      isFirstLoad = false;
    }, 500);
    return;
  }

  const visibleHexes = new Set(visible.map(p => p.hex));
  const toAdd = [];

  visible.forEach(p => {
    const di = dataItemMap.get(p.hex);
    if (di) {
      smoothMoveTo(di, p.hex, p.lat, p.lon);
      const sprite = di.bullets?.[0]?.get("sprite");
      if (sprite) {
        sprite.set("rotation", p.hdg ?? 0);
        if (p.hex !== selectedHex) {
          const c = planeColor(p);
          sprite.set("fill",   am5.color(c.fill));
          sprite.set("stroke", am5.color(c.stroke));
        }
      }
    } else {
      toAdd.push(p);
    }
  });

  dataItemMap.forEach((di, hex) => {
    if (!visibleHexes.has(hex)) {
      const idx = flightSeries.dataItems.indexOf(di);
      if (idx !== -1) { try { flightSeries.data.removeIndex(idx); } catch (_) {} }
      dataItemMap.delete(hex);
      if (smoothHandles.has(hex)) { clearInterval(smoothHandles.get(hex)); smoothHandles.delete(hex); }
    }
  });

  toAdd.forEach(p => {
    const di = flightSeries.pushDataItem({
      latitude: p.lat, longitude: p.lon,
      hex: p.hex, hdg: p.hdg ?? 0, flight: p.flight || "", alt: p.alt ?? 0
    });
    dataItemMap.set(p.hex, di);
  });
}

// ═══════════════════════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════════════════════
function updateMiniStats(flights) {
  const inAir  = flights.filter(f => f.alt > 0).length;
  const ground = flights.length - inAir;
  document.getElementById("flight-count").textContent = `${flights.length.toLocaleString()} flights`;
  const ea = document.getElementById("stat-inair");
  const eg = document.getElementById("stat-ground");
  if (ea) ea.textContent = inAir.toLocaleString();
  if (eg) eg.textContent = ground.toLocaleString();
}

function updateStats(flights) {
  const inAir  = flights.filter(f => f.alt > 0);
  const ground = flights.filter(f => f.alt <= 0);

  const avgAlt = inAir.length ? Math.round(inAir.reduce((s, f) => s + f.alt, 0) / inAir.length) : 0;
  const avgSpd = inAir.length ? Math.round(inAir.reduce((s, f) => s + (f.spd || 0), 0) / inAir.length) : 0;
  const maxAlt = inAir.length ? Math.max(...inAir.map(f => f.alt)) : 0;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("sc-total",    flights.length.toLocaleString());
  set("sc-airborne", inAir.length.toLocaleString());
  set("sc-ground",   ground.length.toLocaleString());
  set("sc-avgalt",   avgAlt.toLocaleString());
  set("sc-avgspd",   avgSpd + " kts");
  set("sc-highalt",  maxAlt.toLocaleString());

  // Altitude distribution bars
  const buckets = [
    { label: "Ground",  min: 0,     max: 0,     color: "#aaaaaa" },
    { label: "< 5k",    min: 1,     max: 5000,  color: "#00cc44" },
    { label: "5–15k",   min: 5000,  max: 15000, color: "#00ddff" },
    { label: "15–25k",  min: 15000, max: 25000, color: "#ffdd00" },
    { label: "25–35k",  min: 25000, max: 35000, color: "#ff8800" },
    { label: "> 35k",   min: 35000, max: Infinity, color: "#ff3333" },
  ];
  const barsEl = document.getElementById("dist-alt-bars");
  if (barsEl) {
    const counts = buckets.map(b => ({
      ...b,
      count: flights.filter(f =>
        b.max === 0 ? f.alt <= 0 : f.alt > b.min && f.alt <= b.max
      ).length
    }));
    const maxCount = Math.max(...counts.map(c => c.count), 1);
    barsEl.innerHTML = counts.map(b =>
      `<div class="dist-bar-row">
        <span class="dist-bar-lbl">${b.label}</span>
        <div class="dist-bar-track">
          <div class="dist-bar-fill" style="width:${(b.count/maxCount*100).toFixed(1)}%;background:${b.color}"></div>
        </div>
        <span class="dist-bar-count">${b.count}</span>
       </div>`
    ).join("");
  }

  // Top aircraft types
  const typesEl = document.getElementById("top-types");
  if (typesEl) {
    const typeCounts = {};
    flights.forEach(f => {
      const t = (f.type || "Unknown").substring(0, 4) || "?";
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    const top = Object.entries(typeCounts).sort((a,b) => b[1]-a[1]).slice(0, 6);
    const maxT = top[0]?.[1] || 1;
    typesEl.innerHTML = top.map(([type, count]) =>
      `<div class="top-type-row">
        <span class="top-type-name">${type}</span>
        <div class="top-type-bar-wrap"><div class="top-type-bar" style="width:${(count/maxT*100).toFixed(1)}%"></div></div>
        <span class="top-type-count">${count}</span>
       </div>`
    ).join("");
  }

  // Sources
  const srcEl = document.getElementById("top-sources");
  if (srcEl) {
    const srcCounts = {};
    flights.forEach(f => { const s = f.source || "unknown"; srcCounts[s] = (srcCounts[s] || 0) + 1; });
    const srcTop = Object.entries(srcCounts).sort((a,b) => b[1]-a[1]);
    const maxS   = srcTop[0]?.[1] || 1;
    const srcColors = { adsb: "#00eeff", opensky: "#aa88ff", unknown: "#aaaaaa" };
    srcEl.innerHTML = srcTop.map(([src, count]) =>
      `<div class="top-type-row">
        <span class="top-type-name" style="color:${srcColors[src]||'#aaa'}">${src}</span>
        <div class="top-type-bar-wrap"><div class="top-type-bar" style="width:${(count/maxS*100).toFixed(1)}%;background:${srcColors[src]||'#aaa'}"></div></div>
        <span class="top-type-count">${count}</span>
       </div>`
    ).join("");
  }
}

// ═══════════════════════════════════════════════════════════
//  SEARCH
// ═══════════════════════════════════════════════════════════
function doSearch(q, resultsEl) {
  resultsEl.innerHTML = "";
  if (!q || q.length < 2) { resultsEl.style.display = "none"; return; }
  q = q.toUpperCase();

  const matches = [];
  flightDataMap.forEach(p => {
    if (
      (p.flight && p.flight.includes(q)) ||
      (p.reg    && p.reg.toUpperCase().includes(q)) ||
      (p.hex    && p.hex.toUpperCase().includes(q)) ||
      (p.type   && p.type.toUpperCase().includes(q))
    ) matches.push(p);
    if (matches.length >= 8) return;
  });

  if (!matches.length) { resultsEl.style.display = "none"; return; }

  matches.forEach(p => {
    const c = planeColor(p);
    const div = document.createElement("div");
    div.className = "search-result-item";
    div.innerHTML = `
      <span class="sr-dot" style="background:#${c.fill.toString(16).padStart(6,'0')}"></span>
      <span class="sr-flight">${p.flight || p.hex}</span>
      <span class="sr-detail">${p.type || ""} ${p.origin && p.dest ? `${p.origin}→${p.dest}` : ""}</span>
      <span class="sr-alt">${p.alt ? Math.round(p.alt / 1000) + "k ft" : ""}</span>
    `;
    div.addEventListener("click", () => {
      resultsEl.style.display = "none";
      showFlightPanel(p);
    });
    resultsEl.appendChild(div);
  });
  resultsEl.style.display = "block";
}

const searchInput   = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
searchInput?.addEventListener("input", e => doSearch(e.target.value.trim(), searchResults));
document.addEventListener("click", e => {
  if (!e.target.closest("#search-box")) searchResults.style.display = "none";
});

// ═══════════════════════════════════════════════════════════
//  PANEL MANAGEMENT
// ═══════════════════════════════════════════════════════════
function openPanel(id) {
  ["filter-panel","layers-panel","stats-panel"].forEach(pid => {
    const el = document.getElementById(pid);
    if (el) el.classList.toggle("open", pid === id);
  });
  ["btn-filters","btn-layers","btn-stats"].forEach(bid => {
    const el = document.getElementById(bid);
    if (el) el.classList.remove("active");
  });
  const map = { "filter-panel": "btn-filters", "layers-panel": "btn-layers", "stats-panel": "btn-stats" };
  const btn = document.getElementById(map[id]);
  if (btn) btn.classList.toggle("active", document.getElementById(id)?.classList.contains("open") ?? false);
}

document.getElementById("btn-filters")?.addEventListener("click", () => openPanel("filter-panel"));
document.getElementById("btn-layers")?.addEventListener("click",  () => openPanel("layers-panel"));
document.getElementById("btn-stats")?.addEventListener("click",   () => openPanel("stats-panel"));

document.querySelectorAll(".panel-close").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-target");
    document.getElementById(target)?.classList.remove("open");
    const map = { "filter-panel": "btn-filters", "layers-panel": "btn-layers", "stats-panel": "btn-stats" };
    document.getElementById(map[target])?.classList.remove("active");
  });
});

// ═══════════════════════════════════════════════════════════
//  FILTER UI WIRING
// ═══════════════════════════════════════════════════════════
function wireFilters() {
  const altMinEl = document.getElementById("alt-min");
  const altMaxEl = document.getElementById("alt-max");
  const spdMinEl = document.getElementById("spd-min");
  const spdMaxEl = document.getElementById("spd-max");

  const fmt = (v, unit) => `${parseInt(v).toLocaleString()} ${unit}`;

  altMinEl?.addEventListener("input", e => {
    filters.altMin = parseInt(e.target.value);
    document.getElementById("alt-min-val").textContent = fmt(e.target.value, "ft");
    updateFilterBadge();
  });
  altMaxEl?.addEventListener("input", e => {
    filters.altMax = parseInt(e.target.value);
    document.getElementById("alt-max-val").textContent = fmt(e.target.value, "ft");
    updateFilterBadge();
  });
  spdMinEl?.addEventListener("input", e => {
    filters.spdMin = parseInt(e.target.value);
    document.getElementById("spd-min-val").textContent = fmt(e.target.value, "kts");
    updateFilterBadge();
  });
  spdMaxEl?.addEventListener("input", e => {
    filters.spdMax = parseInt(e.target.value);
    document.getElementById("spd-max-val").textContent = fmt(e.target.value, "kts");
    updateFilterBadge();
  });

  document.getElementById("filter-airborne")?.addEventListener("change", e => {
    filters.airborne = e.target.checked; updateFilterBadge();
  });
  document.getElementById("filter-ground")?.addEventListener("change", e => {
    filters.ground = e.target.checked; updateFilterBadge();
  });

  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      filters.typePrefix = chip.getAttribute("data-type");
      updateFilterBadge();
    });
  });

  document.getElementById("reset-filters")?.addEventListener("click", () => {
    filters.altMin = 0; filters.altMax = 45000;
    filters.spdMin = 0; filters.spdMax = 700;
    filters.typePrefix = "all"; filters.airborne = true; filters.ground = true;
    if (altMinEl) altMinEl.value = 0;
    if (altMaxEl) altMaxEl.value = 45000;
    if (spdMinEl) spdMinEl.value = 0;
    if (spdMaxEl) spdMaxEl.value = 700;
    document.getElementById("alt-min-val").textContent = "0 ft";
    document.getElementById("alt-max-val").textContent = "45,000 ft";
    document.getElementById("spd-min-val").textContent = "0 kts";
    document.getElementById("spd-max-val").textContent = "700 kts";
    document.getElementById("filter-airborne").checked = true;
    document.getElementById("filter-ground").checked   = true;
    document.querySelectorAll(".chip").forEach(c => {
      c.classList.toggle("active", c.getAttribute("data-type") === "all");
    });
    updateFilterBadge();
    showToast("Filters reset");
  });
}
wireFilters();

// ═══════════════════════════════════════════════════════════
//  LAYER TOGGLES
// ═══════════════════════════════════════════════════════════
const layerStates = { airports: true, daynight: true, labels: true, rotate: true };

document.getElementById("layer-airports")?.addEventListener("change", e => {
  layerStates.airports = e.target.checked;
  airportSeries.set("visible", e.target.checked);
});
document.getElementById("layer-daynight")?.addEventListener("change", e => {
  layerStates.daynight = e.target.checked;
  sunSeries.set("visible", e.target.checked);
  polygonSeries.markDirtyValues();
});
document.getElementById("layer-labels")?.addEventListener("change", e => {
  layerStates.labels = e.target.checked;
  labelSeries.set("visible", e.target.checked);
});
document.getElementById("layer-rotate")?.addEventListener("change", e => {
  layerStates.rotate = e.target.checked;
  autoRotate = e.target.checked;
});

// Colour mode
document.querySelectorAll(".cmode").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cmode").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    colourMode = btn.getAttribute("data-mode");
    showToast(`Colour: ${colourMode}`);
    // Force re-colour all visible planes
    dataItemMap.forEach((di, hex) => {
      const sprite = di.bullets?.[0]?.get("sprite");
      if (!sprite || hex === selectedHex) return;
      const p = flightDataMap.get(hex);
      if (!p) return;
      const c = planeColor(p);
      sprite.set("fill",   am5.color(c.fill));
      sprite.set("stroke", am5.color(c.stroke));
    });
  });
});

// ═══════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════
function showToast(msg, dur = 1800) {
  const el = document.getElementById("shortcut-toast");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = "none"; }, dur);
}

document.addEventListener("keydown", e => {
  const tag = document.activeElement?.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea") {
    // Only the "/" key opens search
    if (e.key === "/" && tag !== "input") {
      e.preventDefault();
      searchInput?.focus();
      showToast("/ — search");
    }
    return;
  }
  switch (e.key) {
    case "/":
      e.preventDefault();
      searchInput?.focus();
      showToast("/ — search");
      break;
    case "f": case "F":
      openPanel("filter-panel");
      showToast("F — Filters");
      break;
    case "l": case "L":
      openPanel("layers-panel");
      showToast("L — Layers");
      break;
    case "d": case "D":
      openPanel("stats-panel");
      showToast("D — Dashboard");
      break;
    case "Escape":
      ["filter-panel","layers-panel","stats-panel"].forEach(id =>
        document.getElementById(id)?.classList.remove("open")
      );
      panel?.classList.remove("visible");
      clearArc(); selectedHex = null; trackingMode = false;
      searchResults.style.display = "none";
      break;
    case "r": case "R":
      autoRotate = !autoRotate;
      const rc = document.getElementById("layer-rotate");
      if (rc) rc.checked = autoRotate;
      showToast(autoRotate ? "R — Rotate ON" : "R — Rotate OFF");
      break;
    case "+": case "=":
      chart.zoomIn();
      break;
    case "-":
      chart.zoomOut();
      break;
    case "t": case "T":
      if (selectedHex) {
        trackingMode = !trackingMode;
        showToast(trackingMode ? "T — Tracking ON" : "T — Tracking OFF");
        if (!trackingMode) autoRotate = true;
      }
      break;
  }
});

// ═══════════════════════════════════════════════════════════
//  RIGHT-CLICK CONTEXT MENU
// ═══════════════════════════════════════════════════════════
let ctxLat = 0, ctxLon = 0;
const ctxMenu = document.getElementById("ctx-menu");

document.getElementById("chartdiv")?.addEventListener("contextmenu", e => {
  e.preventDefault();
  const point = chart.invert({ x: e.clientX, y: e.clientY });
  if (point) { ctxLat = point.latitude ?? 0; ctxLon = point.longitude ?? 0; }
  ctxMenu.style.left = `${e.clientX}px`;
  ctxMenu.style.top  = `${e.clientY}px`;
  ctxMenu.classList.add("visible");
});

document.addEventListener("click", e => {
  if (!e.target.closest("#ctx-menu")) ctxMenu.classList.remove("visible");
});

document.getElementById("ctx-copy-pos")?.addEventListener("click", () => {
  const text = `${ctxLat.toFixed(4)}, ${ctxLon.toFixed(4)}`;
  navigator.clipboard?.writeText(text).then(() => showToast("📌 " + text));
  ctxMenu.classList.remove("visible");
});

document.getElementById("ctx-centre")?.addEventListener("click", () => {
  autoRotate = false;
  chart.animate({ key: "rotationX", to: -ctxLon, duration: 600, easing: am5.ease.out(am5.ease.cubic) });
  chart.animate({ key: "rotationY", to: -ctxLat, duration: 600, easing: am5.ease.out(am5.ease.cubic) });
  setTimeout(() => { autoRotate = true; }, 3000);
  ctxMenu.classList.remove("visible");
  showToast("🎯 Centred");
});

document.getElementById("ctx-open-stats")?.addEventListener("click", () => {
  openPanel("stats-panel");
  ctxMenu.classList.remove("visible");
});

// ═══════════════════════════════════════════════════════════
//  MOBILE
// ═══════════════════════════════════════════════════════════
const hamburger  = document.getElementById("hamburger");
const mobileMenu = document.getElementById("mobile-menu");
hamburger?.addEventListener("click", () => mobileMenu?.classList.toggle("open"));

// Force close ALL panels on mobile load — globe must be visible first
if (window.innerWidth <= 768) {
  document.querySelectorAll(".side-panel, .wide-panel").forEach(p => {
    p.classList.remove("open");
  });
  const fp = document.getElementById("flight-panel");
  if (fp) fp.classList.remove("visible");
  if (mobileMenu) mobileMenu.classList.remove("open");
}

document.querySelectorAll(".mob-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const panel = btn.getAttribute("data-panel");
    mobileMenu?.classList.remove("open");
    openPanel(panel);
  });
});

// ═══════════════════════════════════════════════════════════
//  WEBSOCKET
// ═══════════════════════════════════════════════════════════
function connectWS() {
  const ws = new WebSocket(WS_URL);
  const statusEl = document.getElementById("ws-status");

  ws.onopen = () => {
    if (statusEl) { statusEl.textContent = "● LIVE"; statusEl.className = "ws-badge live"; }
  };
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "flights"  && Array.isArray(msg.data)) applyFlightData(msg.data);
      if (msg.type === "airports" && Array.isArray(msg.data)) loadAirports(msg.data);
    } catch (err) { console.error("WS parse error:", err); }
  };
  ws.onclose = () => {
    if (statusEl) { statusEl.textContent = "● RECONNECTING"; statusEl.className = "ws-badge reconnect"; }
    setTimeout(connectWS, 3000);
  };
  ws.onerror = () => ws.close();
}
connectWS();

// ═══════════════════════════════════════════════════════════
//  TIME CONTROLS
// ═══════════════════════════════════════════════════════════
const timeline  = document.getElementById("timeline");
const timeLabel = document.getElementById("timeLabel");
const playBtn   = document.getElementById("play");
let playing = false, liveInterval = null, userInteracting = false;

const pad = n => String(n).padStart(2, "0");
function formatIST(date) {
  const ist    = new Date(date.getTime() + 5.5 * 3600000);
  const days   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${days[ist.getUTCDay()]}, ${pad(ist.getUTCDate())} ${months[ist.getUTCMonth()]} ${ist.getUTCFullYear()} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())} IST`;
}

function startLiveClock() {
  if (liveInterval) clearInterval(liveInterval);
  liveInterval = setInterval(() => {
    if (!playing && !userInteracting) {
      const now = new Date();
      updateScene(now);
      if (timeLabel) timeLabel.innerText = formatIST(now);
      if (timeline)  timeline.value = 0;
    }
  }, 1000);
}

let interactionTimeout;
timeline?.addEventListener("mousedown", () => { userInteracting = true; });
timeline?.addEventListener("mouseup", () => {
  clearTimeout(interactionTimeout);
  interactionTimeout = setTimeout(() => { userInteracting = false; }, 3000);
});
timeline?.addEventListener("input", e => {
  userInteracting = true;
  clearTimeout(interactionTimeout);
  const d = new Date(Date.now() + parseInt(e.target.value) * 3600000);
  updateScene(d);
  if (timeLabel) timeLabel.innerText = formatIST(d);
  interactionTimeout = setTimeout(() => { userInteracting = false; if (timeline) timeline.value = 0; }, 3000);
});

if (playBtn) {
  playBtn.onclick = () => {
    playing = !playing;
    playBtn.textContent = playing ? "⏸ Pause" : "▶ Play";
    if (playing) { userInteracting = false; animateTime(); }
  };
}

function animateTime() {
  if (!playing) return;
  let v = parseInt(timeline.value);
  v = v >= 48 ? -48 : v + 1;
  timeline.value = v;
  const d = new Date(Date.now() + v * 3600000);
  updateScene(d);
  if (timeLabel) timeLabel.innerText = formatIST(d);
  setTimeout(() => requestAnimationFrame(animateTime), 150);
}

// Live button (injected)
const resetBtn = document.createElement("button");
resetBtn.textContent = "⏺ Live"; resetBtn.id = "reset";
document.querySelector(".controls")?.insertBefore(resetBtn, document.querySelector(".controls")?.firstChild);
resetBtn.onclick = () => {
  playing = false;
  if (playBtn) playBtn.textContent = "▶ Play";
  userInteracting = false;
  if (timeline) timeline.value = 0;
  const now = new Date();
  updateScene(now);
  if (timeLabel) timeLabel.innerText = formatIST(now);
};

// ═══════════════════════════════════════════════════════════
//  FLIGHT SEARCH (injected)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
//  FLIGHT SEARCH ENGINE
// ═══════════════════════════════════════════════════════════

// Extended airport database (IATA → full name + city)
const AIRPORT_DB = [
  { iata:"DEL", name:"Indira Gandhi Intl",        city:"Delhi",         country:"India" },
  { iata:"BOM", name:"Chhatrapati Shivaji Intl",  city:"Mumbai",        country:"India" },
  { iata:"MAA", name:"Chennai Intl",               city:"Chennai",       country:"India" },
  { iata:"BLR", name:"Kempegowda Intl",            city:"Bengaluru",     country:"India" },
  { iata:"HYD", name:"Rajiv Gandhi Intl",          city:"Hyderabad",     country:"India" },
  { iata:"CCU", name:"Netaji Subhas Chandra Bose", city:"Kolkata",       country:"India" },
  { iata:"COK", name:"Cochin Intl",                city:"Kochi",         country:"India" },
  { iata:"AMD", name:"Sardar Vallabhbhai Patel",   city:"Ahmedabad",     country:"India" },
  { iata:"GOI", name:"Goa Intl",                   city:"Goa",           country:"India" },
  { iata:"PNQ", name:"Pune Intl",                  city:"Pune",          country:"India" },
  { iata:"LKO", name:"Chaudhary Charan Singh",     city:"Lucknow",       country:"India" },
  { iata:"JAI", name:"Jaipur Intl",                city:"Jaipur",        country:"India" },
  { iata:"IXB", name:"Bagdogra",                   city:"Siliguri",      country:"India" },
  { iata:"VNS", name:"Lal Bahadur Shastri",        city:"Varanasi",      country:"India" },
  { iata:"PAT", name:"Jay Prakash Narayan",        city:"Patna",         country:"India" },
  { iata:"DXB", name:"Dubai Intl",                 city:"Dubai",         country:"UAE"   },
  { iata:"AUH", name:"Abu Dhabi Intl",             city:"Abu Dhabi",     country:"UAE"   },
  { iata:"DOH", name:"Hamad Intl",                 city:"Doha",          country:"Qatar" },
  { iata:"RUH", name:"King Khalid Intl",           city:"Riyadh",        country:"Saudi Arabia" },
  { iata:"JED", name:"King Abdulaziz Intl",        city:"Jeddah",        country:"Saudi Arabia" },
  { iata:"LHR", name:"Heathrow",                   city:"London",        country:"UK"    },
  { iata:"LGW", name:"Gatwick",                    city:"London",        country:"UK"    },
  { iata:"CDG", name:"Charles de Gaulle",          city:"Paris",         country:"France"},
  { iata:"FRA", name:"Frankfurt Intl",             city:"Frankfurt",     country:"Germany" },
  { iata:"AMS", name:"Schiphol",                   city:"Amsterdam",     country:"Netherlands" },
  { iata:"IST", name:"Istanbul Intl",              city:"Istanbul",      country:"Turkey"},
  { iata:"SIN", name:"Changi",                     city:"Singapore",     country:"Singapore" },
  { iata:"BKK", name:"Suvarnabhumi",               city:"Bangkok",       country:"Thailand" },
  { iata:"KUL", name:"Kuala Lumpur Intl",          city:"Kuala Lumpur",  country:"Malaysia" },
  { iata:"HKG", name:"Hong Kong Intl",             city:"Hong Kong",     country:"Hong Kong" },
  { iata:"NRT", name:"Narita Intl",                city:"Tokyo",         country:"Japan" },
  { iata:"HND", name:"Haneda",                     city:"Tokyo",         country:"Japan" },
  { iata:"ICN", name:"Incheon Intl",               city:"Seoul",         country:"South Korea" },
  { iata:"PEK", name:"Capital Intl",               city:"Beijing",       country:"China" },
  { iata:"PVG", name:"Pudong Intl",                city:"Shanghai",      country:"China" },
  { iata:"SYD", name:"Kingsford Smith",            city:"Sydney",        country:"Australia" },
  { iata:"MEL", name:"Melbourne Intl",             city:"Melbourne",     country:"Australia" },
  { iata:"JFK", name:"John F Kennedy Intl",        city:"New York",      country:"USA"   },
  { iata:"LAX", name:"Los Angeles Intl",           city:"Los Angeles",   country:"USA"   },
  { iata:"ORD", name:"O'Hare Intl",                city:"Chicago",       country:"USA"   },
  { iata:"ATL", name:"Hartsfield-Jackson",         city:"Atlanta",       country:"USA"   },
  { iata:"SFO", name:"San Francisco Intl",         city:"San Francisco", country:"USA"   },
  { iata:"MIA", name:"Miami Intl",                 city:"Miami",         country:"USA"   },
  { iata:"YYZ", name:"Pearson Intl",               city:"Toronto",       country:"Canada"},
  { iata:"GRU", name:"Guarulhos Intl",             city:"São Paulo",     country:"Brazil"},
  { iata:"EZE", name:"Ministro Pistarini",         city:"Buenos Aires",  country:"Argentina" },
  { iata:"JNB", name:"OR Tambo Intl",              city:"Johannesburg",  country:"South Africa" },
  { iata:"NBO", name:"Jomo Kenyatta Intl",         city:"Nairobi",       country:"Kenya" },
  { iata:"CAI", name:"Cairo Intl",                 city:"Cairo",         country:"Egypt" },
  { iata:"CPH", name:"Copenhagen Intl",            city:"Copenhagen",    country:"Denmark" },
  { iata:"ARN", name:"Arlanda Intl",               city:"Stockholm",     country:"Sweden"},
  { iata:"ZRH", name:"Zurich Intl",                city:"Zurich",        country:"Switzerland" },
  { iata:"VIE", name:"Vienna Intl",                city:"Vienna",        country:"Austria" },
  { iata:"MAD", name:"Adolfo Suárez Barajas",      city:"Madrid",        country:"Spain" },
  { iata:"BCN", name:"El Prat",                    city:"Barcelona",     country:"Spain" },
  { iata:"FCO", name:"Fiumicino",                  city:"Rome",          country:"Italy" },
  { iata:"MXP", name:"Malpensa",                   city:"Milan",         country:"Italy" },
];

// Merge server-sent airports into DB
let fsFromCode = ""; let fsToCode = "";
function mergeServerAirports(list) {
  list.forEach(a => {
    if (!AIRPORT_DB.find(x => x.iata === a.iata)) {
      AIRPORT_DB.push({ iata: a.iata, name: a.name, city: a.name, country: "" });
    }
  });
}

// ── Airport search — live query against free OpenFlights data ──
// We use a bundled comprehensive DB for instant offline search
const FULL_AIRPORT_DB = [
  // India - All commercial airports
  {iata:"DEL",city:"Delhi",name:"Indira Gandhi Intl",country:"India"},
  {iata:"BOM",city:"Mumbai",name:"Chhatrapati Shivaji Intl",country:"India"},
  {iata:"BLR",city:"Bengaluru",name:"Kempegowda Intl",country:"India"},
  {iata:"MAA",city:"Chennai",name:"Chennai Intl",country:"India"},
  {iata:"HYD",city:"Hyderabad",name:"Rajiv Gandhi Intl",country:"India"},
  {iata:"CCU",city:"Kolkata",name:"Netaji Subhas Intl",country:"India"},
  {iata:"COK",city:"Kochi",name:"Cochin Intl",country:"India"},
  {iata:"PNQ",city:"Pune",name:"Pune Intl",country:"India"},
  {iata:"AMD",city:"Ahmedabad",name:"Sardar Vallabhbhai Patel Intl",country:"India"},
  {iata:"GOI",city:"Goa",name:"Goa Dabolim Intl",country:"India"},
  {iata:"JAI",city:"Jaipur",name:"Jaipur Intl",country:"India"},
  {iata:"LKO",city:"Lucknow",name:"Chaudhary Charan Singh Intl",country:"India"},
  {iata:"VGA",city:"Vijayawada",name:"Vijayawada Intl",country:"India"},
  {iata:"VTZ",city:"Visakhapatnam",name:"Visakhapatnam Intl",country:"India"},
  {iata:"TRV",city:"Thiruvananthapuram",name:"Trivandrum Intl",country:"India"},
  {iata:"CJB",city:"Coimbatore",name:"Coimbatore Intl",country:"India"},
  {iata:"IXM",city:"Madurai",name:"Madurai Intl",country:"India"},
  {iata:"TIR",city:"Tirupati",name:"Tirupati Intl",country:"India"},
  {iata:"IXE",city:"Mangalore",name:"Mangalore Intl",country:"India"},
  {iata:"NAG",city:"Nagpur",name:"Dr Babasaheb Ambedkar Intl",country:"India"},
  {iata:"IXC",city:"Chandigarh",name:"Chandigarh Intl",country:"India"},
  {iata:"ATQ",city:"Amritsar",name:"Sri Guru Ram Dass Jee Intl",country:"India"},
  {iata:"SXR",city:"Srinagar",name:"Srinagar Intl",country:"India"},
  {iata:"IXB",city:"Bagdogra",name:"Bagdogra Intl",country:"India"},
  {iata:"GAU",city:"Guwahati",name:"Lokpriya Gopinath Bordoloi Intl",country:"India"},
  {iata:"VNS",city:"Varanasi",name:"Lal Bahadur Shastri Intl",country:"India"},
  {iata:"IXR",city:"Ranchi",name:"Birsa Munda Intl",country:"India"},
  {iata:"BBI",city:"Bhubaneswar",name:"Biju Patnaik Intl",country:"India"},
  {iata:"PAT",city:"Patna",name:"Jay Prakash Narayan Intl",country:"India"},
  {iata:"BHO",city:"Bhopal",name:"Raja Bhoj Intl",country:"India"},
  {iata:"IDR",city:"Indore",name:"Devi Ahilya Bai Holkar Intl",country:"India"},
  {iata:"RPR",city:"Raipur",name:"Swami Vivekananda Intl",country:"India"},
  {iata:"BDQ",city:"Vadodara",name:"Vadodara Intl",country:"India"},
  {iata:"STV",city:"Surat",name:"Surat Intl",country:"India"},
  {iata:"RAJ",city:"Rajkot",name:"Rajkot Intl",country:"India"},
  {iata:"JDH",city:"Jodhpur",name:"Jodhpur Intl",country:"India"},
  {iata:"UDR",city:"Udaipur",name:"Maharana Pratap Intl",country:"India"},
  {iata:"AGR",city:"Agra",name:"Agra Intl",country:"India"},
  {iata:"IXA",city:"Agartala",name:"Maharaja Bir Bikram Intl",country:"India"},
  {iata:"IMF",city:"Imphal",name:"Bir Tikendrajit Intl",country:"India"},
  {iata:"DIB",city:"Dibrugarh",name:"Dibrugarh Airport",country:"India"},
  {iata:"GOP",city:"Gorakhpur",name:"Gorakhpur Airport",country:"India"},
  {iata:"GWL",city:"Gwalior",name:"Gwalior Airport",country:"India"},
  {iata:"IXU",city:"Aurangabad",name:"Aurangabad Airport",country:"India"},
  {iata:"DED",city:"Dehradun",name:"Jolly Grant Airport",country:"India"},
  {iata:"IXL",city:"Leh",name:"Kushok Bakula Rimpochhe Airport",country:"India"},
  {iata:"HBX",city:"Hubli",name:"Hubli Airport",country:"India"},
  {iata:"RJA",city:"Rajahmundry",name:"Rajahmundry Airport",country:"India"},
  {iata:"KLH",city:"Kolhapur",name:"Kolhapur Airport",country:"India"},
  {iata:"NDC",city:"Nanded",name:"Nanded Airport",country:"India"},
  {iata:"NMB",city:"Daman",name:"Daman Airport",country:"India"},
  {iata:"PGH",city:"Pantnagar",name:"Pantnagar Airport",country:"India"},
  {iata:"SHL",city:"Shillong",name:"Shillong Airport",country:"India"},
  {iata:"IXS",city:"Silchar",name:"Kumbhirgram Airport",country:"India"},
  {iata:"JSA",city:"Jaisalmer",name:"Jaisalmer Airport",country:"India"},
  {iata:"IXD",city:"Allahabad",name:"Bamrauli Airport",country:"India"},
  {iata:"BHU",city:"Bhavnagar",name:"Bhavnagar Airport",country:"India"},
  {iata:"JGA",city:"Jamnagar",name:"Jamnagar Airport",country:"India"},
  {iata:"PYB",city:"Jeypore",name:"Jeypore Airport",country:"India"},
  {iata:"VDY",city:"Vidyanagar",name:"Jindal Vijayanagar Airport",country:"India"},
  {iata:"IXW",city:"Jamshedpur",name:"Sonari Airport",country:"India"},
  {iata:"DBR",city:"Darbhanga",name:"Darbhanga Airport",country:"India"},
  {iata:"HJR",city:"Khajuraho",name:"Khajuraho Airport",country:"India"},
  {iata:"TEZ",city:"Tezpur",name:"Tezpur Airport",country:"India"},
  {iata:"ZER",city:"Zero",name:"Ziro Airport",country:"India"},
  {iata:"IXV",city:"Along",name:"Along Airport",country:"India"},
  {iata:"LDA",city:"Malda",name:"Malda Airport",country:"India"},
  {iata:"BEK",city:"Bareilly",name:"Bareilly Airport",country:"India"},
  {iata:"KUU",city:"Kullu",name:"Bhuntar Airport",country:"India"},
  {iata:"SLV",city:"Shimla",name:"Shimla Airport",country:"India"},
  {iata:"DHM",city:"Dharamsala",name:"Kangra Airport",country:"India"},
  {iata:"IXH",city:"Kailashahar",name:"Kailashahar Airport",country:"India"},
  {iata:"IXT",city:"Pasighat",name:"Pasighat Airport",country:"India"},
  {iata:"MYQ",city:"Mysuru",name:"Mysore Airport",country:"India"},
  {iata:"BLH",city:"Bellary",name:"Bellary Airport",country:"India"},
  {iata:"WGC",city:"Warangal",name:"Warangal Airport",country:"India"},
  {iata:"CBD",city:"Car Nicobar",name:"Car Nicobar Airport",country:"India"},
  {iata:"IXZ",city:"Port Blair",name:"Veer Savarkar Intl",country:"India"},
  // International
  {iata:"DXB",city:"Dubai",name:"Dubai Intl",country:"UAE"},
  {iata:"DOH",city:"Doha",name:"Hamad Intl",country:"Qatar"},
  {iata:"AUH",city:"Abu Dhabi",name:"Abu Dhabi Intl",country:"UAE"},
  {iata:"LHR",city:"London",name:"Heathrow",country:"UK"},
  {iata:"CDG",city:"Paris",name:"Charles de Gaulle",country:"France"},
  {iata:"FRA",city:"Frankfurt",name:"Frankfurt Intl",country:"Germany"},
  {iata:"SIN",city:"Singapore",name:"Changi",country:"Singapore"},
  {iata:"BKK",city:"Bangkok",name:"Suvarnabhumi",country:"Thailand"},
  {iata:"KUL",city:"Kuala Lumpur",name:"KLIA",country:"Malaysia"},
  {iata:"HKG",city:"Hong Kong",name:"Hong Kong Intl",country:"China"},
  {iata:"ICN",city:"Seoul",name:"Incheon Intl",country:"South Korea"},
  {iata:"NRT",city:"Tokyo",name:"Narita Intl",country:"Japan"},
  {iata:"HND",city:"Tokyo",name:"Haneda",country:"Japan"},
  {iata:"SYD",city:"Sydney",name:"Kingsford Smith",country:"Australia"},
  {iata:"MEL",city:"Melbourne",name:"Tullamarine",country:"Australia"},
  {iata:"JFK",city:"New York",name:"John F Kennedy",country:"USA"},
  {iata:"LAX",city:"Los Angeles",name:"Los Angeles Intl",country:"USA"},
  {iata:"ORD",city:"Chicago",name:"O'Hare Intl",country:"USA"},
  {iata:"ATL",city:"Atlanta",name:"Hartsfield Jackson",country:"USA"},
  {iata:"SFO",city:"San Francisco",name:"San Francisco Intl",country:"USA"},
  {iata:"DFW",city:"Dallas",name:"Dallas Fort Worth",country:"USA"},
  {iata:"MIA",city:"Miami",name:"Miami Intl",country:"USA"},
  {iata:"CMB",city:"Colombo",name:"Bandaranaike Intl",country:"Sri Lanka"},
  {iata:"DAC",city:"Dhaka",name:"Hazrat Shahjalal Intl",country:"Bangladesh"},
  {iata:"KTM",city:"Kathmandu",name:"Tribhuvan Intl",country:"Nepal"},
  {iata:"RUH",city:"Riyadh",name:"King Khalid Intl",country:"Saudi Arabia"},
  {iata:"JED",city:"Jeddah",name:"King Abdulaziz Intl",country:"Saudi Arabia"},
  {iata:"MCT",city:"Muscat",name:"Muscat Intl",country:"Oman"},
  {iata:"KWI",city:"Kuwait City",name:"Kuwait Intl",country:"Kuwait"},
  {iata:"BAH",city:"Manama",name:"Bahrain Intl",country:"Bahrain"},
  {iata:"IST",city:"Istanbul",name:"Istanbul Intl",country:"Turkey"},
  {iata:"AMS",city:"Amsterdam",name:"Schiphol",country:"Netherlands"},
  {iata:"MAD",city:"Madrid",name:"Barajas",country:"Spain"},
  {iata:"BCN",city:"Barcelona",name:"El Prat",country:"Spain"},
  {iata:"MUC",city:"Munich",name:"Munich Intl",country:"Germany"},
  {iata:"ZRH",city:"Zurich",name:"Zurich Airport",country:"Switzerland"},
  {iata:"GRU",city:"São Paulo",name:"Guarulhos Intl",country:"Brazil"},
  {iata:"JNB",city:"Johannesburg",name:"OR Tambo Intl",country:"South Africa"},
  {iata:"CAI",city:"Cairo",name:"Cairo Intl",country:"Egypt"},
  {iata:"NBO",city:"Nairobi",name:"Jomo Kenyatta Intl",country:"Kenya"},
  {iata:"ADD",city:"Addis Ababa",name:"Bole Intl",country:"Ethiopia"},
  {iata:"PEK",city:"Beijing",name:"Capital Intl",country:"China"},
  {iata:"PVG",city:"Shanghai",name:"Pudong Intl",country:"China"},
  {iata:"CGK",city:"Jakarta",name:"Soekarno-Hatta Intl",country:"Indonesia"},
  {iata:"MNL",city:"Manila",name:"Ninoy Aquino Intl",country:"Philippines"},
  {iata:"YYZ",city:"Toronto",name:"Pearson Intl",country:"Canada"},
  {iata:"MEX",city:"Mexico City",name:"Juárez Intl",country:"Mexico"},
  {iata:"BOG",city:"Bogotá",name:"El Dorado Intl",country:"Colombia"},
];

// Merge FULL_AIRPORT_DB into AIRPORT_DB on init
FULL_AIRPORT_DB.forEach(a => {
  if (!AIRPORT_DB.find(x => x.iata === a.iata)) AIRPORT_DB.push(a);
});

function filterAirports(q) {
  if (!q || q.length < 1) return [];
  const u = q.toUpperCase();
  return AIRPORT_DB.filter(a =>
    a.iata.includes(u) ||
    (a.name  || "").toUpperCase().includes(u) ||
    (a.city  || "").toUpperCase().includes(u) ||
    (a.country || "").toUpperCase().includes(u)
  ).slice(0, 8);
}

function renderAptDropdown(dropEl, selectedEl, inputEl, list, onSelect) {
  dropEl.innerHTML = "";
  if (!list.length) { dropEl.style.display = "none"; return; }
  list.forEach(a => {
    const item = document.createElement("div");
    item.className = "fs-dropdown-item";
    item.innerHTML = `
      <span class="fsd-iata">${a.iata}</span>
      <span class="fsd-info">
        <span class="fsd-city">${a.city}</span>
        <span class="fsd-name">${a.name}</span>
      </span>
      <span class="fsd-country">${a.country}</span>`;
    item.addEventListener("mousedown", e => {
      e.preventDefault();
      inputEl.value = `${a.iata} — ${a.city}`;
      selectedEl.textContent = a.name;
      selectedEl.style.display = "block";
      dropEl.style.display = "none";
      onSelect(a.iata);
    });
    dropEl.appendChild(item);
  });
  dropEl.style.display = "block";
}

function wireAptInput(inputId, dropId, selectedId, onSelect) {
  const inp  = document.getElementById(inputId);
  const drop = document.getElementById(dropId);
  const sel  = document.getElementById(selectedId);
  if (!inp) return;
  inp.addEventListener("input", () => {
    const matches = filterAirports(inp.value.trim());
    renderAptDropdown(drop, sel, inp, matches, onSelect);
  });
  inp.addEventListener("blur", () => setTimeout(() => { if (drop) drop.style.display = "none"; }, 200));
  inp.addEventListener("focus", () => {
    const matches = filterAirports(inp.value.trim());
    renderAptDropdown(drop, sel, inp, matches, onSelect);
  });
}

wireAptInput("fs-from", "fs-from-dropdown", "fs-from-selected", code => { fsFromCode = code; });
wireAptInput("fs-to",   "fs-to-dropdown",   "fs-to-selected",   code => { fsToCode   = code; });

// ── Swap airports ────────────────────────────────────────────
document.getElementById("fs-swap")?.addEventListener("click", () => {
  const fi = document.getElementById("fs-from");
  const ti = document.getElementById("fs-to");
  const fs = document.getElementById("fs-from-selected");
  const ts = document.getElementById("fs-to-selected");
  if (!fi || !ti) return;
  [fi.value, ti.value] = [ti.value, fi.value];
  [fs.textContent, ts.textContent] = [ts.textContent, fs.textContent];
  [fsFromCode, fsToCode] = [fsToCode, fsFromCode];
});

// Default date to tomorrow
const fsDateInput = document.getElementById("fs-date");
if (fsDateInput) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  fsDateInput.value = tomorrow.toISOString().split("T")[0];
}

// ── Open / Close modal ────────────────────────────────────────
const fsOverlay = document.getElementById("flight-search-overlay");

const openFlightSearch = () => {
  if (fsOverlay) fsOverlay.classList.add("visible");
  document.getElementById("mobile-menu")?.classList.remove("open");
  // Scroll modal to top
  document.getElementById("flight-search-modal")?.scrollTo(0, 0);
};

document.getElementById("btn-flight-search")?.addEventListener("click", openFlightSearch);
document.getElementById("mob-fs-btn")?.addEventListener("click", openFlightSearch);

document.getElementById("fs-close")?.addEventListener("click", () => {
  if (fsOverlay) fsOverlay.classList.remove("visible");
});
fsOverlay?.addEventListener("click", e => {
  if (e.target === fsOverlay) fsOverlay.classList.remove("visible");
});

// ── Sort ─────────────────────────────────────────────────────
let fsSortMode = "price";
let fsLastResults = [];
document.querySelectorAll(".fs-sort-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".fs-sort-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    fsSortMode = btn.getAttribute("data-sort");
    if (fsLastResults.length) renderFlightResults(fsLastResults);
  });
});

// ── Parse SkyScanner response (v3 API) ──────────────────────
function parseSkyScanner(data) {
  const source       = data?.source || "";
  const isGoogleData = source === "google_flights";

  const itineraries = data?.data?.itineraries
    || data?.itineraries
    || data?.results
    || data?.flights
    || data?.data?.flights
    || [];

  if (!Array.isArray(itineraries) || !itineraries.length) return [];

  return itineraries.map((it, i) => {
    const price = it.price?.raw ?? it.price ?? it.cheapestPrice?.raw ?? it.fares?.[0]?.price ?? 0;
    const legs  = it.legs || [];
    const leg   = legs[0] || {};

    const departure = leg.departure  || leg.departureDateTime || "";
    const arrival   = leg.arrival    || leg.arrivalDateTime   || "";
    const duration  = leg.durationInMinutes || leg.duration   || 0;
    const stops     = leg.stopCount  ?? leg.stops?.length     ?? 0;

    const carrier  = leg.carriers?.marketing?.[0]?.name || leg.carriers?.[0]?.name || leg.operatingCarrier?.name || it.airline || "Unknown";
    const logoUrl  = leg.carriers?.marketing?.[0]?.logoUrl || leg.carriers?.[0]?.logoUrl || "";
    const flightNum = leg.segments?.[0]?.flightNumber || leg.flightNumber || `FL${1000+i}`;
    const aircraft  = leg.segments?.[0]?.aircraft || leg.segments?.[0]?.operatingCarrier?.name || "";

    const deptTime = departure ? new Date(departure).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true }) : "—";
    const arrTime  = arrival   ? new Date(arrival).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true })   : "—";
    const durStr   = duration  ? `${Math.floor(duration/60)}h ${duration%60}m` : "—";

    const priceNum = typeof price === "number" ? price : parseFloat(String(price).replace(/[^0-9.]/g,"")) || 0;
    // All prices are in INR (Google Flights returns INR, mock data is also in INR)
    const priceFmt = priceNum
      ? `₹${Math.round(priceNum).toLocaleString("en-IN")}`
      : "Price N/A";

    return {
      carrier, logoUrl, flightNum, aircraft,
      deptTime, arrTime, durStr, stops,
      priceFmt, priceNum: Math.round(priceNum),
      durationRaw: duration, departureRaw: departure,
      isBest: !!it.isBest,
      carbon: it.carbon || "",
      delayed: !!it.delayed,
      bookingToken: it.bookingToken || "",
    };
  }).filter(Boolean);
}

// Client-side mock — used if server is unreachable or returns HTML
function buildClientMock(from, to, date, cabinClass, adults) {
  const AIRLINES = [
    { name: "IndiGo",            code: "6E" },
    { name: "Air India",         code: "AI" },
    { name: "Vistara",           code: "UK" },
    { name: "SpiceJet",          code: "SG" },
    { name: "Akasa Air",         code: "QP" },
    { name: "Air India Express", code: "IX" },
  ];
  const BASE = { economy: 3200, premium_economy: 6800, business: 15000, first: 30000 };
  const base = (BASE[cabinClass] || 3200) * (adults || 1);
  const d = new Date(date || Date.now());
  if (isNaN(d.getTime())) d.setTime(Date.now() + 86400000);

  return {
    status: true, isMock: true,
    data: {
      itineraries: AIRLINES.map((al, i) => {
        const durMins = 60 + i * 20 + Math.round(Math.random() * 40);
        const price   = Math.round(base + i * 600 + Math.random() * 500);
        const dept    = new Date(d); dept.setHours(5 + i * 3, [0,15,30,45][i%4], 0, 0);
        const arr     = new Date(dept.getTime() + durMins * 60000);
        return {
          id: `cmock-${al.code}-${i}`,
          price: { raw: price, formatted: `₹${price.toLocaleString("en-IN")}` },
          legs: [{
            departure: dept.toISOString(), arrival: arr.toISOString(),
            durationInMinutes: durMins, stopCount: i === 3 ? 1 : 0,
            carriers: { marketing: [{ name: al.name, alternateId: al.code, logoUrl: `https://logos.skyscnr.com/images/airlines/favicon/${al.code}.png` }] },
            segments: [{ flightNumber: `${al.code}${100+i*113}`, departure: dept.toISOString(), arrival: arr.toISOString(), durationInMinutes: durMins, operatingCarrier: { name: al.name } }]
          }]
        };
      })
    }
  };
}

function sortResults(results) {
  const r = [...results];
  if (fsSortMode === "price")     return r.sort((a, b) => a.priceNum - b.priceNum);
  if (fsSortMode === "duration")  return r.sort((a, b) => a.durationRaw - b.durationRaw);
  if (fsSortMode === "departure") return r.sort((a, b) => a.departureRaw.localeCompare(b.departureRaw));
  return r;
}

function renderFlightResults(results) {
  const listEl = document.getElementById("fs-results-list");
  const wrapEl = document.getElementById("fs-results-wrap");
  const titleEl = document.getElementById("fs-results-title");
  if (!listEl || !wrapEl) return;

  const sorted = sortResults(results);
  wrapEl.style.display = "block";
  const sortBar = document.getElementById("fs-sort-bar");
  if (sortBar) sortBar.style.display = "flex";
  if (titleEl) titleEl.textContent = `${sorted.length} flight${sorted.length !== 1 ? "s" : ""} found`;

  if (!sorted.length) {
    listEl.innerHTML = `<div class="fs-no-results">No flights found for this route and date.<br>Try different dates or nearby airports.</div>`;
    return;
  }

  listEl.innerHTML = sorted.map((f, i) => {
    const isBest  = f.isBest || (i === 0 && fsSortMode === "price");
    const bookUrl = f.bookingToken
      ? `https://www.google.com/travel/flights?tfs=${encodeURIComponent(f.bookingToken)}`
      : `https://www.google.com/travel/flights/search`;
    return `
    <div class="fs-result-card ${isBest ? 'fs-best' : ''}">
      ${isBest ? '<div class="fs-best-badge">⭐ Best flight</div>' : ''}
      ${f.delayed ? '<div class="fs-delay-badge">Often delayed</div>' : ''}
      <div class="fs-card-left">
        <div class="fs-airline-logo">
          ${f.logoUrl ? `<img src="${f.logoUrl}" alt="${f.carrier}" onerror="this.style.display='none'"/>` : ''}
          <span class="fs-airline-initial">${f.carrier.charAt(0)}</span>
        </div>
        <div class="fs-airline-info">
          <div class="fs-airline-name">${f.carrier}</div>
          <div class="fs-flight-num">${f.flightNum}${f.aircraft ? ` · ${f.aircraft}` : ''}</div>
        </div>
      </div>
      <div class="fs-card-mid">
        <div class="fs-time-block">
          <span class="fs-time">${f.deptTime}</span>
          <span class="fs-apt-code">${fsFromCode}</span>
        </div>
        <div class="fs-route-visual">
          <div class="fs-rv-line"></div>
          <div class="fs-rv-stops">${f.stops === 0 ? 'Non-stop' : f.stops + ' stop' + (f.stops > 1 ? 's' : '')}</div>
          <div class="fs-rv-dur">${f.durStr}</div>
          <div class="fs-rv-line"></div>
        </div>
        <div class="fs-time-block">
          <span class="fs-time">${f.arrTime}</span>
          <span class="fs-apt-code">${fsToCode}</span>
        </div>
      </div>
      <div class="fs-card-right">
        <div class="fs-price">${f.priceFmt}</div>
        <div class="fs-price-sub">per adult</div>
        <button class="fs-book-btn" onclick="window.open('${bookUrl}', '_blank')">Book</button>
      </div>
    </div>`;
  }).join("");
}

// ── Search handler ────────────────────────────────────────────
document.getElementById("fs-search-btn")?.addEventListener("click", async () => {
  const errWrap = document.getElementById("fs-error-wrap");
  const errMsg  = document.getElementById("fs-error-msg");
  const btnText = document.getElementById("fs-btn-text");
  const spinner = document.getElementById("fs-spinner");
  const resultsWrap = document.getElementById("fs-results-wrap");

  // Validate
  if (!fsFromCode) { showFsError("Please select a departure airport"); return; }
  if (!fsToCode)   { showFsError("Please select a destination airport"); return; }
  const dateVal = document.getElementById("fs-date")?.value;
  if (!dateVal)    { showFsError("Please select a travel date"); return; }
  if (fsFromCode === fsToCode) { showFsError("Departure and destination cannot be the same"); return; }

  if (errWrap) errWrap.style.display = "none";
  if (resultsWrap) resultsWrap.style.display = "none";
  if (btnText) btnText.style.display = "none";
  if (spinner) spinner.style.display = "inline";
  fsLastResults = [];

  try {
    const cabinClass = document.getElementById("fs-class")?.value || "economy";
    const adults     = document.getElementById("fs-passengers")?.value || "1";
    const url        = `${API_BASE}/api/searchFlights?from=${encodeURIComponent(fsFromCode)}&to=${encodeURIComponent(fsToCode)}&date=${dateVal}&cabinClass=${cabinClass}&adults=${adults}`;

    let data = null;
    try {
      const res  = await fetch(url);
      const text = await res.text();
      if (!text || text.trim().startsWith("<")) {
        // Server sent HTML — use client-side mock directly
        data = buildClientMock(fsFromCode, fsToCode, dateVal, cabinClass, parseInt(adults));
        data.isMock = true;
      } else {
        data = JSON.parse(text);
      }
    } catch (fetchErr) {
      console.warn("Fetch/parse error, using client mock:", fetchErr.message);
      data = buildClientMock(fsFromCode, fsToCode, dateVal, cabinClass, parseInt(adults));
      data.isMock = true;
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    // No flights found for this route (not a mock — real API returned empty)
    if (data?.noResults) {
      const ew = document.getElementById("fs-error-wrap");
      const em = document.getElementById("fs-error-msg");
      const rw = document.getElementById("fs-results-wrap");
      if (em) em.innerHTML = `✈ ${data.message || "No flights found for this route or date."}`;
      if (ew) {
        ew.style.display     = "block";
        ew.style.background  = "rgba(0,180,255,0.07)";
        ew.style.borderColor = "rgba(0,180,255,0.25)";
        em.style.color       = "#88ddff";
      }
      if (rw) rw.style.display = "none";
      return;
    }

    const results = parseSkyScanner(data);
    fsLastResults  = results;

    if (data?.isMock) {
      const ew = document.getElementById("fs-error-wrap");
      const em = document.getElementById("fs-error-msg");
      const reason = data.debugReason ? ` · <b>${data.debugReason}</b>` : "";
      if (em) em.innerHTML = `ℹ Demo data${reason} — add <b>APIFY_TOKEN</b> to .env · <a href="/api/debug" target="_blank" style="color:#ffdd88;text-decoration:underline">check /api/debug</a>`;
      if (ew) {
        ew.style.display     = "block";
        ew.style.background  = "rgba(255,200,0,0.07)";
        ew.style.borderColor = "rgba(255,200,0,0.25)";
        em.style.color       = "#ffcc44";
      }
    } else {
      // Hide error banner on successful live data
      const ew = document.getElementById("fs-error-wrap");
      if (ew) ew.style.display = "none";
    }

    renderFlightResults(results);
  } catch (err) {
    console.error("Flight search error:", err);
    showFsError(`Search failed: ${err.message}. Check your APIFY_TOKEN in .env`);
  } finally {
    if (btnText) btnText.style.display = "inline";
    if (spinner) spinner.style.display = "none";
  }
});

function showFsError(msg) {
  const errWrap = document.getElementById("fs-error-wrap");
  const errMsg  = document.getElementById("fs-error-msg");
  if (errMsg)  errMsg.textContent = "⚠ " + msg;
  if (errWrap) errWrap.style.display = "block";
}

// Hook into loadAirports to merge airport data
const _origLoadAirports = loadAirports;

// ─── INIT ────────────────────────────────────────────────────
const now = new Date();
updateScene(now);
if (timeLabel) timeLabel.innerText = formatIST(now);

// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
//  WEATHER OVERLAY — proper globe-sphere projection
//  Uses canvas with correct globe bounds detection
// ═══════════════════════════════════════════════════════════

const OWM_KEY = "bd5e378503939ddaee76f12ad7a97608";
const W_LAYERS = {
  clouds:        "clouds_new",
  precipitation: "precipitation_new",
  wind:          "wind_new",
  temp:          "temp_new",
  pressure:      "pressure_new",
};

let activeWLayer   = "clouds";
let weatherEnabled = false;
let wxCanvas = null, wxCtx = null;
let wxAnimId = null;
let wxOffscreen = null, wxOffCtx = null;
let wxLoaded = false;
let weatherLegendEl = null;

function initWxCanvas() {
  if (wxCanvas) return;
  wxCanvas = document.createElement("canvas");
  wxCanvas.id = "wx-canvas";
  Object.assign(wxCanvas.style, {
    position: "fixed", inset: "0",
    width: "100vw", height: "100vh",
    pointerEvents: "none", zIndex: "4",
    opacity: "0", transition: "opacity 0.5s",
  });
  document.body.appendChild(wxCanvas);
  wxCtx = wxCanvas.getContext("2d");
  sizeWxCanvas();
  window.addEventListener("resize", sizeWxCanvas);
}

function sizeWxCanvas() {
  if (!wxCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  wxCanvas.width  = window.innerWidth  * dpr;
  wxCanvas.height = window.innerHeight * dpr;
  wxCanvas.style.width  = window.innerWidth  + "px";
  wxCanvas.style.height = window.innerHeight + "px";
}

// ── Stitch 2×2 OWM tiles → full equirectangular world image
async function loadWxTiles(layerCode) {
  wxLoaded = false;
  const SIZE = 256;
  const stitch = Object.assign(document.createElement("canvas"), { width: SIZE*2, height: SIZE*2 });
  const sCtx   = stitch.getContext("2d");

  await Promise.all([[0,0],[1,0],[0,1],[1,1]].map(([x,y]) =>
    new Promise(res => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload  = () => { sCtx.drawImage(img, x*SIZE, y*SIZE, SIZE, SIZE); res(); };
      img.onerror = () => res();
      img.src = `https://tile.openweathermap.org/map/${layerCode}/1/${x}/${y}.png?appid=${OWM_KEY}`;
    })
  ));

  // Copy to offscreen sampler
  wxOffscreen = Object.assign(document.createElement("canvas"), { width: SIZE*2, height: SIZE*2 });
  wxOffCtx    = wxOffscreen.getContext("2d");
  wxOffCtx.drawImage(stitch, 0, 0);
  wxLoaded = true;
  console.log("✅ Weather tiles loaded:", layerCode);
}

// ── Get pixel colour from stitched texture ─────────────────
function sampleWx(u, v) {
  if (!wxOffCtx || !wxLoaded) return null;
  const x = Math.floor(((u % 1 + 1) % 1) * wxOffscreen.width);
  const y = Math.floor(Math.max(0, Math.min(1, v)) * wxOffscreen.height);
  const d = wxOffCtx.getImageData(x, y, 1, 1).data;
  if (d[3] < 8) return null;
  return [d[0], d[1], d[2], d[3]];
}

// ── Render weather projected onto the visible globe disc ───
function drawWxFrame() {
  if (!weatherEnabled) return;
  // Always re-queue next frame so zoom-out resumes automatically
  wxAnimId = requestAnimationFrame(drawWxFrame);

  const dpr  = window.devicePixelRatio || 1;
  const W    = wxCanvas.width;
  const H    = wxCanvas.height;
  const zoom = chart.get("zoomLevel") || 1;

  // Clear and skip drawing when zoomed in — but keep the loop alive
  wxCtx.clearRect(0, 0, W, H);
  if (zoom > 1.4) return;

  // Globe centre & base radius
  const el   = document.getElementById("chartdiv");
  const rect = el.getBoundingClientRect();
  const cx   = (rect.left + rect.width  / 2) * dpr;
  const cy   = (rect.top  + rect.height / 2) * dpr;
  const globeR = Math.min(rect.width, rect.height) * 0.42 * dpr;

  // Globe rotation
  const rotX = (chart.get("rotationX") || 0) * Math.PI / 180;
  const rotY = (chart.get("rotationY") || 0) * Math.PI / 180;

  const x0 = Math.max(0, Math.floor(cx - globeR));
  const y0 = Math.max(0, Math.floor(cy - globeR));
  const x1 = Math.min(W,  Math.ceil(cx  + globeR));
  const y1 = Math.min(H,  Math.ceil(cy  + globeR));
  const pw  = x1 - x0;
  const ph  = y1 - y0;
  if (pw <= 0 || ph <= 0) return;

  const imgData = wxCtx.createImageData(pw, ph);
  const buf     = imgData.data;

  for (let iy = 0; iy < ph; iy++) {
    for (let ix = 0; ix < pw; ix++) {
      const sx = (x0 + ix - cx) / globeR;
      const sy = (y0 + iy - cy) / globeR;
      const r2 = sx*sx + sy*sy;
      if (r2 >= 0.998) continue;

      const sz = Math.sqrt(1 - r2);
      const ny = -sy * Math.cos(rotY) + sz * Math.sin(rotY);
      const nz =  sy * Math.sin(rotY) + sz * Math.cos(rotY);
      const nx =  sx;

      const lat = Math.asin(Math.max(-1, Math.min(1, ny)));
      const lon = Math.atan2(nx, nz) - rotX;

      const u = ((lon / (2*Math.PI)) + 1.5) % 1;
      const v = 0.5 - lat / Math.PI;

      const px = sampleWx(u, v);
      if (!px) continue;

      const edgeFade = Math.max(0, 1 - r2 * 1.05);
      const alpha = Math.floor(px[3] * 0.6 * edgeFade);
      if (alpha < 4) continue;

      const idx = (iy * pw + ix) * 4;
      buf[idx]   = px[0];
      buf[idx+1] = px[1];
      buf[idx+2] = px[2];
      buf[idx+3] = alpha;
    }
  }

  wxCtx.putImageData(imgData, x0, y0);
}

// ── Weather legend ─────────────────────────────────────────
function showWxLegend() {
  if (!weatherLegendEl) {
    weatherLegendEl = document.createElement("div");
    Object.assign(weatherLegendEl.style, {
      position:"fixed", bottom:"80px", left:"12px", zIndex:"25",
      background:"rgba(5,10,25,0.92)", border:"1px solid rgba(0,238,255,0.25)",
      borderRadius:"12px", padding:"12px 14px", minWidth:"200px",
      backdropFilter:"blur(16px)", color:"#cde", fontSize:"12px",
    });
    document.body.appendChild(weatherLegendEl);
  }
  weatherLegendEl.style.display = "block";
  weatherLegendEl.innerHTML = `
    <div style="font-size:10px;font-weight:800;color:#00eeff;letter-spacing:1.5px;margin-bottom:10px">🌦 WEATHER LAYER</div>
    <div style="display:flex;flex-direction:column;gap:5px">
      ${[["clouds","☁️ Cloud Cover"],["precipitation","🌧️ Precipitation"],
         ["wind","💨 Wind Speed"],["temp","🌡️ Temperature"],["pressure","🌀 Pressure"]]
        .map(([k,l]) => `<button onclick="window.switchWxLayer('${k}')" style="
          padding:6px 10px;border-radius:7px;text-align:left;cursor:pointer;
          border:1px solid rgba(0,238,255,${k===activeWLayer?'0.7':'0.15'});
          background:rgba(0,238,255,${k===activeWLayer?'0.18':'0.04'});
          color:${k===activeWLayer?'#00eeff':'#99bbcc'};font-size:12px">${l}</button>`
        ).join("")}
    </div>
    <div style="margin-top:8px;font-size:10px;color:rgba(180,210,240,0.5)">Source: OpenWeatherMap</div>
  `;
}

window.switchWxLayer = async function(key) {
  activeWLayer = key;
  showWxLegend();
  await loadWxTiles(W_LAYERS[key]);
};

async function toggleWeather(on) {
  weatherEnabled = on;
  initWxCanvas();
  if (!on) {
    cancelAnimationFrame(wxAnimId);
    wxCanvas.style.opacity = "0";
    if (weatherLegendEl) weatherLegendEl.style.display = "none";
    return;
  }
  wxCanvas.style.opacity = "1";
  showWxLegend();
  if (!wxLoaded) await loadWxTiles(W_LAYERS[activeWLayer]);
  drawWxFrame();
}

document.getElementById("layer-weather")?.addEventListener("change", e => {
  toggleWeather(e.target.checked);
});