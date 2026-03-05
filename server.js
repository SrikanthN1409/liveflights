import express    from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import dotenv      from "dotenv";
import cors        from "cors";
import rateLimit   from "express-rate-limit";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { existsSync } from "fs";

// ── Always load .env from the same folder as server.js ───────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Try up to 3 levels up to find the .env
const envCandidates = [
  resolve(__dirname, ".env"),
  resolve(__dirname, "..", ".env"),
  resolve(__dirname, "..", "..", ".env"),
];
for (const p of envCandidates) {
  if (existsSync(p)) {
    dotenv.config({ path: p });
    console.log(`✅ Loaded .env from: ${p}`);
    break;
  }
}

// ── Startup key check ─────────────────────────────────────────────
console.log(`🔑 RAPIDAPI_KEY : ${process.env.RAPIDAPI_KEY ? process.env.RAPIDAPI_KEY.substring(0,8)+"… ("+process.env.RAPIDAPI_KEY.length+" chars)" : "❌ NOT FOUND"}`);
console.log(`🔑 APIFY_TOKEN  : ${process.env.APIFY_TOKEN  ? process.env.APIFY_TOKEN.substring(0,12)+"… ("+process.env.APIFY_TOKEN.length+" chars)" : "❌ NOT FOUND"}`);

// ── App setup ─────────────────────────────────────────────────────
const app        = express();
const httpServer = createServer(app);
const wss        = new WebSocketServer({ server: httpServer });

const PORT              = process.env.PORT || 3000;
const FETCH_INTERVAL_MS = 4500;

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());
app.use("/api/flights", rateLimit({ windowMs: 15000, max: 10 }));

// ── Airport data (top 50 global hubs) ────────────────────────────
const AIRPORTS = [
  { iata:"ATL",lat:33.6367,lon:-84.4281,name:"Atlanta Hartsfield" },
  { iata:"DXB",lat:25.2532,lon:55.3657, name:"Dubai Intl" },
  { iata:"LHR",lat:51.4775,lon:-0.4614, name:"London Heathrow" },
  { iata:"ORD",lat:41.9742,lon:-87.9073,name:"Chicago O'Hare" },
  { iata:"HND",lat:35.5494,lon:139.7798,name:"Tokyo Haneda" },
  { iata:"LAX",lat:33.9425,lon:-118.408,name:"Los Angeles" },
  { iata:"CDG",lat:49.0097,lon:2.5479,  name:"Paris CDG" },
  { iata:"DFW",lat:32.8998,lon:-97.0403,name:"Dallas Fort Worth" },
  { iata:"FRA",lat:50.0379,lon:8.5622,  name:"Frankfurt" },
  { iata:"IST",lat:41.2608,lon:28.7418, name:"Istanbul" },
  { iata:"SIN",lat:1.3644, lon:103.9915,name:"Singapore Changi" },
  { iata:"AMS",lat:52.3105,lon:4.7683,  name:"Amsterdam Schiphol" },
  { iata:"ICN",lat:37.4602,lon:126.4407,name:"Seoul Incheon" },
  { iata:"BKK",lat:13.6811,lon:100.7472,name:"Bangkok Suvarnabhumi" },
  { iata:"DEL",lat:28.5562,lon:77.1,    name:"Delhi Indira Gandhi" },
  { iata:"BOM",lat:19.0896,lon:72.8656, name:"Mumbai Chhatrapati" },
  { iata:"HKG",lat:22.308, lon:113.9185,name:"Hong Kong" },
  { iata:"SYD",lat:-33.946,lon:151.177, name:"Sydney Kingsford" },
  { iata:"GRU",lat:-23.432,lon:-46.469, name:"São Paulo Guarulhos" },
  { iata:"JFK",lat:40.6413,lon:-73.7781,name:"New York JFK" },
  { iata:"MAD",lat:40.472, lon:-3.5608, name:"Madrid Barajas" },
  { iata:"BCN",lat:41.2971,lon:2.0785,  name:"Barcelona El Prat" },
  { iata:"MUC",lat:48.3538,lon:11.7861, name:"Munich" },
  { iata:"ZRH",lat:47.4647,lon:8.5492,  name:"Zurich" },
  { iata:"CPH",lat:55.618, lon:12.656,  name:"Copenhagen" },
  { iata:"DOH",lat:25.273, lon:51.608,  name:"Doha Hamad" },
  { iata:"AUH",lat:24.433, lon:54.651,  name:"Abu Dhabi" },
  { iata:"KUL",lat:2.7456, lon:101.7099,name:"Kuala Lumpur" },
  { iata:"CGK",lat:-6.1256,lon:106.6559,name:"Jakarta Soekarno" },
  { iata:"NRT",lat:35.7648,lon:140.3864,name:"Tokyo Narita" },
  { iata:"PEK",lat:40.0799,lon:116.6031,name:"Beijing Capital" },
  { iata:"PVG",lat:31.1443,lon:121.8083,name:"Shanghai Pudong" },
  { iata:"SFO",lat:37.6213,lon:-122.379,name:"San Francisco" },
  { iata:"MIA",lat:25.7959,lon:-80.287, name:"Miami" },
  { iata:"YYZ",lat:43.6772,lon:-79.6306,name:"Toronto Pearson" },
  { iata:"MEX",lat:19.4363,lon:-99.0721,name:"Mexico City" },
  { iata:"BOG",lat:4.7016, lon:-74.1469,name:"Bogotá El Dorado" },
  { iata:"LIM",lat:-12.022,lon:-77.114, name:"Lima Jorge Chavez" },
  { iata:"JNB",lat:-26.134,lon:28.242,  name:"Johannesburg OR Tambo" },
  { iata:"CAI",lat:30.1219,lon:31.4056, name:"Cairo" },
  { iata:"NBO",lat:-1.3192,lon:36.9275, name:"Nairobi Jomo Kenyatta" },
  { iata:"DUB",lat:53.4213,lon:-6.2701, name:"Dublin" },
  { iata:"VIE",lat:48.1103,lon:16.5697, name:"Vienna" },
  { iata:"BRU",lat:50.9014,lon:4.4844,  name:"Brussels" },
  { iata:"LIS",lat:38.7813,lon:-9.1359, name:"Lisbon" },
  { iata:"ARN",lat:59.6519,lon:17.9186, name:"Stockholm Arlanda" },
  { iata:"OSL",lat:60.1939,lon:11.1004, name:"Oslo Gardermoen" },
  { iata:"HEL",lat:60.3183,lon:24.9497, name:"Helsinki Vantaa" },
  { iata:"WAW",lat:52.1657,lon:20.9671, name:"Warsaw Chopin" },
  { iata:"PRG",lat:50.1008,lon:14.26,   name:"Prague Vaclav Havel" },
];

