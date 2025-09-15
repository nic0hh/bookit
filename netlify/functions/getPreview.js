// netlify/functions/getPreview.js
const axios = require("axios");
const cheerio = require("cheerio");
const { URL } = require("url");

exports.handler = async function (event, context) {
  try {
    const { url } = JSON.parse(event.body);

    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing URL" }),
      };
    }

    // Fetch the page
    const { data } = await axios.get(url, { timeout: 8000 });
    const $ = cheerio.load(data);

    // --- Title fallbacks ---
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("meta[name='twitter:title']").attr("content") ||
      $("title").text() ||
      "No title";

    // --- Image fallbacks ---
    let image =
      $("meta[property='og:image']").attr("content") ||
      $("meta[name='twitter:image']").attr("content") ||
      $("meta[property='og:image:url']").attr("content") ||
      $("meta[property='og:image:secure_url']").attr("content") ||
      $("link[rel='apple-touch-icon']").attr("href") ||
      $("link[rel='icon']").attr("href") ||
      $("link[rel='shortcut icon']").attr("href") ||
      null;

    // Normalize image URL if relative or protocol-relative
    if (image) {
      try {
        const base = new URL(url);
        if (image.startsWith("//")) {
          image = base.protocol + image; // handle //cdn...
        } else if (image.startsWith("/")) {
          image = base.origin + image; // handle /path/to/img.jpg
        } else if (!/^https?:/i.test(image)) {
          // handle relative like "images/thumb.png"
          image = base.origin + "/" + image.replace(/^\/+/, "");
        }
      } catch (e) {
        console.warn("Failed to resolve image URL:", e.message);
      }
    }

    // --- Special handling for OpenLibrary ---
    if (url.includes("openlibrary.org")) {
      let foundOlid = null;

      // 1. Try to extract OLID from /books/OLxxxxM in URL
      const olidMatch = url.match(/\/books\/(OL\d+M)/);
      if (olidMatch) {
        foundOlid = olidMatch[1];
      }

      // 2. Try to extract OLID from query string (?edition=key:/books/OLxxxxM)
      if (!foundOlid) {
        const query = url.split("?")[1];
        if (query) {
          const params = new URLSearchParams(query);
          const editionKey = params.get("edition");
          if (editionKey) {
            const editionOlidMatch = editionKey.match(/OL\d+M/);
            if (editionOlidMatch) {
              foundOlid = editionOlidMatch[0];
            }
          }
        }
      }

      // 3. If we have an OLID, use the OpenLibrary API
      if (foundOlid) {
        const apiUrl = `https://openlibrary.org/api/books?bibkeys=OLID:${foundOlid}&format=json&jscmd=data`;
        try {
          const apiRes = await axios.get(apiUrl);
          const bookData = apiRes.data[`OLID:${foundOlid}`];
          if (bookData && bookData.cover && bookData.cover.large) {
            image = bookData.cover.large;
          }
        } catch (e) {
          // ignore API errors
        }
      }

      // 4. Fallbacks (img tags, JSON-LD, regex) if no image found
      if (!image) {
        const imgSrc = $("img").map((i, el) => $(el).attr("src")).get();
        const coverImg = imgSrc.find((src) => src && src.includes("/b/id/"));
        if (coverImg) {
          image = coverImg.startsWith("http") ? coverImg : `https:${coverImg}`;
        } else {
          const jsonLd = $("script[type='application/ld+json']").html();
          if (jsonLd) {
            try {
              const ld = JSON.parse(jsonLd);
              if (ld.image) {
                image = Array.isArray(ld.image) ? ld.image[0] : ld.image;
              }
            } catch (e) {}
          }
        }
        if (!image) {
          const coverIdMatch = data.match(/covers\/(\d+)-/);
          if (coverIdMatch) {
            image = `https://covers.openlibrary.org/b/id/${coverIdMatch[1]}-L.jpg`;
          }
        }
      }

      // 5. Fallback: Try to extract cover ID from JSON-LD on /works/ pages
      if (!image && url.includes("/works/")) {
        const jsonLd = $("script[type='application/ld+json']").html();
        if (jsonLd) {
          try {
            const ld = JSON.parse(jsonLd);
            // OpenLibrary works JSON-LD sometimes has a "covers" array
            if (ld.covers && Array.isArray(ld.covers) && ld.covers.length > 0) {
              // Use the first cover ID
              image = `https://covers.openlibrary.org/b/id/${ld.covers[0]}-L.jpg`;
            }
          } catch (e) {}
        }
      }
    }

    // 6. FINAL FALLBACK: Use LinkPreview API if no image found yet
    if (!image && process.env.LINKPREVIEW_KEY) {
      try {
        const lpRes = await axios.get(
          `https://api.linkpreview.net/?key=${process.env.LINKPREVIEW_KEY}&q=${encodeURIComponent(url)}`
        );
        if (lpRes.data && lpRes.data.image) {
          image = lpRes.data.image;
        }
      } catch (e) {
        // ignore LinkPreview errors
      }
    }

    // 7. ABSOLUTE FINAL: Use a default image if still nothing found
    const DEFAULT_IMAGE = "https://i.imgur.com/3y7vqYI.png";
    if (!image) {
      image = DEFAULT_IMAGE;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ title, image }),
    };
  } catch (err) {
    console.error("Preview error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch preview" }),
    };
  }
};
