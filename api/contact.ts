const MAX_BODY_LENGTH = 12_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(message: string, status: number) {
  return Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return json("Please send the form as JSON.", 415);
    }

    let body: unknown;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_LENGTH) return json("Your message is too long.", 413);
      body = JSON.parse(raw);
    } catch {
      return json("Please check the form and try again.", 400);
    }

    if (!body || typeof body !== "object") {
      return json("Please check the form and try again.", 400);
    }

    const fields = body as Record<string, unknown>;
    if (typeof fields.website === "string" && fields.website.trim()) {
      return json("Message sent.", 200);
    }

    const name = typeof fields.name === "string" ? fields.name.trim().replace(/[\r\n\t]+/g, " ") : "";
    const email = typeof fields.email === "string" ? fields.email.trim() : "";
    const message = typeof fields.message === "string" ? fields.message.trim() : "";

    if (name.length < 2 || name.length > 80 || email.length > 254 || !EMAIL_PATTERN.test(email) || message.length < 10 || message.length > 5000) {
      return json("Please check your name, email, and message.", 400);
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    const to = process.env.CONTACT_TO_EMAIL || "aniketbxr1@gmail.com";

    if (!apiKey || !from) {
      console.error("Contact form is missing Resend configuration.");
      return json("The form is unavailable right now. Please email me directly.", 503);
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "anikeaty08-portfolio/1.0",
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: email,
          subject: `Portfolio message from ${name}`,
          text: `${message}\n\nFrom: ${name} <${email}>`,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        console.error("Resend rejected a contact message:", response.status);
        return json("The message could not be sent. Please try again or email me directly.", 502);
      }

      return json("Message sent.", 200);
    } catch (error) {
      console.error("Contact email request failed:", error);
      return json("The message could not be sent. Please try again or email me directly.", 502);
    }
  },
};
