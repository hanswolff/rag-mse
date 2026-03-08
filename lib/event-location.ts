interface ShootingRangeAddressData {
  name: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
}

function normalizeRangeName(value: string): string {
  return value.trim().toLowerCase();
}

export function getRangeNameFromLocation(location: string): string {
  const [namePart] = location.split(",");
  return namePart?.trim() ?? location.trim();
}

export function formatShootingRangeAddress(range: Pick<ShootingRangeAddressData, "street" | "postalCode" | "city">): string {
  const street = range.street?.trim() || "";
  const cityLine = [range.postalCode?.trim(), range.city?.trim()].filter(Boolean).join(" ").trim();

  if (street && cityLine) {
    return `${street}, ${cityLine}`;
  }
  return street || cityLine;
}

export function createShootingRangeLookup(
  ranges: ShootingRangeAddressData[]
): Map<string, ShootingRangeAddressData> {
  return new Map(ranges.map((range) => [normalizeRangeName(range.name), range]));
}

export function getEventLocationDisplay(
  location: string,
  rangeLookup: Map<string, ShootingRangeAddressData>
): string {
  const rangeName = getRangeNameFromLocation(location);
  const matchedRange = rangeLookup.get(normalizeRangeName(rangeName));

  if (!matchedRange) {
    return location;
  }

  const address = formatShootingRangeAddress(matchedRange);
  if (!address) {
    return location;
  }

  return `${matchedRange.name}, ${address}`;
}
