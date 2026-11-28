import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://featuredpr0ject.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const marks = new Set(["!!", "!", "!?", "?", "??", "?!"]);
const recentRequests = new Map<string, number>();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const origin = req.headers.get("origin");
  if (origin && origin !== "https://featuredpr0ject.github.io") {
    return jsonResponse({ error: "Origin not allowed" }, 403);
  }

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return jsonResponse({ error: "Supabase Secret GEMINI_API_KEY chưa được cấu hình" }, 503);

  let body: { pgn?: unknown; moves?: unknown; result?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const pgn = typeof body.pgn === "string" ? body.pgn.slice(0, 24000) : "";
  const moves = Array.isArray(body.moves) ? body.moves.slice(0, 120) : [];
  if (!pgn && moves.length === 0) return jsonResponse({ error: "Không có dữ liệu ván cờ" }, 400);

  const userId = authorization.slice(7, 80);
  const now = Date.now();
  const lastRequest = recentRequests.get(userId) || 0;
  if (now - lastRequest < 15000) return jsonResponse({ error: "Vui lòng đợi 15 giây trước khi phân tích ván tiếp theo" }, 429);
  recentRequests.set(userId, now);
  if (recentRequests.size > 500) {
    for (const [key, value] of recentRequests) if (now - value > 60000) recentRequests.delete(key);
  }

  const gameText = pgn || JSON.stringify(moves);
  const prompt = [
    "Bạn là huấn luyện viên cờ vua. Người dùng đang chơi quân Trắng và đã thua ván này.",
    "Phân tích toàn bộ ván cờ, chỉ chấm các nước đi của Trắng. Xác định các sai lầm chiến thuật, quân bị bỏ, chiếu hết bị bỏ lỡ và cơ hội phòng thủ.",
    "Dùng ký hiệu cờ vua: !! xuất sắc, ! tốt, !? thú vị/rủi ro, ? sai, ?? sai lầm nghiêm trọng, ?! đáng nghi.",
    "Chỉ trả về những nước thật sự đáng chú ý; không cần gắn nhãn mọi nước. Không bịa nước thay thế hoặc biến thể. Nếu không chắc best_alternative thì để chuỗi rỗng.",
    "ply là số thứ tự nửa nước bắt đầu từ 1 (nước Trắng đầu tiên là 1, Đen đầu tiên là 2).",
    "Giải thích tiếng Việt ngắn gọn, nói rõ vì sao nước đó sai và hậu quả. Tối đa 12 nhận xét.",
    "Trả về đúng JSON theo schema. Dữ liệu ván cờ:",
    gameText
  ].join("\n\n");

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              reviews: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    ply: { type: "INTEGER" },
                    mark: { type: "STRING", enum: ["!!", "!", "!?", "?", "??", "?!"] },
                    reason: { type: "STRING" },
                    best_alternative: { type: "STRING" }
                  },
                  required: ["ply", "mark", "reason", "best_alternative"]
                }
              }
            },
            required: ["reviews"]
          },
          maxOutputTokens: 2400
        }
      })
    });

    const result = await response.json();
    if (!response.ok) {
      const message = result?.error?.message || "Gemini API request failed";
      return jsonResponse({ error: message }, response.status >= 500 ? 502 : response.status);
    }

    const text = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "{}";
    const parsed = JSON.parse(text);
    const reviews = Array.isArray(parsed.reviews) ? parsed.reviews
      .filter((item: { ply?: number; mark?: string; reason?: string }) =>
        Number.isInteger(item.ply) && item.ply > 0 && marks.has(item.mark) && typeof item.reason === "string")
      .slice(0, 12)
      .map((item: { ply: number; mark: string; reason: string; best_alternative?: string }) => ({
        ply: item.ply,
        mark: item.mark,
        reason: item.reason.slice(0, 500),
        best_alternative: typeof item.best_alternative === "string" ? item.best_alternative.slice(0, 80) : ""
      })) : [];

    return jsonResponse({ reviews });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Review failed" }, 500);
  }
});
