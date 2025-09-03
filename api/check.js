const fetch = require("node-fetch");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    // Gemini API 呼び出し
    const apiResponse = await fetch(
      "https://gemini.googleapis.com/v1/models/text-bison-001:generate",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: text,
          // 必要に応じてパラメータ追加可能
          // temperature: 0.7,
          // maxOutputTokens: 512
        }),
      }
    );

    const textResponse = await apiResponse.text();
    console.log("Gemini API response:", textResponse);

    let apiData;
    try {
      apiData = JSON.parse(textResponse);
    } catch (parseErr) {
      return res
        .status(500)
        .json({ error: "Failed to parse Gemini API response", raw: textResponse });
    }

    const outputText = apiData.candidates?.[0]?.output || "No result";

    res.status(200).json({ text: outputText });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
