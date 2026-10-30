import assert from "node:assert/strict";
import contact from "../api/contact.ts";

function request(body, method = "POST", contentType = "application/json") {
  return new Request("https://www.anikeaty08.tech/api/contact", {
    method,
    headers: { "Content-Type": contentType },
    ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
  });
}

const valid = { name: "A Visitor", email: "visitor@example.com", message: "Hello, I would like to talk about a project." };

assert.equal((await contact.fetch(request(null, "GET"))).status, 405);
assert.equal((await contact.fetch(request("not json"))).status, 400);
assert.equal((await contact.fetch(request({ ...valid, message: "short" }))).status, 400);
assert.equal((await contact.fetch(request({ ...valid, website: "spam.example" }))).status, 200);

const oldKey = process.env.RESEND_API_KEY;
const oldFrom = process.env.RESEND_FROM_EMAIL;
const originalFetch = globalThis.fetch;

try {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  assert.equal((await contact.fetch(request(valid))).status, 503);

  process.env.RESEND_API_KEY = "test-key";
  process.env.RESEND_FROM_EMAIL = "Portfolio <hello@anikeaty08.tech>";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(options.headers.Authorization, "Bearer test-key");
    const sent = JSON.parse(options.body);
    assert.equal(sent.reply_to, valid.email);
    assert.equal(sent.to[0], "aniketbxr1@gmail.com");
    assert.match(sent.text, /Hello, I would like to talk about a project/);
    return Response.json({ id: "test-email" });
  };
  assert.equal((await contact.fetch(request(valid))).status, 200);

  globalThis.fetch = async () => Response.json({ message: "Rejected" }, { status: 422 });
  assert.equal((await contact.fetch(request(valid))).status, 502);
} finally {
  globalThis.fetch = originalFetch;
  if (oldKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = oldKey;
  if (oldFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
  else process.env.RESEND_FROM_EMAIL = oldFrom;
}

console.log("Contact function checks passed.");
