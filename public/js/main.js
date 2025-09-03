const problemEl = document.getElementById("problem");
const userAnswer = document.getElementById("userAnswer");
const checkBtn = document.getElementById("checkBtn");
const nextBtn = document.getElementById("nextBtn");
const corrected = document.getElementById("corrected");
const score = document.getElementById("score");
const advice = document.getElementById("advice");
const voiceInputBtn = document.getElementById("voiceInputBtn");

let currentProblem = "";
let problems = [];

// === 問題読み込み ===
async function loadProblems() {
  try {
    const response = await fetch('/problems.json');
    if (!response.ok) throw new Error('問題ファイルの読み込みに失敗しました');
    const data = await response.json();
    problems = data.problems;
    showRandomProblem();
  } catch (error) {
    console.error('問題読み込みエラー:', error);
    problems = [
      "私は毎日公園で犬を散歩させます。",
      "彼は昨夜遅くまで勉強していました。",
      "この本はとても面白くて、一気に読み終えました。"
    ];
    showRandomProblem();
  }
}

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

loadProblems();

// === 音声入力 ===
voiceInputBtn.addEventListener("click", () => {
  userAnswer.value = "";

  if (!('webkitSpeechRecognition' in window)) {
    alert("このブラウザは音声入力に対応していません");
    return;
  }

  const recognition = new webkitSpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.start();

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    userAnswer.value = transcript;
  };

  recognition.onerror = (event) => {
    console.error("音声認識エラー:", event.error);
    alert("音声入力に失敗しました: " + event.error);
  };
});

// === 添削 ===
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
        context: `問題: "${currentProblem}" に答える形で書かれた英文です。`
      })
    });

    const responseText = await res.text();
    if (!res.ok) throw new Error(`APIエラー: ${res.status}`);

    const data = JSON.parse(responseText);

    if (!data.corrected || typeof data.score !== 'number' || !data.advice) {
      throw new Error('不正なレスポンス形式');
    }

    corrected.textContent = data.corrected;

    const scoreValue = data.score;
    let scoreClass = "score-medium";
    if (scoreValue >= 80) scoreClass = "score-high";
    else if (scoreValue < 60) scoreClass = "score-low";

    score.innerHTML = `<span class="${scoreClass}">${scoreValue} / 100</span>`;
    advice.textContent = data.advice;

    // 添削後を自動読み上げ
    const utterance = new SpeechSynthesisUtterance(data.corrected);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);

  } catch (error) {
    console.error("Error:", error);
    corrected.innerHTML = '<span class="error">エラーが発生しました</span>';
    advice.innerHTML = `<span class="error">通信エラーまたは処理失敗</span>`;
  } finally {
    checkBtn.disabled = false;
  }
});

nextBtn.addEventListener("click", showRandomProblem);