// ── Region list ───────────────────────────────────────────────────
const ADSB_REGIONS = [
  { lat:23,  lon:80   }, { lat:50,  lon:10   },
  { lat:40,  lon:-100 }, { lat:-20, lon:-60  },
  { lat:0,   lon:20   }, { lat:-25, lon:135  },
  { lat:35,  lon:140  }, { lat:60,  lon:-40  },
  { lat:55,  lon:40   }, { lat:25,  lon:50   },
  { lat:35,  lon:-5   }, { lat:10,  lon:105  },
];

// ── Heading calc ──────────────────────────────────────────────────
const prevPos = new Map();
function calcBearing(la1, lo1, la2, lo2) {
  const r = Math.PI / 180, d = (lo2 - lo1) * r;
  const y = Math.sin(d) * Math.cos(la2 * r);
  const x = Math.cos(la1 * r) * Math.sin(la2 * r) -
            Math.sin(la1 * r) * Math.cos(la2 * r) * Math.cos(d);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}

// ── Fetch ADSBexchange ────────────────────────────────────────────
async function fetchADSB() {
  const all = [];
  await Promise.all(ADSB_REGIONS.map(async ({ lat, lon }) => {
    try {
      const res  = await fetch(
        `https://adsbexchange-com1.p.rapidapi.com/v2/lat/${lat}/lon/${lon}/dist/2000/`,
        { headers: {
          "x-rapidapi-key":  process.env.RAPIDAPI_KEY,
          "x-rapidapi-host": "adsbexchange-com1.p.rapidapi.com"
        }}
      );
      const data = await res.json();
      if (data.ac) all.push(...data.ac);
    } catch (e) { console.error("ADSB region error:", e.message); }
  }));
  return all;
}

// ── Fetch OpenSky ─────────────────────────────────────────────────
let openSkyBackoffUntil = 0; // timestamp — skip calls until this time

