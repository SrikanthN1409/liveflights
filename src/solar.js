export function getSolarPosition(date = new Date()) {
  const rad = Math.PI / 180;

  const time = date.getTime();
  const julianDay = time / 86400000 + 2440587.5;
  const n = julianDay - 2451545.0;

  const L = (280.46 + 0.9856474 * n) % 360;
  const g = (357.528 + 0.9856003 * n) % 360;

  const lambda = L + 1.915 * Math.sin(g * rad) + 0.02 * Math.sin(2 * g * rad);
  const epsilon = 23.439 - 0.0000004 * n;

  const declination =
    Math.asin(Math.sin(epsilon * rad) * Math.sin(lambda * rad)) / rad;

  const timeUTC =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;

  const subSolarLongitude = (180 - timeUTC * 15) % 360;

  return {
    latitude: declination,
    longitude: subSolarLongitude,
  };
}