// 例: 既存api/check.jsの修正版
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    const apiResponse = await fetch("https://gemini.googleapis.com/v1/models/text-bison-001:generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt: text })
    });

    const apiData = await apiResponse.json();

    res.status(200).json({ text: apiData.candidates[0]?.output || "No result" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