async function fetchOpenSky() {
  // If we're in backoff period, skip silently
  if (Date.now() < openSkyBackoffUntil) return [];
  try {
    const headers = process.env.OPENSKY_USER
      ? { Authorization: "Basic " + Buffer.from(`${process.env.OPENSKY_USER}:${process.env.OPENSKY_PASS}`).toString("base64") }
      : {};
    const res  = await fetch("https://opensky-network.org/api/states/all", { headers, signal: AbortSignal.timeout(8000) });

    // Rate limited — back off for 2 minutes
    if (res.status === 429 || res.status === 503) {
      openSkyBackoffUntil = Date.now() + 2 * 60 * 1000;
      return [];
    }

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(_) {
      // "Too many requests" plain text response
      openSkyBackoffUntil = Date.now() + 2 * 60 * 1000;
      return [];
    }
    if (!data.states) return [];

    return data.states
      .filter(s => s[5] != null && s[6] != null)
      .map(s => ({
        hex:    s[0],
        flight: (s[1] || "").trim(),
        lat:    s[6],
        lon:    s[5],
        alt:    s[7] ? Math.round(s[7] * 3.28084) : 0,
        spd:    s[9] ? Math.round(s[9] * 1.94384) : 0,
        track:  s[10] || 0,
        reg:    "",
        type:   "",
        squawk: s[14] || "",
        origin: s[2] || "",
        dest:   "",
        source: "opensky"
      }));
  } catch (e) {
    // Only log non-rate-limit errors
    if (!e.message?.includes("Too many") && !e.message?.includes("429")) {
      console.error("OpenSky error:", e.message);
    }
    return [];
  }
}

// ── Normalise + merge ─────────────────────────────────────────────
function normalise(raw, source) {
  const lat = parseFloat(raw.lat ?? raw[6]);
  const lon = parseFloat(raw.lon ?? raw[5]);
  if (isNaN(lat) || isNaN(lon)) return null;

  // Clamp to valid globe coordinates — prevents the "brown circle" artifact
  // caused by planes with lon=0 or out-of-range values being interpolated
  // across the globe
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  const hex = (raw.hex || "").toLowerCase();
  let hdg = parseFloat(raw.track ?? raw.hdg ?? 0);
  if (isNaN(hdg) || hdg === 0) {
    const prev = prevPos.get(hex);
    if (prev && (prev.lat !== lat || prev.lon !== lon))
      hdg = calcBearing(prev.lat, prev.lon, lat, lon);
  }
  prevPos.set(hex, { lat, lon });

  const alt = parseFloat(raw.alt_baro ?? raw.alt_geom ?? raw.alt ?? 0) || 0;
  let altBucket = "ground";
  if (alt > 30000)      altBucket = "high";
  else if (alt > 10000) altBucket = "mid";
  else if (alt > 0)     altBucket = "low";

  return {
    hex,
    flight:    (raw.flight || "").trim(),
    lat, lon,
    alt,
    altBucket,
    spd:       parseFloat(raw.gs ?? raw.spd ?? 0) || 0,
    hdg,
    squawk:    raw.squawk || "",
    type:      raw.t      || raw.type || "",
    reg:       raw.r      || raw.reg  || "",
    origin:    raw.orig   || raw.origin || "",
    dest:      raw.dest   || "",
    source:    source || "adsb"
  };
}

let cachedFlights = [];
let lastFetch     = 0;

async function fetchAll() {
  const now = Date.now();
  if (now - lastFetch < FETCH_INTERVAL_MS) return cachedFlights;

  const [adsbRaw, oskyRaw] = await Promise.all([fetchADSB(), fetchOpenSky()]);

  const map = new Map();

  // OpenSky first (lower priority)
  oskyRaw.forEach(r => {
    const n = normalise(r, "opensky");
    if (n) map.set(n.hex, n);
  });

  // ADSB overwrites (higher quality data)
  adsbRaw.forEach(r => {
    const n = normalise(r, "adsb");
    if (n) map.set(n.hex, n);
  });

  // Cleanup stale prev positions
  const active = new Set(map.keys());
  prevPos.forEach((_, k) => { if (!active.has(k)) prevPos.delete(k); });

  cachedFlights = [...map.values()];
  lastFetch = now;
  console.log(`✈  ${cachedFlights.length} flights (ADSB: ${adsbRaw.length}, OpenSky: ${oskyRaw.length}) at ${new Date().toISOString()}`);
  return cachedFlights;
}

// ── WebSocket ─────────────────────────────────────────────────────
const clients = new Set();

