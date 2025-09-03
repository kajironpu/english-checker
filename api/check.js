// api/check.js
const fetch = require("node-fetch");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { text } = JSON.parse(body || "{}");
        if (!text) {
          return res.status(400).json({ error: "No text provided" });
        }

        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
          return res.status(500).json({ error: "GEMINI_API_KEY is not set" });
        }

        // ✅ Geminiに「JSON形式で」3つの項目を生成させるプロンプト
        const prompt = `
以下の英文を評価し、以下のJSON形式で返してください。
{
  "corrected": "自然で文法的に正しい英文",
  "score": "100点満点のスコア（整数）",
  "advice": "改善点のアドバイス（日本語で、丁寧に）"
}

原文: "${text}"
`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 512,
              // ✅ JSON出力モードを有効化（Gemini 2.5以降でサポート）
              responseMimeType: "application/json",
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Gemini API Error:", errorText);
          return res.status(500).json({
            error: "Gemini API request failed",
            details: errorText,
          });
        }

        const data = await response.json();
        
        // ✅ GeminiがJSONを返すように指示しているので、そのまま使える
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text;

        try {
          const parsedResult = JSON.parse(result);
          // 必要なキーがあるか確認
          if (parsedResult.corrected && parsedResult.score && parsedResult.advice) {
            return res.status(200).json(parsedResult);
          } else {
            throw new Error("Invalid response format");
          }
        } catch (parseError) {
          console.error("JSON Parse Error:", result);
          return res.status(500).json({
            error: "Failed to parse Gemini response",
            raw: result,
          });
        }
      } catch (parseError) {
        res.status(400).json({ error: "Invalid JSON in request" });
      }
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};