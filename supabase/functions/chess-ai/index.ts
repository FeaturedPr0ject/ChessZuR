const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiUrl = Deno.env.get("AI_API_URL");
  const apiKey = Deno.env.get("AI_API_KEY");
  const model = Deno.env.get("AI_MODEL");

  if (!apiUrl || !apiKey || !model) {
    return json({ error: "AI provider secrets are not configured" }, 500);
  }

  try {
    const body = await req.json();
    const fen = typeof body.fen === "string" ? body.fen : "";
    const legalMoves = Array.isArray(body.legalMoves)
      ? body.legalMoves.filter((move: unknown) => typeof move === "string")
      : [];
    const history = Array.isArray(body.history)
      ? body.history.filter((move: unknown) => typeof move === "string").slice(-40)
      : [];

    if (!fen || fen.length > 200 || legalMoves.length === 0 || legalMoves.length > 250) {
      return json({ error: "Invalid chess position or legal moves" }, 400);
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You are a chess engine assistant. Choose exactly one move from the supplied legal move list. Return only JSON: {\"move\":\"SAN_MOVE\"}. Never return a move outside the list.",
          },
          {
            role: "user",
            content: JSON.stringify({ fen, history, legalMoves }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return json({ error: "AI provider request failed", providerStatus: response.status }, 502);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return json({ error: "AI provider returned an unsupported response" }, 502);
    }

    const cleaned = content.replace(/```(?:json)?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const move = typeof parsed.move === "string" ? parsed.move.trim() : "";

    if (!legalMoves.includes(move)) {
      return json({ error: "AI returned an illegal or unknown move" }, 422);
    }

    return json({ move });
  } catch {
    return json({ error: "Invalid request or AI response" }, 400);
  }
});
