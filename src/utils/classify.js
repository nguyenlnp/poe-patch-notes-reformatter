/**
 * Client-side classification utilities for rendering.
 */

// SVG Icons for different change types
export const ICONS = {
  buff: '<svg viewBox="0 0 16 16"><polygon points="8,2 14,10 2,10"/></svg>',
  nerf: '<svg viewBox="0 0 16 16"><polygon points="8,14 14,6 2,6"/></svg>',
  new: '<svg viewBox="0 0 16 16"><polygon points="8,1 10,6 15,6 11,9.5 12.5,15 8,11.5 3.5,15 5,9.5 1,6 6,6"/></svg>',
  fix: '<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  rework: '<svg viewBox="0 0 16 16"><path d="M13.5 8A5.5 5.5 0 1 1 8 2.5v-2L11 4 8 7.5v-2A3.5 3.5 0 1 0 11.5 8h2z" fill="currentColor"/></svg>',
  neutral: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" fill="currentColor"/></svg>'
};

/**
 * Returns the appropriate icon SVG for a given change type.
 */
export function getIconForType(type) {
  return ICONS[type] || ICONS.neutral;
}

/**
 * Formats a diff string based on old/new values.
 */
export function formatDiff(oldValue, newValue, changeDirection, type) {
  if (!oldValue || !newValue) return '';

  let diffHtml = `<div class="diff-container">
    <span class="diff-old">${escapeHtml(oldValue)}</span>
    <span class="diff-arrow">→</span>
    <span class="diff-new">${escapeHtml(newValue)}</span>
  `;

  // Optional percentage calculation if numeric
  const oldNum = extractNumber(oldValue);
  const newNum = extractNumber(newValue);
  
  if (oldNum !== null && newNum !== null && oldNum !== 0) {
    const percentChange = ((newNum - oldNum) / oldNum) * 100;
    // Only show if it's a meaningful percentage (between 1% and 1000%)
    if (Math.abs(percentChange) >= 1 && Math.abs(percentChange) <= 1000) {
      const sign = percentChange > 0 ? '+' : '';
      const formattedPercent = `${sign}${Math.round(percentChange)}%`;
      const isBuff = type === 'buff' || (percentChange > 0 && type !== 'nerf');
      const modifierClass = isBuff ? 'diff-percent--buff' : 'diff-percent--nerf';
      diffHtml += `<span class="diff-percent ${modifierClass}">${formattedPercent}</span>`;
    }
  }

  diffHtml += `</div>`;
  return diffHtml;
}

/**
 * Extracts a numeric value from a string (handles decimals, percentages, ranges).
 * Uses the average for ranges (e.g., "10-20" -> 15).
 */
function extractNumber(str) {
  // Try to match a range first (e.g. 10-20 or 10 to 20)
  const rangeMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return (min + max) / 2;
  }

  // Fallback to first single number
  const singleMatch = str.match(/-?\d+(?:\.\d+)?/);
  if (singleMatch) {
    return parseFloat(singleMatch[0]);
  }
  return null;
}

/**
 * Escapes HTML characters for safe injection.
 */
function escapeHtml(unsafe) {
  return (unsafe || '').toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
