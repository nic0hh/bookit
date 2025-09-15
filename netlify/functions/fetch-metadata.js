
const cheerio = require('cheerio');

exports.handler = async function(event) {
  console.log('fetch-metadata invoked', event.queryStringParameters);
  const url = (event.queryStringParameters && event.queryStringParameters.url) || '';
  if (!url || !/^https?:\/\//i.test(url)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid or missing URL' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'BookitBot/1.0' }
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error('Fetch failed: ' + response.status);

    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      ($('meta[property="og:title"]').attr('content') || $('title').text() || '').trim();
    const image = (
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      ''
    ).trim();
    const description = (
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      ''
    ).trim();

    return {
      statusCode: 200,
      body: JSON.stringify({ title, image, description }),
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }
    };
  } catch (e) {
    console.error('fetch-metadata error', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch metadata' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};