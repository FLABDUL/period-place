const fullUkPostcode = /^(GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})$/i;

export function normaliseUkPostcode(value: string) {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!fullUkPostcode.test(compact)) return null;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export async function geocodeUkPostcode(postcode: string) {
  const normalised = normaliseUkPostcode(postcode);
  if (!normalised) return null;
  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(normalised)}`, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { result?: { latitude?: number; longitude?: number } };
    const latitude = payload.result?.latitude;
    const longitude = payload.result?.longitude;
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { postcode: normalised, latitude: Number(latitude), longitude: Number(longitude) }
      : null;
  } catch {
    return null;
  }
}
