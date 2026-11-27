const allowedOrigin = "https://featuredpr0ject.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractText(result: any): string {
  const outputs = Array.isArray(result.steps) ? result.steps : [];
  return outputs
    .filter((step: any) => step.type === "model_output")
    .flatMap((step: any) => Array.isArray(step.content) ? step.content : [])
    .filter((part: any) => part.type === "text" && typeof part.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim();
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && origin !== allowedOrigin) {
    return json({ error: "Origin not allowed" }, 403);
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
  const expectedKey = publishableKeys.default;
  const suppliedKey = req.headers.get("apikey");
  if (!expectedKey || suppliedKey !== expectedKey) {
    return json({ error: "Invalid API key" }, 401);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";
  if (!apiKey) {
    return json({ error: "Gemini API key is not configured" }, 500);
  }

  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > 12000) {
    return json({ error: "Request is too large" }, 413);
  }

  try {
    const body = await req.json();
    const fen = typeof body.fen === "string" ? body.fen : "";
    const legalMoves = Array.isArray(body.legalMoves)
      ? body.legalMoves.filter((move: unknown) => typeof move === "string").slice(0, 250)
      : [];
    const history = Array.isArray(body.history)
      ? body.history.filter((move: unknown) => typeof move === "string").slice(-40)
      : [];

    if (!fen || fen.length > 200 || legalMoves.length === 0) {
      return json({ error: "Invalid chess position or legal moves" }, 400);
    }

    const prompt = [
      "You are the black-side chess player in a chess game.",
      "Choose the strongest move you can from the supplied legal SAN moves.",
      "The legalMoves list is authoritative. You must choose one exact string from it.",
      "Return only a JSON object in this exact shape: {\"move\":\"SAN\"}.",
      "Do not include Markdown, explanations, or any move not in legalMoves.",
      JSON.stringify({ fen, history, legalMoves }),
    ].join("\n");

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        input: prompt,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      return json({ error: "Gemini request failed", providerStatus: response.status }, 502);
    }

    const result = await response.json();
    const content = extractText(result);
    const cleaned = content.replace(/```(?:json)?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const move = typeof parsed.move === "string" ? parsed.move.trim() : "";

    if (!legalMoves.includes(move)) {
      return json({ error: "Gemini returned an illegal or unknown move" }, 422);
    }

    return json({ move, model });
  } catch {
    return json({ error: "Invalid request or Gemini response" }, 400);
  }
});
