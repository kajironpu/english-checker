// api/check.js
const fetch = require("node-fetch");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // リクエストボディを手動でパース（VercelではExpressのbody-parserが使えない）
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

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

        // ✅ 正しいエンドポイント（2025年4月現在）
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `Please correct the grammar and improve the English: "${text}"` }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 512,
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
        const output =
          data.candidates?.[0]?.content?.parts?.[0]?.text ||
          "Sorry, no correction available.";

        res.status(200).json({ text: output });
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        res.status(400).json({ error: "Invalid JSON in request" });
      }
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};