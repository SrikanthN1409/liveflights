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

// ── Instant health check — must be FIRST for Railway startup probe ──
app.get("/privacy", (_, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Privacy Policy — LiveFlights</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0e1a; color: #c8d8e8; line-height: 1.7; }
  .header { background: linear-gradient(135deg, #0a0e1a, #0d1a2e); padding: 32px 24px; border-bottom: 1px solid rgba(0,180,255,0.15); text-align: center; }
  .header h1 { font-size: 28px; color: #fff; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .header p  { color: rgba(150,190,230,0.7); margin-top: 6px; font-size: 14px; }
  .container { max-width: 780px; margin: 0 auto; padding: 40px 24px 80px; }
  h2 { color: #00eeff; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; margin: 32px 0 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(0,180,255,0.15); }
  p  { margin-bottom: 12px; color: rgba(180,210,240,0.85); font-size: 15px; }
  ul { margin: 8px 0 14px 20px; }
  li { margin-bottom: 6px; color: rgba(180,210,240,0.85); font-size: 15px; }
  a  { color: #00eeff; }
  .updated { background: rgba(0,100,200,0.1); border: 1px solid rgba(0,150,255,0.2); border-radius: 8px; padding: 12px 16px; margin-bottom: 28px; font-size: 13px; color: rgba(150,190,230,0.7); }
  .contact { background: rgba(0,20,50,0.5); border: 1px solid rgba(0,100,200,0.2); border-radius: 12px; padding: 20px; margin-top: 32px; }
</style>
</head>
<body>
<div class="header">
  <h1>✈ LiveFlights — Privacy Policy</h1>
  <p>Real-time Flight Tracker</p>
</div>
<div class="container">
  <div class="updated">Last updated: March 2026 &nbsp;·&nbsp; Effective immediately</div>

  <p>LiveFlights ("we", "our", or "us") is committed to protecting your privacy. This policy explains what information we collect, how we use it, and your rights.</p>

  <h2>1. Information We Collect</h2>
  <p>We collect the following types of information:</p>
  <ul>
    <li><strong>Location data</strong> — Only when you use the "Nearby Flights" feature and only with your explicit permission. We do not store or transmit your location to our servers.</li>
    <li><strong>Usage data</strong> — Anonymous app usage statistics such as which features are used. No personally identifiable information is collected.</li>
    <li><strong>Flight search queries</strong> — When you search for flights, your origin/destination airports and date are sent to our server to fetch results. These are not linked to your identity and are not stored.</li>
  </ul>

  <h2>2. Information We Do NOT Collect</h2>
  <ul>
    <li>We do not collect your name, email address, or any account information</li>
    <li>We do not require you to create an account</li>
    <li>We do not collect payment information</li>
    <li>We do not track you across other apps or websites</li>
    <li>We do not sell your data to third parties</li>
  </ul>

  <h2>3. Third-Party Services</h2>
  <p>LiveFlights uses the following third-party services to provide functionality:</p>
  <ul>
    <li><strong>OpenSky Network</strong> — Provides live flight position data. Subject to their <a href="https://opensky-network.org/about/privacy-policy" target="_blank">privacy policy</a>.</li>
    <li><strong>OpenWeatherMap</strong> — Provides live weather tile data. Subject to their <a href="https://openweathermap.org/privacy-policy" target="_blank">privacy policy</a>.</li>
    <li><strong>Google Flights</strong> — Flight booking is handled externally by Google. Subject to <a href="https://policies.google.com/privacy" target="_blank">Google's privacy policy</a>.</li>
    <li><strong>amCharts</strong> — Powers the 3D globe visualization. No personal data is shared.</li>
  </ul>

  <h2>4. Location Permission</h2>
  <p>The app requests location access only for the "Nearby Flights" feature to show flights near you. Location is used solely within the app and is never transmitted to our servers or shared with third parties. You can deny this permission and still use all other features of the app.</p>

  <h2>5. Internet Permission</h2>
  <p>The app requires internet access to fetch live flight data, weather information, and flight search results. No personal data is transmitted during normal use.</p>

  <h2>6. Data Retention</h2>
  <p>We do not store personal data on our servers. Flight search queries are processed in real-time and discarded immediately. Server logs (IP address, request path) may be retained for up to 7 days for security and debugging purposes only.</p>

  <h2>7. Children's Privacy</h2>
  <p>LiveFlights is not directed at children under 13. We do not knowingly collect personal information from children. If you believe we have inadvertently collected such information, please contact us.</p>

  <h2>8. Changes to This Policy</h2>
  <p>We may update this privacy policy from time to time. Changes will be posted at this URL. Continued use of the app after changes constitutes acceptance of the updated policy.</p>

  <h2>9. Your Rights</h2>
  <p>Since we do not collect personal data, there is no personal data to access, correct, or delete. If you have any concerns, please contact us and we will respond within 30 days.</p>

  <div class="contact">
    <h2 style="margin-top:0; border:none;">10. Contact Us</h2>
    <p style="margin-bottom:0">If you have questions about this privacy policy, please contact us at:<br>
    <strong style="color:#00eeff">Developer: Srikanth Nagalla</strong><br>
    App: LiveFlights — Real-time Flight Tracker<br>
    Available on Google Play Store</p>
  </div>
</div>
</body>
</html>`);
});



app.use("/api/flights", rateLimit({ windowMs: 15000, max: 10 }));

// ── Airport data (top 50 global hubs) ────────────────────────────
const AIRPORTS = [
  // ── India – Metro ──────────────────────────────────────────────
  { iata:"DEL",lat:28.5562,lon:77.1000,name:"Delhi Indira Gandhi Intl" },
  { iata:"BOM",lat:19.0896,lon:72.8656,name:"Mumbai Chhatrapati Shivaji Intl" },
  { iata:"BLR",lat:13.1986,lon:77.7066,name:"Bengaluru Kempegowda Intl" },
  { iata:"MAA",lat:12.9900,lon:80.1693,name:"Chennai Intl" },
  { iata:"HYD",lat:17.2403,lon:78.4294,name:"Hyderabad Rajiv Gandhi Intl" },
  { iata:"CCU",lat:22.6542,lon:88.4467,name:"Kolkata Netaji Subhas Intl" },
  // ── India – Tier 2 ─────────────────────────────────────────────
  { iata:"COK",lat:10.1520,lon:76.4019,name:"Kochi Intl" },
  { iata:"PNQ",lat:18.5822,lon:73.9197,name:"Pune Intl" },
  { iata:"AMD",lat:23.0772,lon:72.6347,name:"Ahmedabad Sardar Vallabhbhai Patel" },
  { iata:"GOI",lat:15.3808,lon:73.8314,name:"Goa Dabolim Intl" },
  { iata:"JAI",lat:26.8242,lon:75.8122,name:"Jaipur Intl" },
  { iata:"LKO",lat:26.7606,lon:80.8893,name:"Lucknow Chaudhary Charan Singh" },
  { iata:"PAT",lat:25.5913,lon:85.0900,name:"Patna Jay Prakash Narayan" },
  { iata:"BHO",lat:23.2875,lon:77.3374,name:"Bhopal Raja Bhoj" },
  { iata:"NAG",lat:21.0922,lon:79.0472,name:"Nagpur Dr Babasaheb Ambedkar" },
  { iata:"IXC",lat:30.6735,lon:76.7885,name:"Chandigarh Intl" },
  { iata:"ATQ",lat:31.7096,lon:74.7974,name:"Amritsar Sri Guru Ram Dass Jee" },
  { iata:"SXR",lat:33.9871,lon:74.7742,name:"Srinagar Intl" },
  { iata:"IXB",lat:26.6812,lon:88.3286,name:"Bagdogra Intl" },
  { iata:"GAU",lat:26.1061,lon:91.5859,name:"Guwahati Lokpriya Gopinath Bordoloi" },
  { iata:"VNS",lat:25.4524,lon:82.8593,name:"Varanasi Lal Bahadur Shastri" },
  { iata:"IXR",lat:23.3143,lon:85.3217,name:"Ranchi Birsa Munda" },
  { iata:"BBI",lat:20.2444,lon:85.8178,name:"Bhubaneswar Biju Patnaik" },
  { iata:"VGA",lat:16.5303,lon:80.7968,name:"Vijayawada Intl" },
  { iata:"VTZ",lat:17.7212,lon:83.2245,name:"Visakhapatnam Intl" },
  { iata:"TRV",lat:8.4821, lon:76.9201,name:"Thiruvananthapuram Intl" },
  { iata:"CJB",lat:11.0300,lon:77.0435,name:"Coimbatore Intl" },
  { iata:"MAB",lat:9.8346, lon:77.4615,name:"Madurai Intl" },
  { iata:"TIR",lat:13.6324,lon:79.5433,name:"Tirupati Intl" },
  { iata:"IXE",lat:12.9613,lon:74.8900,name:"Mangalore Intl" },
  { iata:"HBX",lat:15.3617,lon:75.0149,name:"Hubli Intl" },
  { iata:"BDQ",lat:22.3362,lon:73.2263,name:"Vadodara Civil" },
  { iata:"STV",lat:21.1141,lon:72.7418,name:"Surat Intl" },
  { iata:"RAJ",lat:22.3092,lon:70.7795,name:"Rajkot Hirasar" },
  { iata:"IDR",lat:22.7218,lon:75.8011,name:"Indore Devi Ahilya Bai Holkar" },
  { iata:"JDH",lat:26.2511,lon:73.0489,name:"Jodhpur" },
  { iata:"UDR",lat:24.6177,lon:73.8961,name:"Udaipur Maharana Pratap" },
  { iata:"JSA",lat:26.8887,lon:70.8650,name:"Jaisalmer" },
  { iata:"AGR",lat:27.1558,lon:77.9609,name:"Agra Kheria" },
  { iata:"IXA",lat:23.8870,lon:91.2400,name:"Agartala Maharaja Bir Bikram" },
  { iata:"IMF",lat:24.7600,lon:93.8967,name:"Imphal Bir Tikendrajit Intl" },
  { iata:"DIB",lat:27.4839,lon:95.0169,name:"Dibrugarh" },
  { iata:"IXS",lat:24.9129,lon:92.9787,name:"Silchar Kumbhirgram" },
  { iata:"GOP",lat:26.7397,lon:83.4497,name:"Gorakhpur" },
  { iata:"GWL",lat:26.2933,lon:78.2278,name:"Gwalior" },
  { iata:"IXU",lat:19.8627,lon:75.3981,name:"Aurangabad Chikkalthana" },
  { iata:"KLH",lat:16.6647,lon:74.2894,name:"Kolhapur" },
  { iata:"PGH",lat:29.0334,lon:79.4737,name:"Pantnagar" },
  { iata:"DED",lat:30.1897,lon:78.1803,name:"Dehradun Jolly Grant" },
  { iata:"SHL",lat:25.7036,lon:91.9787,name:"Shillong" },
  { iata:"IXL",lat:34.1359,lon:77.5465,name:"Leh Kushok Bakula Rimpochhe" },
  { iata:"IXM",lat:9.8346, lon:78.0934,name:"Madurai Intl" },
  { iata:"RPR",lat:21.1804,lon:81.7388,name:"Raipur Swami Vivekananda" },
  { iata:"BHU",lat:21.7522,lon:72.1852,name:"Bhavnagar" },
  { iata:"PYB",lat:18.9282,lon:84.1128,name:"Jeypore" },
  // ── Middle East ────────────────────────────────────────────────
  { iata:"DXB",lat:25.2532,lon:55.3657,name:"Dubai Intl" },
  { iata:"DOH",lat:25.2731,lon:51.6080,name:"Doha Hamad Intl" },
  { iata:"AUH",lat:24.4330,lon:54.6511,name:"Abu Dhabi Intl" },
  { iata:"RUH",lat:24.9576,lon:46.6988,name:"Riyadh King Khalid" },
  { iata:"JED",lat:21.6796,lon:39.1565,name:"Jeddah King Abdulaziz" },
  { iata:"MCT",lat:23.5933,lon:58.2844,name:"Muscat Intl" },
  { iata:"KWI",lat:29.2267,lon:47.9689,name:"Kuwait Intl" },
  { iata:"BAH",lat:26.2708,lon:50.6336,name:"Bahrain Intl" },
  // ── Europe ─────────────────────────────────────────────────────
  { iata:"LHR",lat:51.4775,lon:-0.4614,name:"London Heathrow" },
  { iata:"CDG",lat:49.0097,lon:2.5479, name:"Paris CDG" },
  { iata:"FRA",lat:50.0379,lon:8.5622, name:"Frankfurt" },
  { iata:"AMS",lat:52.3105,lon:4.7683, name:"Amsterdam Schiphol" },
  { iata:"MAD",lat:40.4720,lon:-3.5608,name:"Madrid Barajas" },
  { iata:"BCN",lat:41.2971,lon:2.0785, name:"Barcelona El Prat" },
  { iata:"MUC",lat:48.3538,lon:11.7861,name:"Munich" },
  { iata:"ZRH",lat:47.4647,lon:8.5492, name:"Zurich" },
  { iata:"VIE",lat:48.1103,lon:16.5697,name:"Vienna" },
  { iata:"FCO",lat:41.8003,lon:12.2389,name:"Rome Fiumicino" },
  { iata:"MXP",lat:45.6306,lon:8.7281, name:"Milan Malpensa" },
  { iata:"IST",lat:41.2608,lon:28.7418,name:"Istanbul" },
  { iata:"DUB",lat:53.4213,lon:-6.2701,name:"Dublin" },
  { iata:"BRU",lat:50.9014,lon:4.4844, name:"Brussels" },
  { iata:"LIS",lat:38.7813,lon:-9.1359,name:"Lisbon" },
  { iata:"ARN",lat:59.6519,lon:17.9186,name:"Stockholm Arlanda" },
  { iata:"OSL",lat:60.1939,lon:11.1004,name:"Oslo Gardermoen" },
  { iata:"HEL",lat:60.3183,lon:24.9497,name:"Helsinki Vantaa" },
  { iata:"CPH",lat:55.6180,lon:12.6560,name:"Copenhagen" },
  { iata:"WAW",lat:52.1657,lon:20.9671,name:"Warsaw Chopin" },
  { iata:"PRG",lat:50.1008,lon:14.2600,name:"Prague" },
  { iata:"BUD",lat:47.4298,lon:19.2611,name:"Budapest" },
  { iata:"ATH",lat:37.9364,lon:23.9445,name:"Athens" },
  // ── Asia Pacific ───────────────────────────────────────────────
  { iata:"SIN",lat:1.3644, lon:103.9915,name:"Singapore Changi" },
  { iata:"KUL",lat:2.7456, lon:101.7099,name:"Kuala Lumpur" },
  { iata:"BKK",lat:13.6811,lon:100.7472,name:"Bangkok Suvarnabhumi" },
  { iata:"CGK",lat:-6.1256,lon:106.6559,name:"Jakarta Soekarno-Hatta" },
  { iata:"MNL",lat:14.5086,lon:121.0197,name:"Manila Ninoy Aquino" },
  { iata:"HKG",lat:22.3080,lon:113.9185,name:"Hong Kong" },
  { iata:"ICN",lat:37.4602,lon:126.4407,name:"Seoul Incheon" },
  { iata:"NRT",lat:35.7648,lon:140.3864,name:"Tokyo Narita" },
  { iata:"HND",lat:35.5494,lon:139.7798,name:"Tokyo Haneda" },
  { iata:"PEK",lat:40.0799,lon:116.6031,name:"Beijing Capital" },
  { iata:"PVG",lat:31.1443,lon:121.8083,name:"Shanghai Pudong" },
  { iata:"CAN",lat:23.3924,lon:113.2988,name:"Guangzhou Baiyun" },
  { iata:"SYD",lat:-33.9461,lon:151.1772,name:"Sydney Kingsford Smith" },
  { iata:"MEL",lat:-37.6733,lon:144.8430,name:"Melbourne Tullamarine" },
  { iata:"CMB",lat:7.1808, lon:79.8841, name:"Colombo Bandaranaike" },
  { iata:"DAC",lat:23.8433,lon:90.3978, name:"Dhaka Hazrat Shahjalal" },
  { iata:"KTM",lat:27.6966,lon:85.3591, name:"Kathmandu Tribhuvan" },
  // ── Americas ───────────────────────────────────────────────────
  { iata:"JFK",lat:40.6413,lon:-73.7781,name:"New York JFK" },
  { iata:"LAX",lat:33.9425,lon:-118.408,name:"Los Angeles" },
  { iata:"ORD",lat:41.9742,lon:-87.9073,name:"Chicago O'Hare" },
  { iata:"ATL",lat:33.6367,lon:-84.4281,name:"Atlanta Hartsfield" },
  { iata:"DFW",lat:32.8998,lon:-97.0403,name:"Dallas Fort Worth" },
  { iata:"SFO",lat:37.6213,lon:-122.379,name:"San Francisco" },
  { iata:"MIA",lat:25.7959,lon:-80.2870,name:"Miami" },
  { iata:"YYZ",lat:43.6772,lon:-79.6306,name:"Toronto Pearson" },
  { iata:"GRU",lat:-23.4320,lon:-46.469,name:"São Paulo Guarulhos" },
  { iata:"MEX",lat:19.4363,lon:-99.072, name:"Mexico City" },
  { iata:"BOG",lat:4.7016, lon:-74.147, name:"Bogotá El Dorado" },
  // ── Africa ─────────────────────────────────────────────────────
  { iata:"JNB",lat:-26.134,lon:28.2420, name:"Johannesburg OR Tambo" },
  { iata:"CAI",lat:30.1219,lon:31.4056, name:"Cairo" },
  { iata:"NBO",lat:-1.3192,lon:36.9275, name:"Nairobi Jomo Kenyatta" },
  { iata:"ADD",lat:8.9779, lon:38.7993, name:"Addis Ababa Bole" },
  { iata:"LOS",lat:6.5774, lon:3.3216,  name:"Lagos Murtala Muhammed" },
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
      return res.json({
        isMock: false,
        noResults: true,
        flights: [],
        debugReason: `no_flights_found:${fromCode}-${toCode}`,
        message: `No flights found from ${fromCode} to ${toCode} on this date. Try a nearby major airport or different date.`
      });
    }

    // ── Parse Apify Google Flights response ───────────────────────
    const page = items[0];
    const bestFlights  = Array.isArray(page?.best_flights)  ? page.best_flights  : [];
    const otherFlights = Array.isArray(page?.other_flights) ? page.other_flights : [];
    const allFlights   = [...bestFlights, ...otherFlights];

    if (!allFlights.length) {
      console.warn("   No flights in best_flights or other_flights");
      return res.json({
        isMock: false,
        noResults: true,
        flights: [],
        message: `No flights found from ${fromCode} to ${toCode}. This route may not have direct service — try searching via a hub airport.`
      });
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