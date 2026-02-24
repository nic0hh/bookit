const cheerio = require('cheerio');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  const url = (event.queryStringParameters && event.queryStringParameters.url) || '';
  if (!url || !/^https?:\/\//i.test(url)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid or missing URL' }),
      headers: corsHeaders
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

    // Get image dimensions if image URL exists
    let imageWidth = null;
    let imageHeight = null;
    
    if (image) {
      try {
        const imageResponse = await fetch(image, {
          method: 'HEAD',
          headers: { 'User-Agent': 'BookitBot/1.0' }
        });
        
        // Try to get dimensions from og:image meta tags
        const ogWidth = $('meta[property="og:image:width"]').attr('content');
        const ogHeight = $('meta[property="og:image:height"]').attr('content');
        
        if (ogWidth && ogHeight) {
          imageWidth = parseInt(ogWidth);
          imageHeight = parseInt(ogHeight);
        }
      } catch (err) {}
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ title, image, description, imageWidth, imageHeight }),
      headers: corsHeaders
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch metadata' }),
      headers: corsHeaders
    };
  }
};