// i18n utility functions

/**
 * Get localized message from Chrome i18n API
 * @param messageName - The message key defined in messages.json
 * @param substitutions - Optional substitution strings for placeholders
 * @returns The localized message string
 */
export function getMessage (messageName: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(messageName, substitutions) || messageName
}

/**
 * Shorthand alias for getMessage
 */
export const t = getMessage
