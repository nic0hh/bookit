const cheerio = require('cheerio');
const Anthropic = require('@anthropic-ai/sdk');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const TAG_SCHEMA = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['tags'],
  additionalProperties: false
};

const SYSTEM_PROMPT = [
  "You generate concise, lowercase, searchable tags for a bookmarked web page so the user can find it again later.",
  "Return 3 to 8 tags.",
  "Prefer reusing one of the user's existing tags when it genuinely fits, rather than inventing a near-duplicate.",
  "Include both generic descriptive tags and, when the page is from a specialty or hobby site, specific terms actually present in the content (materials, techniques, sizes, etc.).",
  "Never guess or invent details that are not present in the given content.",
  "Each tag is a single word or short hyphenated phrase, lowercase, at most 32 characters, no punctuation besides hyphens."
].join(' ');

function normalizeTags(rawTags) {
  const seen = new Set();
  const out = [];
  for (const t of rawTags || []) {
    if (typeof t !== 'string') continue;
    const clean = t.trim().toLowerCase().slice(0, 32);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

async function scrapePageContent(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'BookitBot/1.0' }
    });
    if (!response.ok) throw new Error('Fetch failed: ' + response.status);

    const html = await response.text();
    const $ = cheerio.load(html);

    const description = (
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      ''
    ).trim();

    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 3000);

    return { description, bodyText };
  } finally {
    clearTimeout(timeout);
  }
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { title, url, existingTags, folderName } = payload;
  if (!title || !url) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'title and url are required' }) };
  }

  let description = '';
  let bodyText = '';
  try {
    const scraped = await scrapePageContent(url);
    description = scraped.description;
    bodyText = scraped.bodyText;
  } catch (e) {
    // Fall back to title-only context if the page can't be fetched/scraped.
  }

  const existingTagsList = Array.isArray(existingTags) && existingTags.length > 0
    ? existingTags.slice(0, 40).join(', ')
    : '(none yet)';

  const userContent = [
    `Title: ${title}`,
    `URL: ${url}`,
    folderName ? `Folder: ${folderName}` : null,
    `Page description: ${description || '(none found)'}`,
    bodyText ? `Page text excerpt: ${bodyText}` : null,
    `User's existing tags (reuse when they genuinely fit): ${existingTagsList}`,
  ].filter(Boolean).join('\n');

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
      output_config: {
        format: { type: 'json_schema', schema: TAG_SCHEMA }
      }
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const parsed = textBlock ? JSON.parse(textBlock.text) : { tags: [] };
    const tags = normalizeTags(parsed.tags);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ tags })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to generate tags' })
    };
  }
};
