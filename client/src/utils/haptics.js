/**
 * Haptic feedback utilities for mobile devices
 * Provides vibration feedback for important actions
 */

/**
 * Success vibration pattern (short-medium-short)
 */
export function vibrateSuccess() {
  if ('vibrate' in navigator) {
    navigator.vibrate([50, 30, 50]);
  }
}

/**
 * Error vibration pattern (longer single vibration)
 */
export function vibrateError() {
  if ('vibrate' in navigator) {
    navigator.vibrate([100]);
  }
}

/**
 * Light tap feedback (very short vibration)
 */
export function vibrateTap() {
  if ('vibrate' in navigator) {
    navigator.vibrate(20);
  }
}

/**
 * Warning vibration pattern (medium pulses)
 */
export function vibrateWarning() {
  if ('vibrate' in navigator) {
    navigator.vibrate([75, 50, 75]);
  }
}
