// pages/index.js
import { useEffect, useRef, useState } from 'react';

export default function Home() {
  const [problem, setProblem] = useState('問題を読み込んでいます...');
  const [corrected, setCorrected] = useState('');
  const [score, setScore] = useState('');
  const [advice, setAdvice] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [micStatus, setMicStatus] = useState('（マイクを押して話してください）');

  const userAnswerRef = useRef(null);
  const problemsRef = useRef([]);

  // ===== 音声入力の準備 =====
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isListening = false;

    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        userAnswerRef.current.value += transcript + ' ';
        setMicStatus(`認識: ${transcript}`);
      };

      recognition.onerror = (e) => {
        setMicStatus(`エラー: ${e.error}`);
      };

      recognition.onend = () => {
        isListening = false;
        document.getElementById('micBtn').textContent = '🎤';
        setMicStatus('（マイクを押して話してください）');
      };
    }

    document.getElementById('micBtn')?.addEventListener('click', () => {
      if (!recognition) {
        setMicStatus('⚠️ 音声認識がサポートされていません');
        return;
      }

      if (isListening) {
        recognition.stop();
      } else {
        try {
          recognition.start();
          isListening = true;
          document.getElementById('micBtn').textContent = '🛑';
          setMicStatus('🔊 話してください...');
        } catch (e) {
          setMicStatus('⚠️ ' + e.message);
        }
      }
    });

    // ===== 音声読み上げ =====
    document.querySelectorAll('.speakBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const textId = btn.getAttribute('data-text-id');
        const text = document.getElementById(textId)?.textContent || '';
        if (!text || text.includes('エラー')) return;

        const lang = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text) ? 'ja-JP' : 'en-US';
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);

        btn.disabled = true;
        setTimeout(() => { btn.disabled = false; }, 5000);
      });
    });

    // ===== 問題の読み込み =====
    const loadProblems = async () => {
      try {
        const res = await fetch('/problems.json');
        const data = await res.json();
        problemsRef.current = data.problems;
        showRandomProblem();
      } catch (err) {
        console.error('問題読み込み失敗', err);
        problemsRef.current = [
          "私は毎日公園で犬を散歩させます。",
          "彼は昨夜遅くまで勉強していました。",
          "この本はとても面白くて、一気に読み終えました。"
        ];
        showRandomProblem();
      }
    };

    const showRandomProblem = () => {
      const list = problemsRef.current;
      if (list.length === 0) {
        setProblem('問題がありません');
        return;
      }
      const random = list[Math.floor(Math.random() * list.length)];
      setProblem(random);
      userAnswerRef.current.value = '';
      setCorrected('');
      setScore('');
      setAdvice('');
    };

    // ===== 添削処理 =====
    const checkBtn = document.getElementById('checkBtn');
    const nextBtn = document.getElementById('nextBtn');

    const handleCheck = async () => {
      const answer = userAnswerRef.current?.value.trim();
      if (!answer) {
        alert('答えを入力してください');
        return;
      }

      setIsChecking(true);
      setCorrected('添削中...');
      setScore('');
      setAdvice('');

      try {
        const res = await fetch('/api/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: answer,
            context: `問題: "${problem}" に答える形で書かれた英文です。`
          })
        });

        const text = await res.text();
        const data = JSON.parse(text);

        setCorrected(data.corrected);
        const scoreValue = data.score;
        setScore(
          scoreValue >= 80
            ? `<span class="score-high">${scoreValue} / 100</span>`
            : scoreValue >= 60
            ? `<span class="score-medium">${scoreValue} / 100</span>`
            : `<span class="score-low">${scoreValue} / 100</span>`
        );
        setAdvice(data.advice);
      } catch (err) {
        console.error(err);
        setCorrected('エラーが発生しました');
        setAdvice('通信エラーまたは処理失敗');
      } finally {
        setIsChecking(false);
      }
    };

    checkBtn?.addEventListener('click', handleCheck);
    nextBtn?.addEventListener('click', showRandomProblem);

    loadProblems();

    // cleanup（イベントリスナーの重複防止）
    return () => {
      checkBtn?.removeEventListener('click', handleCheck);
      nextBtn?.removeEventListener('click', showRandomProblem);
    };
  }, []);

  return (
    <div style={styles.body}>
      <h2>英作文・添削ツール</h2>

      <h3>問題</h3>
      <p id="problem" style={styles.problem}>
        {problem}
      </p>

      <h3>あなたの答え</h3>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
        <button id="micBtn" style={styles.micBtn}>
          🎤
        </button>
        <span id="micStatus" style={styles.micStatus}>
          {micStatus}
        </span>
      </div>

      <textarea
        ref={userAnswerRef}
        placeholder="ここに英語で答えてください"
        style={styles.textarea}
      />

      <div style={styles.buttonGroup}>
        <button id="checkBtn" style={styles.checkBtn} disabled={isChecking}>
          {isChecking ? '添削中...' : '添削する'}
        </button>
        <button id="nextBtn" style={styles.nextBtn}>
          次の問題
        </button>
      </div>

      <div style={styles.result}>
        <p>
          <strong>添削後:</strong>{' '}
          <span id="corrected" dangerouslySetInnerHTML={{ __html: corrected }} />
          <button
            className="speakBtn"
            data-text-id="corrected"
            style={styles.speakBtn}
            onClick={() => {}}
          >
            🔊
          </button>
        </p>
        <p>
          <strong>スコア:</strong>{' '}
          <span
            id="score"
            dangerouslySetInnerHTML={{ __html: score }}
          />
        </p>
        <p>
          <strong>アドバイス:</strong>{' '}
          <span id="advice">{advice}</span>
          <button
            className="speakBtn"
            data-text-id="advice"
            style={styles.speakBtn}
            onClick={() => {}}
          >
            🔊
          </button>
        </p>
      </div>
    </div>
  );
}

// スタイル（CSS in JS）
const styles = {
  body: {
    fontFamily: `'Segoe UI', Arial, sans-serif`,
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
    lineHeight: 1.8,
    backgroundColor: '#f8f9fa',
    color: '#333',
    fontSize: '18px',
  },
  problem: {
    fontSize: '20px',
    fontWeight: '600',
    padding: '18px',
    backgroundColor: '#e8f4f8',
    borderLeft: '5px solid #4285f4',
    borderRadius: '6px',
    marginBottom: '24px',
    wordBreak: 'break-word',
  },
  textarea: {
    width: '100%',
    height: '160px',
    padding: '14px',
    fontSize: '18px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    resize: 'vertical',
    marginBottom: '20px',
    fontFamily: 'inherit',
  },
  buttonGroup: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap',
    marginBottom: '24px',
  },
  checkBtn: {
    padding: '14px 24px',
    fontSize: '18px',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    backgroundColor: '#4285f4',
    color: 'white',
    flex: 1,
    minWidth: '150px',
  },
  nextBtn: {
    padding: '14px 24px',
    fontSize: '18px',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    backgroundColor: '#0f9d58',
    color: 'white',
    flex: 1,
    minWidth: '150px',
  },
  micBtn: {
    padding: '8px 12px',
    fontSize: '18px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    backgroundColor: '#f0f0f0',
  },
  micStatus: {
    marginLeft: '8px',
    fontSize: '14px',
    color: '#666',
  },
  speakBtn: {
    marginLeft: '8px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
  },
  result: {
    marginTop: '24px',
    padding: '24px',
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e0e0e0',
    boxShadow: '0 3px 8px rgba(0,0,0,0.08)',
  },
};

// レスポンシブ対応は外部CSSで（public/css/style.css）にメディアクエリを残す