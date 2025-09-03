const fetch = require("node-fetch");

module.exports = async function handler(req, res) {
  try {
    // POST メソッドのみ許可
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    // Gemini（PaLM 2 / Text-Bison v1beta2） API 呼び出し
    const apiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: text,
          temperature: 0.7,        // 必要に応じて変更
          maxOutputTokens: 512     // 必要に応じて変更
        }),
      }
    );

    const textResponse = await apiResponse.text();
    console.log("Gemini API response:", textResponse);

    let apiData;
    try {
      apiData = JSON.parse(textResponse);
    } catch (parseErr) {
      return res.status(500).json({
        error: "Failed to parse Gemini API response",
        raw: textResponse,
      });
    }

    const outputText = apiData.candidates?.[0]?.content || "No result";

    res.status(200).json({ text: outputText });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
