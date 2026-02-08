/**
 * Returns the singular or plural form of a German word based on count.
 * Follows the pattern: 0 = plural, 1 = singular, 2+ = plural.
 *
 * @param count - The number to determine form
 * @param singular - The singular form (e.g., "Stimme")
 * @param plural - The plural form (e.g., "Stimmen")
 * @returns The appropriate form based on count
 */
export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
