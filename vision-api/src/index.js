import Anthropic from "@anthropic-ai/sdk";

// Estimates what is on a meal photo: foods, grams, calories and macros.
// The Saboria page sends { image, media_type, lang } and gets JSON back.

const MODEL = "claude-opus-5";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];

const SCHEMA = {
  type: "object",
  properties: {
    is_food: { type: "boolean" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          grams: { type: "number" },
          kcal: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" }
        },
        required: ["name", "grams", "kcal", "protein_g", "carbs_g", "fat_g"],
        additionalProperties: false
      }
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    note: { type: "string" }
  },
  required: ["is_food", "items", "confidence", "note"],
  additionalProperties: false
};

function prompt(lang) {
  const language = lang === "es" ? "Spanish (Mexico)" : "English";
  return `You estimate nutrition from a photo of a meal for a calorie-tracking app.

List each separate food you can see as its own item (for example: rice, chicken, salad, tortillas, a drink). For each one, estimate the portion in grams from visual cues such as plate size, utensils and hands, then give calories, protein, carbs and fat for that portion, based on typical values for how it looks prepared (fried, grilled, with sauce).

Count cooking oil, dressings and sauces you can see, because that is where people most often under-count. If something is hidden or unclear, make your best typical guess and mention it in the note.

Set confidence to "low" when the portion is hard to judge (bowls, mixed dishes, food partly out of frame). If the photo shows no food, set is_food to false and return no items.

Write the food names and the note in ${language}. Keep the note to one short sentence.`;
}

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function json(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(env) }
  });
}

export async function analyzeMeal(client, { image, media_type, lang }) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type, data: image } },
        { type: "text", text: prompt(lang) }
      ]
    }]
  });
  if (response.stop_reason === "refusal") return { error: "refused" };
  if (response.stop_reason === "max_tokens") return { error: "truncated" };
  const text = response.content.find(b => b.type === "text");
  if (!text) return { error: "empty" };
  const out = JSON.parse(text.text);
  const r = n => Math.max(0, Math.round(Number(n) || 0));
  out.items = out.items.map(i => ({
    name: i.name, grams: r(i.grams), kcal: r(i.kcal),
    protein_g: r(i.protein_g), carbs_g: r(i.carbs_g), fat_g: r(i.fat_g)
  }));
  out.total_kcal = out.items.reduce((s, i) => s + i.kcal, 0);
  return out;
}

// Open Food Facts asks apps to identify themselves with a User-Agent, which
// browsers can't set. The app sends barcode and name lookups through here.
async function openFoodFacts(url, env, ctx) {
  const path = url.pathname.replace(/^\/off/, "");
  let target;
  if (/^\/product\/\d{6,14}$/.test(path)) {
    target = "https://world.openfoodfacts.org/api/v2" + path + ".json";
  } else if (path === "/search" && url.searchParams.get("q")) {
    const q = url.searchParams.get("q").slice(0, 80);
    target = "https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=8&search_terms=" + encodeURIComponent(q);
  } else {
    return json({ error: "not_found" }, 404, env);
  }
  const cache = caches.default;
  const key = new Request(target);
  const hit = await cache.match(key);
  if (hit) return new Response(hit.body, { headers: { "Content-Type": "application/json", ...cors(env) } });
  const r = await fetch(target, { headers: { "User-Agent": `Saboria/1.0 (${env.OFF_CONTACT || "saboria app"})` } });
  if (!r.ok) return json({ error: "upstream" }, 502, env);
  const body = await r.text();
  ctx.waitUntil(cache.put(key, new Response(body, { headers: { "Cache-Control": "public, max-age=86400" } })));
  return new Response(body, { headers: { "Content-Type": "application/json", ...cors(env) } });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(env) });
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname.startsWith("/off/")) return openFoodFacts(url, env, ctx);
    if (request.method !== "POST") return json({ error: "method" }, 405, env);
    const origin = request.headers.get("Origin");
    if (env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== "*" && origin !== env.ALLOWED_ORIGIN) {
      return json({ error: "origin" }, 403, env);
    }
    let body;
    try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400, env); }
    const { image, media_type, lang } = body || {};
    if (typeof image !== "string" || !MEDIA_TYPES.includes(media_type)) return json({ error: "bad_image" }, 400, env);
    if (image.length * 0.75 > MAX_IMAGE_BYTES) return json({ error: "too_big" }, 413, env);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const out = await analyzeMeal(client, { image, media_type, lang });
      return json(out, out.error ? 422 : 200, env);
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return json({ error: "busy" }, 429, env);
      if (e instanceof Anthropic.APIError) return json({ error: "upstream" }, 502, env);
      if (e instanceof SyntaxError) return json({ error: "parse" }, 502, env);
      throw e;
    }
  }
};
