import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

async function checkEnglish(text) {
  const prompt = `
You are an English teacher.
Please correct the following sentence, give a score from 0-100 for grammar and clarity, and provide advice.

Sentence: "${text}"
Return as JSON with keys: corrected, score, advice
`;

  const response = await fetch("https://api.generativeai.googleapis.com/v1beta2/models/text-bison-001:generateText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`
    },
    body: JSON.stringify({
      prompt: prompt,
      temperature: 0.2,
      maxOutputTokens: 500
    })
  });

  const data = await response.json();

  try {
    return JSON.parse(data.output_text || data.output[0].content[0].text);
  } catch {
    return { corrected: "Error parsing response", score: 0, advice: "Try again" };
  }
}

app.post("/check", async (req, res) => {
  const { text } = req.body;
  const result = await checkEnglish(text);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
