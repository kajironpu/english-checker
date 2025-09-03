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

        // ✅ 正しいプロンプト（JSON出力を指示）
        const prompt = `
以下の英文を評価し、以下のJSON形式で返してください。
{
  "corrected": "自然で文法的に正しい英文",
  "score": "100点満点のスコア（整数）",
  "advice": "改善点のアドバイス（日本語で、丁寧に）"
}

原文: "${text}"
`;

        // ✅ 正しいエンドポイント
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

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
              responseMimeType: "application/json" // ✅ JSON出力を強制
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return res.status(500).json({
            error: "Gemini API request failed",
            details: errorText,
          });
        }

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        try {
          const result = JSON.parse(resultText);
          if (result.corrected && typeof result.score === 'number' && result.advice) {
            return res.status(200).json(result);
          } else {
            throw new Error("Invalid format");
          }
        } catch (e) {
          console.error("Failed to parse as JSON:", resultText);
          return res.status(500).json({
            error: "Invalid JSON response from Gemini",
            raw: resultText,
          });
        }
      } catch (e) {
        res.status(400).json({ error: "Invalid request body" });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};