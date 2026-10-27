/**
 * Contract limits and domain constraints for Panel.
 * Pinned to Panel.sol constants.
 */

export const MAX_QUESTION = 120;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
export const MAX_OPTION_LEN = 32;
export const MIN_RESPONSES = 1;
export const MAX_RESPONSES = 1000;
export const MIN_DURATION = 3600; // 1 hour
export const MAX_DURATION = 7776000; // 90 days (90 * 86400)
