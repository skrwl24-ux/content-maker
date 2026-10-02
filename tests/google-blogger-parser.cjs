const test = require("node:test");
const assert = require("node:assert/strict");

const expectedSlug = "chatgpt-claude-gemini-price-south-korea-2026";
const description = "Compare ChatGPT Plus, Claude Pro and Google AI Pro prices in South Korea, including KRW rates, VAT treatment, web and mobile payment methods.";
const imageMarkers = ["00", "01", "02", "03", "04", "05"].map(id => "[IMAGE " + id + " — Image]").join("\n");
const html = imageMarkers + "\n<h2>Comparison</h2><p>Monthly prices.</p>";
const fixture = ["[FINAL_TITLE]", "ChatGPT vs Claude vs Gemini Price in South Korea 2026",
  "[META_DESCRIPTION]", description, "[SLUG]", expectedSlug,
  "[LABELS]", "AI Pricing, South Korea, ChatGPT, Claude AI",
  "[BLOGGER_HTML]", html, "[/BLOGGER_HTML]"].join("\n");
const parse = async raw => (await import("../lib/google-blogger-parser.mjs")).parseBloggerOutput(raw, expectedSlug);

test("extracts correctly formatted ChatGPT output", async () => {
  const result = await parse(fixture);
  assert.equal(result.valid, true, result.errors.join(" / "));
  assert.equal(result.title, "ChatGPT vs Claude vs Gemini Price in South Korea 2026");
  assert.equal(result.description, description);
  assert.equal(result.slug, expectedSlug);
  assert.equal(result.labels, "AI Pricing, South Korea, ChatGPT, Claude AI");
  assert.equal(result.html, html);
});

test("handles collapsed/newline-free rich-text paste", async () => {
  const result = await parse(fixture.replace(/\n/g, " "));
  assert.equal(result.valid, true, result.errors.join(" / "));
  assert.equal(result.slug, expectedSlug);
  assert.ok(!result.title.includes("[META_DESCRIPTION]"));
  assert.ok(!result.labels.includes("<h2>"));
});

test("handles Windows CRLF paste", async () => {
  const result = await parse(fixture.replace(/\n/g, "\r\n"));
  assert.equal(result.valid, true, result.errors.join(" / "));
});

test("removes copy-added stray slashes before HTML tags", async () => {
  const input = fixture.replace("<h2>Comparison</h2><p>Monthly prices.</p>",
    String.raw`\<h2>Comparison\</h2> \ <p>Monthly prices.\</p>`);
  const result = await parse(input);
  assert.equal(result.valid, true, result.errors.join(" / "));
  assert.match(result.html, /<h2>Comparison<\/h2>/);
  assert.ok(!result.html.includes("\\<"));
});

test("rejects missing, duplicate or reordered delimiters without spilling fields", async () => {
  for (const input of [
    fixture.replace("[SLUG]", ""),
    fixture.replace("[LABELS]", "[LABELS][LABELS]"),
    fixture.replace("[SLUG]", "[LABELS]").replace("[LABELS]\nAI Pricing", "[SLUG]\nAI Pricing"),
  ]) {
    const result = await parse(input);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length);
    assert.equal(result.title, "");
  }
});

test("blocks HTML or marker contamination in metadata", async () => {
  for (const input of [
    fixture.replace("ChatGPT vs Claude vs Gemini Price in South Korea 2026", "Test <p>bad</p>"),
    fixture.replace("Claude AI\n[BLOGGER_HTML]", "Claude AI <p>bad</p>\n[BLOGGER_HTML]"),
  ]) {
    const result = await parse(input);
    assert.equal(result.valid, false);
  }
});

test("enforces fixed slug and six image placeholders", async () => {
  assert.equal((await parse(fixture.replace(expectedSlug + "\n[LABELS]", "wrong-slug\n[LABELS]"))).valid, false);
  assert.equal((await parse(fixture.replace("[IMAGE 05 — Image]", ""))).valid, false);
});

test("rejects forbidden embedded script in Blogger HTML", async () => {
  const result = await parse(fixture.replace("<h2>Comparison</h2>", "<script>alert(1)</script><h2>Comparison</h2>"));
  assert.equal(result.valid, false);
});
