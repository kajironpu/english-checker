// pages/api/check.js
import fetch from "node-fetch";

// リトライ付きfetch関数
async function fetchWithRetry(url, options, maxRetries = 3) {
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      
      // HTTPエラー（500系など）はリトライ対象
      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`HTTP ${res.status} on attempt ${i + 1}:`, errorText);
        
        if (res.status >= 500 && i < maxRetries) {
          await delay(1000 * (2 ** i)); // 指数バックオフ
          continue;
        } else {
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
      }

      const data = await res.json();
      return data;
    } catch (error) {
      console.error(`Fetch attempt ${i + 1} failed:`, error.message);
      if (i === maxRetries) throw error;
      await delay(1000 * (2 ** i));
    }
  }
}

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
  "advice": "改善点のアドバイス（日本語で、丁寧に、中学生向けにわかりやすく）。２００文字程度で、問題の意図も踏まえてください。"
}
${context || ""}
ユーザーの回答: "${text}"
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    // URLのスペースを修正（元コードにスペースがありました！）
    // 例: "gemini-2.5-flash  :generateContent" → これは間違い！

    try {
      const data = await fetchWithRetry(url, {
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
      }, 3);

      // candidates の存在チェック
      const candidate = data.candidates?.[0];
      if (!candidate || !candidate.content?.parts?.[0]?.text) {
        console.error("No valid candidate returned from Gemini", data);
        return res.status(500).json({
          error: "Gemini did not return a valid response",
          details: data,
        });
      }

      const resultText = candidate.content.parts[0].text;

      // JSONパースを試みる
      try {
        let result = JSON.parse(resultText.trim());
        
        // 必須フィールドのバリデーション
        if (
          typeof result.corrected === "string" &&
          typeof result.score === "number" &&
          typeof result.advice === "string"
        ) {
          return res.status(200).json(result);
        } else {
          throw new Error("Invalid structure");
        }
      } catch (parseError) {
        console.error("JSON Parse failed:", resultText);

        // 単純な修復試行
        try {
          let fixed = resultText.trim();
          if (!fixed.startsWith("{")) fixed = "{" + fixed;
          if (!fixed.endsWith("}")) fixed += "}";
          let result = JSON.parse(fixed);

          // フィールド補完
          if (typeof result.corrected !== "string") result.corrected = text;
          if (typeof result.score !== "number") result.score = 50;
          if (typeof result.advice !== "string") result.advice = "AIの解説を生成できませんでした。";

          return res.status(200).json(result);
        } catch (fixError) {
          console.error("Failed to fix JSON:", fixError);
          return res.status(500).json({
            error: "Failed to parse and fix AI response",
            raw: resultText,
          });
        }
      }
    } catch (apiError) {
      console.error("Gemini API Error:", apiError.message);
      return res.status(500).json({
        error: "AI service temporarily unavailable",
        details: apiError.message,
      });
    }
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}