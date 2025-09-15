const fetch = require('node-fetch');
const cheerio = require('cheerio');

exports.handler = async function(event) {
  const url = (event.queryStringParameters && event.queryStringParameters.url) || '';
  if (!url || !/^https?:\/\//i.test(url)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid or missing URL' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  try {
    const response = await fetch(url, { timeout: 7000, headers: { 'User-Agent': 'BookitBot/1.0' } });
    if (!response.ok) throw new Error('Failed to fetch URL');
    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').text() ||
      '';
    const image =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      '';
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    return {
      statusCode: 200,
      body: JSON.stringify({
        title: title.trim(),
        image: image.trim(),
        description: description.trim(),
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch metadata' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};