// pages/index.js
export default function Home() {
  return (
    <div dangerouslySetInnerHTML={{ __html: generateHTML() }} />
  );
}

function generateHTML() {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>英作文・添削ツール</title>
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body>
  <h2>英作文・添削ツール</h2>

  <h3>問題</h3>
  <p id="problem">問題を読み込んでいます...</p>

  <h3>あなたの答え</h3>

  <!-- 音声入力ボタン -->
  <div style="display: flex; align-items: center; margin-bottom: 10px;">
    <button id="micBtn" title="音声入力（英語を話してください）">🎤</button>
    <span id="micStatus" style="margin-left: 8px; font-size: 14px; color: #666;">（マイクを押して話してください）</span>
  </div>

  <textarea id="userAnswer" placeholder="ここに英語で答えてください"></textarea>

  <div class="button-group">
    <button id="checkBtn">添削する</button>
    <button id="nextBtn">次の問題</button>
  </div>

  <div class="result">
    <p>
      <strong>添削後:</strong> 
      <span id="corrected"></span>
      <button class="speakBtn" data-text-id="corrected" title="英語を再生" style="margin-left: 8px;">🔊</button>
    </p>
    <p><strong>スコア:</strong> <span id="score"></span></p>
    <p>
      <strong>アドバイス:</strong> 
      <span id="advice"></span>
      <button class="speakBtn" data-text-id="advice" title="日本語を再生" style="margin-left: 8px;">🔊</button>
    </p>
  </div>

  <script>
    // ===== DOM Elements =====
    const problemEl = document.getElementById("problem");
    const userAnswer = document.getElementById("userAnswer");
    const checkBtn = document.getElementById("checkBtn");
    const nextBtn = document.getElementById("nextBtn");
    const corrected = document.getElementById("corrected");
    const score = document.getElementById("score");
    const advice = document.getElementById("advice");
    const micBtn = document.getElementById("micBtn");
    const micStatus = document.getElementById("micStatus");
    const speakButtons = document.querySelectorAll(".speakBtn");

    let currentProblem = "";
    let problems = [];

    // ===== 問題の読み込み =====
    async function loadProblems() {
      try {
        const response = await fetch('/problems.json');
        if (!response.ok) throw new Error('問題ファイルの読み込みに失敗しました');
        const data = await response.json();
        problems = data.problems;
        console.log(\`\${problems.length}個の問題を読み込みました\`);
        showRandomProblem();
      } catch (error) {
        console.error('問題読み込みエラー:', error);
        problemEl.innerHTML = '<span class="error">問題の読み込みに失敗しました。</span>';
        problems = [
          "私は毎日公園で犬を散歩させます。",
          "彼は昨夜遅くまで勉強していました。",
          "この本はとても面白くて、一気に読み終えました。"
        ];
        showRandomProblem();
      }
    }

    // ===== ランダム問題表示 =====
    function showRandomProblem() {
      if (problems.length === 0) {
        problemEl.textContent = "問題がありません";
        return;
      }
      currentProblem = problems[Math.floor(Math.random() * problems.length)];
      problemEl.textContent = currentProblem;
      userAnswer.value = "";
      corrected.textContent = "";
      score.textContent = "";
      advice.textContent = "";
    }

    // ===== 添削処理 =====
    checkBtn.addEventListener("click", async () => {
      const answer = userAnswer.value.trim();
      if (!answer) {
        alert("あなたの答えを入力してください");
        return;
      }

      checkBtn.disabled = true;
      corrected.innerHTML = '<span class="loading">添削中...</span>';
      score.textContent = "";
      advice.textContent = "";

      try {
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: answer,
            context: \`問題: "\${currentProblem}" に答える形で書かれた英文です。\`
          })
        });

        const responseText = await res.text();
        if (!res.ok) throw new Error(\`APIエラー: \${res.status}\`);

        const data = JSON.parse(responseText);

        if (!data.corrected || typeof data.score !== 'number' || !data.advice) {
          throw new Error('不正なレスポンス形式');
        }

        corrected.textContent = data.corrected;

        const scoreValue = data.score;
        let scoreClass = "score-medium";
        if (scoreValue >= 80) scoreClass = "score-high";
        else if (scoreValue < 60) scoreClass = "score-low";

        score.innerHTML = \`<span class="\${scoreClass}">\${scoreValue} / 100</span>\`;
        advice.textContent = data.advice;

      } catch (error) {
        console.error("Error:", error);
        corrected.innerHTML = '<span class="error">エラーが発生しました</span>';
        advice.innerHTML = '<span class="error">通信エラーまたは処理失敗</span>';
      } finally {
        checkBtn.disabled = false;
      }
    });

    // ===== 次の問題 =====
    nextBtn.addEventListener("click", showRandomProblem);

    // ===== 音声入力（マイク）機能 =====
    let isListening = false;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userAnswer.value = (userAnswer.value + transcript + " ").trim();
        micStatus.textContent = \`認識: \${transcript}\`;
      };

      recognition.onerror = (event) => {
        micStatus.textContent = \`エラー: \${event.error}\`;
      };

      recognition.onend = () => {
        isListening = false;
        micBtn.textContent = "🎤";
        micStatus.textContent = "（マイクを押して話してください）";
      };

      micBtn.addEventListener("click", () => {
        if (isListening) {
          recognition.stop();
        } else {
          try {
            recognition.start();
            isListening = true;
            micBtn.textContent = "🛑";
            micStatus.textContent = "🔊 話してください...";
          } catch (e) {
            micStatus.textContent = "⚠️ エラー: " + e.message;
          }
        }
      });
    } else {
      micBtn.disabled = true;
      micBtn.title = "このブラウザは音声認識をサポートしていません";
      micStatus.textContent = "※ 音声入力は利用できません（Chrome推奨）";
    }

    // ===== 音声読み上げ（Text to Speech）=====
    speakButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const textId = btn.getAttribute("data-text-id");
        const textElement = document.getElementById(textId);
        let text = textElement.textContent || "";

        if (!text || text === "..." || text.includes("エラー")) return;

        const lang = /[\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/.test(text)
          ? 'ja-JP'
          : 'en-US';

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;
        utterance.pitch = 1;

        window.speechSynthesis.speak(utterance);

        btn.disabled = true;
        setTimeout(() => { btn.disabled = false; }, 5000);
      });
    });

    // ===== 初期化 =====
    loadProblems();
  </script>
</body>
</html>`;
}