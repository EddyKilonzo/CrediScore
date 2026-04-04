/**
 * East Africa onboarding often saves ~(-1.3, 36.8) but some clients store (36.8, -1.3).
 * UAE (~24, 54) does not match this pattern.
 */
export function correctLikelyEastAfricaLatLngSwap(
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { lat, lng };
  }
  if (lat >= 28 && lat <= 48 && lng >= -6 && lng <= 6 && Math.abs(lat) > Math.abs(lng) + 10) {
    return { lat: lng, lng: lat };
  }
  return { lat, lng };
}

/** Bias Nominatim toward the right country so a street name does not resolve to UAE (or elsewhere). */
export function inferNominatimCountryCodes(locationText: string): string | undefined {
  const t = locationText.toLowerCase();
  if (
    /\bkenya\b|\bnairobi\b|\bmombasa\b|\bkisumu\b|\bnakuru\b|\beldoret\b|\bwestlands\b|\bkileleshwa\b|\bkilifi\b|\bnyeri\b|\bthika\b|\bmalindi\b/.test(
      t,
    )
  ) {
    return 'ke';
  }
  if (/\btanzania\b|\bdar es salaam\b|\barusha\b|\bdodoma\b/.test(t)) {
    return 'tz';
  }
  if (/\buganda\b|\bkampala\b/.test(t)) {
    return 'ug';
  }
  if (/\brwanda\b|\bkigali\b/.test(t)) {
    return 'rw';
  }
  if (/\buae\b|\bdubai\b|\babu dhabi\b|\bsharjah\b|\bunited arab emirates\b/.test(t)) {
    return 'ae';
  }
  return undefined;
}
