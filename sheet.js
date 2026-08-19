// netlify/functions/sheet.js
//
// This function sits between your website and your Google Sheet.
// Instead of every visitor's browser calling Google Sheets directly (which gets
// slow when many people load the page at once), everyone's browser calls THIS
// function, and this function only actually asks Google for fresh data once
// every CACHE_SECONDS — everyone else in that window gets the cached copy instantly.
//
// You do not need to edit this file. Just deploy it (see NETLIFY-FUNCTION-SETUP.md).

const SHEET_ID = '1rJ6UcItHvhrHhlucy8veoFfKsDDLUafjBvhNlQIZxeo';
const CACHE_SECONDS = 12;

// In-memory cache. Persists only while this function instance stays "warm",
// which in practice covers bursts of traffic (e.g. everyone refreshing during
// a tournament) — exactly the situation this is meant to help with.
const store = new Map();

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=' + CACHE_SECONDS,
  };

  const name = event.queryStringParameters && event.queryStringParameters.name;
  const range = event.queryStringParameters && event.queryStringParameters.range;
  if (!name) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing ?name=SheetTabName' }) };
  }

  const cacheKey = name + '|' + (range || '');
  const now = Date.now();
  const cached = store.get(cacheKey);
  if (cached && now - cached.at < CACHE_SECONDS * 1000) {
    return { statusCode: 200, headers, body: JSON.stringify({ table: cached.table, cached: true }) };
  }

  try {
    let url =
      'https://docs.google.com/spreadsheets/d/' +
      SHEET_ID +
      '/gviz/tq?sheet=' +
      encodeURIComponent(name) +
      '&tqx=out:json';
    if (range) url += '&range=' + encodeURIComponent(range);

    const res = await fetch(url);
    const text = await res.text();
    // gviz wraps the JSON in: google.visualization.Query.setResponse({...});
    const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonStr);
    const table = parsed.table;

    store.set(cacheKey, { at: now, table });
    return { statusCode: 200, headers, body: JSON.stringify({ table, cached: false }) };
  } catch (err) {
    if (cached) {
      // Google hiccuped — serve the last good copy rather than failing.
      return { statusCode: 200, headers, body: JSON.stringify({ table: cached.table, cached: true, stale: true }) };
    }
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'fetch failed', detail: String(err) }) };
  }
};