wss.on("connection", sock => {
  clients.add(sock);
  console.log(`🔌 WS client connected (${clients.size} total)`);

  // Send cached data immediately on connect
  if (cachedFlights.length)
    sock.send(JSON.stringify({ type: "flights",  data: cachedFlights }));

  // Always send airports on connect
  sock.send(JSON.stringify({ type: "airports", data: AIRPORTS }));

  sock.on("close", () => clients.delete(sock));
  sock.on("error", () => clients.delete(sock));
});

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  clients.forEach(s => { if (s.readyState === 1) s.send(msg); });
}

setInterval(async () => {
  const data = await fetchAll();
  broadcast({ type: "flights", data });
}, FETCH_INTERVAL_MS);

// ── REST endpoints ────────────────────────────────────────────────
app.get("/api/flights",  async (_, res) => res.json({ ac: await fetchAll() }));
app.get("/api/airports", (_, res)        => res.json(AIRPORTS));
app.get("/health",       (_, res)        => res.json({ ok: true, flights: cachedFlights.length }));


// ═══════════════════════════════════════════════════════════
//  FLIGHT SEARCH — Apify Google Flights API
//  Actor: johnvc/Google-Flights-Data-Scraper-Flight-and-Price-Search
//  Docs:  https://apify.com/johnvc/google-flights-data-scraper
//  Add to .env:  APIFY_TOKEN=your_apify_api_token
// ═══════════════════════════════════════════════════════════

const APIFY_ACTOR_ID = "1dYHRKkEBHBPd0JM7"; // Google Flights scraper

// ── Debug endpoint: http://localhost:3000/api/debug ──────────────
app.get("/api/debug", async (req, res) => {
  const token = (process.env.APIFY_TOKEN || "").trim();
  const info  = {
    hasToken:    !!token,
    tokenLength: token.length,
    tokenPrefix: token ? token.substring(0,8)+"..." : "(empty)",
    hint: !token ? "Add APIFY_TOKEN=your_token to .env — get it free at https://console.apify.com/settings/integrations" : "Token found!",
  };
  if (!token) return res.json(info);

  // Test token by fetching account info
  try {
    const r = await fetch("https://api.apify.com/v2/users/me",
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) });
    const data = await r.json();
    res.json({ ...info, apifyAccount: { status: r.status, username: data?.data?.username, plan: data?.data?.plan?.id, ok: r.ok } });
  } catch(e) {
    res.json({ ...info, apifyTest: { error: e.message } });
  }
});

// ── Raw Apify test: http://localhost:3000/api/test-apify?from=HYD&to=DEL&date=2026-03-10
app.get("/api/test-apify", async (req, res) => {
  const token = (process.env.APIFY_TOKEN || "").trim();
  if (!token) return res.json({ error: "No APIFY_TOKEN in .env" });
  const { from = "HYD", to = "DEL", date = "2026-03-10" } = req.query;
  try {
    const r = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${token}&timeout=120&memory=1024`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(130000),
        body: JSON.stringify({ departure_id: from.toUpperCase(), arrival_id: to.toUpperCase(), outbound_date: date, adults: 1, travel_class: "ECONOMY", trip_type: "ONE_WAY", max_results: 3, currency: "INR" })
      }
    );
    const text = await r.text();
    let parsed = null; try { parsed = JSON.parse(text); } catch(_) {}
    res.json({
      http: r.status,
      isArray: Array.isArray(parsed),
      count: Array.isArray(parsed) ? parsed.length : null,
      firstItemKeys: Array.isArray(parsed) && parsed[0] ? Object.keys(parsed[0]) : null,
      firstItem: Array.isArray(parsed) && parsed[0] ? parsed[0] : parsed,
      rawPreview: text.substring(0, 1000),
    });
  } catch(e) {
    res.json({ error: e.message });
  }
});


// ── Full search trace: http://localhost:3000/api/search-test ────
app.get("/api/search-test", async (req, res) => {
  const token = (process.env.APIFY_TOKEN || "").trim();
  if (!token) return res.json({ error: "No APIFY_TOKEN" });

  const trace = [];
  const log   = msg => { console.log("   [trace]", msg); trace.push(msg); };

  log(`Token: ${token.substring(0,12)}... len=${token.length}`);

  const actorInput = {
    departure_id:  "HYD",
    arrival_id:    "DEL",
    outbound_date: new Date(Date.now() + 7*86400000).toISOString().split("T")[0],
    adults: 1, travel_class: "ECONOMY", trip_type: "ONE_WAY", max_results: 3, currency: "INR"
  };
  log(`Input: ${JSON.stringify(actorInput)}`);

  try {
    const r = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${token}&timeout=120&memory=1024`,
      { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(130000), body: JSON.stringify(actorInput) }
    );
    const text = await r.text();
    log(`HTTP ${r.status}, ${text.length} bytes`);
    log(`Preview: ${text.substring(0, 300)}`);

    let items = null;
    try { items = JSON.parse(text); } catch(e) { log(`JSON parse error: ${e.message}`); }

    if (Array.isArray(items)) {
      log(`Array of ${items.length} items`);
      if (items[0]) {
        log(`items[0] keys: ${Object.keys(items[0]).join(", ")}`);
        log(`best_flights count: ${items[0].best_flights?.length ?? "N/A"}`);
        log(`other_flights count: ${items[0].other_flights?.length ?? "N/A"}`);
      }
    } else {
      log(`Not an array. Type: ${typeof items}, keys: ${items ? Object.keys(items).join(", ") : "null"}`);
    }

    res.json({ trace, rawPreview: text.substring(0, 500) });
  } catch(e) {
    log(`Error: ${e.message}`);
    res.json({ trace });
  }
});

