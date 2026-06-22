const RAD = Math.PI / 180;

function dayOfYear(date: Date): number {
  return Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
}

/** Returns sunrise and sunset as fractional UTC hours (e.g. 11.5 = 11:30 UTC). */
export function getSunTimes(lat: number, lon: number, date: Date) {
  const declination = -23.45 * Math.cos(RAD * (360 / 365) * (dayOfYear(date) + 10));
  const cosH = -Math.tan(lat * RAD) * Math.tan(declination * RAD);
  // Clamp to [-1,1] to avoid NaN at extreme latitudes (midnight sun / polar night).
  const hourAngle = Math.acos(Math.max(-1, Math.min(1, cosH))) / RAD;
  const lonOffset = lon / 15;
  return {
    sunriseUTC: 12 - hourAngle / 15 - lonOffset,
    sunsetUTC:  12 + hourAngle / 15 - lonOffset,
  };
}

/** Returns true if the sun is currently up at the given coordinates. */
export function isSunUp(lat: number, lon: number, date: Date = new Date()): boolean {
  const nowUTC = date.getUTCHours() + date.getUTCMinutes() / 60;
  const { sunriseUTC, sunsetUTC } = getSunTimes(lat, lon, date);
  return nowUTC >= sunriseUTC && nowUTC < sunsetUTC;
}
