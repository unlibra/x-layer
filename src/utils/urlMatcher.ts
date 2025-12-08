import type { Preset } from '../types'

/**
 * Convert glob pattern to regex pattern
 * @param pattern - URL pattern with wildcards (*)
 * @returns RegExp object for matching URLs
 */
export function patternToRegex (pattern: string): RegExp {
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${regexPattern}$`)
}

/**
 * Check if a URL matches a pattern
 * @param url - URL to test
 * @param pattern - URL pattern with wildcards
 * @returns true if URL matches the pattern
 */
export function matchesPattern (url: string, pattern: string): boolean {
  try {
    const regex = patternToRegex(pattern)
    return regex.test(url)
  } catch {
    return false
  }
}

/**
 * Check if a URL matches any of the preset's patterns
 * @param url - URL to test
 * @param preset - Preset with urlPatterns
 * @returns true if URL matches any pattern
 */
export function matchesPreset (url: string, preset: Preset): boolean {
  return preset.urlPatterns.some((pattern) => matchesPattern(url, pattern))
}

/**
 * Count wildcards in a pattern (for specificity calculation)
 * @param pattern - URL pattern
 * @returns number of wildcards
 */
export function countWildcards (pattern: string): number {
  return (pattern.match(/\*/g) || []).length
}

/**
 * Get specificity score for a preset (fewer wildcards = more specific)
 * @param preset - Preset with urlPatterns
 * @returns specificity score (lower = more specific)
 */
export function getSpecificity (preset: Preset): number {
  if (preset.urlPatterns.length === 0) return Infinity
  // Use the first pattern for specificity (or could use min across all patterns)
  return countWildcards(preset.urlPatterns[0])
}

/**
 * Find all matching presets for a URL, sorted by specificity
 * @param url - URL to match against
 * @param presets - Array of presets to search
 * @param enabledOnly - If true, only return enabled presets
 * @returns Array of matching presets, sorted by specificity (most specific first)
 */
export function findMatchingPresets (
  url: string,
  presets: Preset[],
  enabledOnly: boolean = false
): Preset[] {
  return presets
    .filter((preset) => {
      if (enabledOnly && !preset.enabled) return false
      return matchesPreset(url, preset)
    })
    .sort((a, b) => getSpecificity(a) - getSpecificity(b))
}

/**
 * Combine CSS from multiple presets
 * @param presets - Array of presets
 * @returns Combined CSS string
 */
export function combineCss (presets: Preset[]): string {
  return presets.map((p) => p.css).join('\n\n')
}