app.get("/api/searchFlights", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { from = "", to = "", date = "", cabinClass = "economy", adults = "1" } = req.query;
  const fromCode = from.trim().toUpperCase() || "HYD";
  const toCode   = to.trim().toUpperCase()   || "DEL";
  const token    = (process.env.APIFY_TOKEN || "").trim();

  console.log(`\n✈  Apify flight search: ${fromCode}→${toCode} on ${date}`);

  if (!token) {
    console.log("   No APIFY_TOKEN → mock");
    return res.json(buildMockResults(fromCode, toCode, date, cabinClass, parseInt(adults)||1));
  }

  // Map cabinClass to Google Flights travel class
  const travelClassMap = { economy: "ECONOMY", premium_economy: "PREMIUM_ECONOMY", business: "BUSINESS", first: "FIRST" };
  const travelClass = travelClassMap[cabinClass] || "ECONOMY";

  // ── Run Apify Google Flights actor ────────────────────────────
  try {
    // Input field names come directly from the actor's input schema
    // as shown in https://console.apify.com/actors/1dYHRKkEBHBPd0JM7/input
    const actorInput = {
      departure_id:  fromCode,        // IATA code e.g. "HYD"
      arrival_id:    toCode,          // IATA code e.g. "DEL"
      outbound_date: date,            // "YYYY-MM-DD"
      adults:        parseInt(adults) || 1,
      travel_class:  travelClass,     // "ECONOMY", "BUSINESS" etc
      trip_type:     "ONE_WAY",
      max_results:   15,
      currency:      "INR",
    };

    console.log(`   → Apify actor input:`, JSON.stringify(actorInput));

    // run-sync-get-dataset-items: runs actor and waits, returns dataset items directly
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${token}&timeout=120&memory=1024`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  AbortSignal.timeout(130000),
        body:    JSON.stringify(actorInput),
      }
    );

    const text = await runRes.text();
    console.log(`   ← Apify HTTP ${runRes.status}, ${text.length} bytes`);
    console.log(`   ← Preview: ${text.substring(0, 300)}`);

    if (!runRes.ok) {
      let errMsg = text.substring(0, 200);
      try { errMsg = JSON.parse(text)?.error?.message || errMsg; } catch(_) {}
      console.error(`   ✗ Apify error ${runRes.status}: ${errMsg}`);
      return res.json({ ...buildMockResults(fromCode, toCode, date, cabinClass, parseInt(adults)||1), isMock: true, debugReason: `apify_http_${runRes.status}: ${errMsg}` });
    }

    let items = [];
    try { items = JSON.parse(text); } catch(e) {
      console.error("   ✗ JSON parse failed:", e.message, "| text:", text.substring(0,200));
      return res.json({ ...buildMockResults(fromCode, toCode, date, cabinClass, parseInt(adults)||1), isMock: true, debugReason: "json_parse_failed" });
    }

    // items might be wrapped: { items: [...] } or just [...]
    if (!Array.isArray(items)) items = items?.items || items?.data || [];

    if (!Array.isArray(items) || !items.length) {
      console.warn("   No results from Apify — raw:", text.substring(0, 400));
      return res.json({ ...buildMockResults(fromCode, toCode, date, cabinClass, parseInt(adults)||1), isMock: true, debugReason: "no_results_from_actor" });
    }

    // ── Parse Apify Google Flights response ───────────────────────
    // Response shape: items[0] = { best_flights: [...], other_flights: [...] }
    // Each entry: { flights: [{departure_airport, arrival_airport, duration, airline, ...}], price, total_duration, airline_logo }
    const page = items[0];
    const bestFlights  = Array.isArray(page?.best_flights)  ? page.best_flights  : [];
    const otherFlights = Array.isArray(page?.other_flights) ? page.other_flights : [];
    const allFlights   = [...bestFlights, ...otherFlights];

    if (!allFlights.length) {
      console.warn("   No flights in best_flights or other_flights → mock");
      return res.json({ ...buildMockResults(fromCode, toCode, date, cabinClass, parseInt(adults)||1), isMock: true, debugReason: "no_flights_in_response" });
    }

    console.log(`   ✓ ${bestFlights.length} best + ${otherFlights.length} other = ${allFlights.length} total flights`);

    const itineraries = allFlights.map((entry, i) => {
      const leg0       = entry.flights?.[0] || {};
      const isBest     = i < bestFlights.length;

      // Times: "2026-03-10 04:00" → ISO
      function toISO(t) {
        if (!t) return "";
        // Already ISO
        if (t.includes("T")) return t;
        // "YYYY-MM-DD HH:MM" → ISO
        return new Date(t.replace(" ", "T") + ":00").toISOString();
      }

      const deptISO = toISO(leg0.departure_airport?.time || "");
      const arrISO  = toISO(leg0.arrival_airport?.time  || "");
      const durMins = entry.total_duration || leg0.duration || 0;
      const stops   = (entry.flights?.length || 1) - 1; // multi-leg = has stop

      return {
        id:      `apify-${i}`,
        isBest,
        price:   { raw: entry.price || 0, formatted: `₹${(entry.price||0).toLocaleString("en-IN")}` },
        legs: [{
          departure:          deptISO,
          arrival:            arrISO,
          durationInMinutes:  durMins,
          stopCount:          stops,
          carriers: {
            marketing: [{
              name:        leg0.airline     || "Unknown",
              alternateId: (leg0.flight_number || "").split(" ")[0] || "??",
              logoUrl:     entry.airline_logo || leg0.airline_logo || "",
            }]
          },
          segments: [{
            flightNumber:      leg0.flight_number    || `FL${i+1}`,
            departure:         deptISO,
            arrival:           arrISO,
            durationInMinutes: durMins,
            operatingCarrier:  { name: leg0.airline || "Unknown" },
            aircraft:          leg0.airplane || "",
          }]
        }],
        // Extra Google Flights data shown in cards
        carbon:       leg0.extensions?.find(e => e.includes("Carbon"))  || "",
        delayed:      !!leg0.often_delayed_by_over_30_min,
        bookingToken: entry.booking_token || "",
      };
    });

    console.log(`   ✓ ${itineraries.length} normalised itineraries`);
    return res.json({ status: true, source: "google_flights", data: { itineraries } });

  } catch(err) {
    const isTimeout = err.name === "TimeoutError" || err.message.includes("timeout");
    console.error(`   ✗ Apify ${isTimeout ? "timeout" : "error"}:`, err.message);
    return res.json({
      ...buildMockResults(fromCode, toCode, date, cabinClass, parseInt(adults)||1),
      isMock: true,
      debugReason: isTimeout ? "apify_timeout_130s" : `error: ${err.message}`
    });
  }
});

// ── Mock flight data (fallback) ──────────────────────────────────
function buildMockResults(from, to, date, cabinClass, adults) {
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
  const d    = new Date(date || Date.now());
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
          id: `mock-${al.code}-${i}`,
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

// ── Serve frontend static files ──────────────────────────────────
import { join as pathJoin } from "path";
app.use(express.static(pathJoin(__dirname, "dist")));
app.use(express.static(pathJoin(__dirname, "public")));
app.use(express.static(__dirname));

// SPA fallback — Express 5 requires explicit path pattern, not bare "*"
app.get("/{*splat}", (req, res) => {
  if (req.path.startsWith("/api/") || req.path === "/health") {
    return res.status(404).json({ error: "Not found" });
  }
  const distIndex = pathJoin(__dirname, "dist", "index.html");
  if (existsSync(distIndex)) return res.sendFile(distIndex);
  res.sendFile(pathJoin(__dirname, "index.html"));
});


httpServer.listen(PORT, "0.0.0.0", () => console.log(`✈  LiveFlights server → http://0.0.0.0:${PORT}`));