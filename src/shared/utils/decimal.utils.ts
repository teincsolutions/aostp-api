/**
 * Utility functions for handling decimal precision in financial calculations
 */

/**
 * Round a number to 2 decimal places
 * Used for all currency amounts and rates to ensure consistency
 * and avoid incomplete payments due to floating point precision issues
 *
 * @param value - The number to round
 * @returns The number rounded to 2 decimal places
 *
 * @example
 * roundToTwoDecimals(10.12345) // 10.12
 * roundToTwoDecimals(10.126) // 10.13
 * roundToTwoDecimals(10) // 10.00
 */
export function roundToTwoDecimals(value: number | null | undefined): number {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

/**
 * Round multiple values to 2 decimal places
 *
 * @param values - Array of numbers to round
 * @returns Array of numbers rounded to 2 decimal places
 */
export function roundAllToTwoDecimals(
  values: (number | null | undefined)[],
): number[] {
  return values.map(roundToTwoDecimals);
}

/**
 * Calculate and round a result to 2 decimal places
 * Useful for inline calculations
 *
 * @param calculation - Function that returns the calculation result
 * @returns The calculated value rounded to 2 decimal places
 *
 * @example
 * calculateAndRound(() => 10.5 * 1.234) // 12.96
 */
export function calculateAndRound(calculation: () => number): number {
  return roundToTwoDecimals(calculation());
}
