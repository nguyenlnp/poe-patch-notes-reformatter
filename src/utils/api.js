/**
 * API Utility for communicating with the local Express proxy server.
 */

const API_BASE = '/api';

/**
 * Fetches and parses a Path of Exile forum thread.
 * @param {string} url - The full URL to the forum thread
 * @returns {Promise<Object>} The parsed changelog data
 */
export async function fetchChangelog(url) {
  const response = await fetch(`${API_BASE}/fetch-changelog`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }

  const resJson = await response.json();
  return resJson.data;
}

/**
 * Parses raw text input.
 * @param {string} text - Raw pasted patch notes text
 * @returns {Promise<Object>} The parsed changelog data
 */
export async function parseText(text) {
  const response = await fetch(`${API_BASE}/parse-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }

  const resJson = await response.json();
  return resJson.data;
}

