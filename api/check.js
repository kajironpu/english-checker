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

    // プロンプトを改善：より明確で短い指示
    const prompt = `
英文を評価し、以下のJSON形式のみで返答してください：
{
  "corrected": "自然で文法的に正しい英文",
  "score": "100点満点のスコア（整数）",
  "advice": "改善点のアドバイス（日本語で、丁寧に、中学生向けにわかりやすく端的に）。問題の意図も踏まえてください。"
}

${context ? `問題文脈: ${context}` : ""}
評価対象: "${text}"

注意：JSON形式以外は一切出力しないでください。`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "User-Agent": "English-Learning-App/1.0"
      },
      body: JSON.stringify({
        contents: [{ 
          role: "user", 
          parts: [{ text: prompt }] 
        }],
        generationConfig: {
          temperature: 0.3, // より一貫した出力のために低く設定
          maxOutputTokens: 800, // トークン数を減らして確実に完了させる
          topK: 40,
          topP: 0.95,
          responseMimeType: "application/json",
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }),
      timeout: 30000 // 30秒のタイムアウト
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", response.status, errorText);
      return res.status(500).json({
        error: "Gemini API request failed",
        status: response.status,
        details: errorText.substring(0, 200) // エラー詳細を制限
      });
    }

    const data = await response.json();
    console.log("Gemini API Response:", JSON.stringify(data, null, 2));

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      console.error("No response text from Gemini API");
      return res.status(500).json({
        error: "Empty response from Gemini API",
        raw: data
      });
    }

    // JSONの解析とクリーンアップ
    try {
      // コードブロックやマークダウンを除去
      let cleanText = resultText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/^\s*json\s*/gim, '')
        .trim();

      // JSONの前後の不要なテキストを除去
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanText = jsonMatch[0];
      }

      console.log("Attempting to parse JSON:", cleanText);
      
      const result = JSON.parse(cleanText);
      
      // 必要なフィールドの検証と補完
      const validatedResult = {
        corrected: result.corrected || text,
        score: typeof result.score === 'number' ? Math.max(0, Math.min(100, result.score)) : 50,
        advice: typeof result.advice === 'string' ? result.advice.substring(0, 500) : "アドバイスを生成できませんでした。"
      };

      return res.status(200).json(validatedResult);

    } catch (parseError) {
      console.error("JSON Parse failed:", parseError.message);
      console.error("Raw response:", resultText);
      
      // フォールバック：正規表現でJSONを修復試行
      try {
        const fixedResult = await attemptJsonFix(resultText, text);
        return res.status(200).json(fixedResult);
      } catch (fixError) {
        console.error("JSON fix failed:", fixError.message);
        
        return res.status(500).json({
          error: "Failed to parse Gemini response",
          raw: resultText?.substring(0, 500) || "No response text",
          parseError: parseError.message
        });
      }
    }

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ 
      error: "Internal Server Error",
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

// JSON修復を試行する補助関数
async function attemptJsonFix(rawText, originalText) {
  try {
    let fixedText = rawText.trim();
    
    // 一般的な修復パターン
    if (!fixedText.startsWith('{')) {
      const braceIndex = fixedText.indexOf('{');
      if (braceIndex !== -1) {
        fixedText = fixedText.substring(braceIndex);
      }
    }
    
    if (!fixedText.endsWith('}')) {
      // 最後の完全なフィールドまでを取得
      const lastCommaIndex = fixedText.lastIndexOf(',');
      const lastQuoteIndex = fixedText.lastIndexOf('"');
      
      if (lastQuoteIndex > lastCommaIndex) {
        fixedText = fixedText.substring(0, lastQuoteIndex + 1) + '}';
      } else {
        fixedText += '"}';
      }
    }
    
    // 不完全な文字列を修復
    fixedText = fixedText.replace(/,\s*}/g, '}'); // 最後のカンマを削除
    fixedText = fixedText.replace(/([^"]),\s*([^"])/g, '$1,"$2'); // 不完全な文字列を修復
    
    const result = JSON.parse(fixedText);
    
    return {
      corrected: result.corrected || originalText,
      score: typeof result.score === 'number' ? result.score : 50,
      advice: result.advice || "部分的な解析のため、完全なアドバイスを提供できませんでした。"
    };
    
  } catch (error) {
    // 最終フォールバック
    return {
      corrected: originalText,
      score: 50,
      advice: "APIの応答を解析できませんでした。もう一度お試しください。"
    };
  }
}