// pages/api/check.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { text, context } = req.body || {};

    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not set" });
    }

    const prompt = `
以下の英文を評価し、JSON形式で返してください。
{
  "corrected": "自然で文法的に正しい英文",
  "score": "100点満点のスコア（整数）",
  "advice": "改善点のアドバイス（日本語で、丁寧に）。問題の意図も踏まえてください。"
}

${context || ""}

ユーザーの回答: "${text}"
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1536,
          responseMimeType: "application/json",
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
      // 普通にJSONパース
      let result = JSON.parse(resultText);

      if (result.corrected && typeof result.score === "number" && result.advice) {
        return res.status(200).json(result);
      } else {
        throw new Error("Invalid format");
      }
    } catch {
      console.error("JSON Parse failed, attempting to fix...", resultText);

      try {
        let fixedText = resultText.trim();
        if (!fixedText.endsWith("}")) fixedText += "}";

        let result = JSON.parse(fixedText);

        if (!result.corrected) result.corrected = text;
        if (!result.score || typeof result.score !== "number") result.score = 50;
        if (!result.advice) result.advice = "AIの解説を生成できませんでした。";

        return res.status(200).json(result);
      } catch (fixError) {
        console.error("Failed to fix JSON:", fixError);
        return res.status(500).json({
          error: "Failed to parse and fix Gemini response",
          raw: resultText,
        });
      }
    }
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
