const express = require('express');
const cors = require('cors');
const { createCanvas } = require('canvas');

const app = express();
const PORT = process.env.PORT || 3000;

// CORSを有効化
app.use(cors());
// JSONボディをパース（重要！）
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ヘルスチェックエンドポイント
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Roblox 3D Text API',
    endpoints: {
      get: '/generate?char=あ&resolution=128&threshold=120',
      post: '/generate (POST with JSON body)'
    }
  });
});

// GETエンドポイント（互換性のため残す）
app.get('/generate', (req, res) => {
  try {
    const char = req.query.char || 'あ';
    const resolution = Math.min(Math.max(parseInt(req.query.resolution) || 128, 32), 512);
    const threshold = Math.min(Math.max(parseInt(req.query.threshold) || 120, 0), 255);
    
    const singleChar = char.charAt(0) || 'あ';
    
    console.log(`GET: Generating text for: "${singleChar}"`);
    
    const result = generateTextBars(singleChar, resolution, threshold);
    res.json(result);
    
  } catch (error) {
    console.error('GET Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POSTエンドポイント（メイン）
app.post('/generate', (req, res) => {
  try {
    console.log('POST Request body:', req.body);
    
    const { char, resolution, threshold } = req.body;
    
    const singleChar = (char || 'あ').charAt(0);
    const res_value = Math.min(Math.max(parseInt(resolution) || 128, 32), 512);
    const thresh_value = Math.min(Math.max(parseInt(threshold) || 120, 0), 255);
    
    console.log(`POST: Generating text for: "${singleChar}" (code: ${singleChar.charCodeAt(0)})`);
    console.log(`Resolution: ${res_value}, Threshold: ${thresh_value}`);
    
    const result = generateTextBars(singleChar, res_value, thresh_value);
    res.json(result);
    
  } catch (error) {
    console.error('POST Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 共通の文字生成関数
function generateTextBars(singleChar, resolution, threshold) {
  const canvasSize = 256;
  const canvas = createCanvas(canvasSize, canvasSize);
  const ctx = canvas.getContext('2d');
  
  // 背景を白で塗りつぶす
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  
  // 文字を描画
  const fontSize = resolution * 0.9;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(singleChar, canvasSize / 2, canvasSize / 2);
  
  // 画像データを取得
  const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
  const data = imageData.data;
  
  // 棒のデータを収集
  const bars = [];
  let pixelOnCount = 0;
  
  for (let y = 0; y < canvasSize; y++) {
    let runStart = -1;
    
    for (let x = 0; x < canvasSize; x++) {
      const index = (y * canvasSize + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      
      // 明るさを計算
      const brightness = (r + g + b) / 3;
      
      // 背景が白なので、暗いピクセルを検出
      const isOn = brightness < threshold;
      
      if (isOn) {
        pixelOnCount++;
      }
      
      if (isOn && runStart === -1) {
        // 連続区間の開始
        runStart = x;
      } else if (!isOn && runStart !== -1) {
        // 連続区間の終了
        const runEnd = x - 1;
        bars.push({
          x: runStart,
          y: y,
          width: runEnd - runStart + 1,
          height: 1
        });
        runStart = -1;
      }
    }
    
    // 行の最後まで連続していた場合
    if (runStart !== -1) {
      const runEnd = canvasSize - 1;
      bars.push({
        x: runStart,
        y: y,
        width: runEnd - runStart + 1,
        height: 1
      });
    }
  }
  
  // 結果を返す
  const result = {
    success: true,
    char: singleChar,
    charCode: singleChar.charCodeAt(0),
    resolution: resolution,
    threshold: threshold,
    canvasWidth: canvasSize,
    canvasHeight: canvasSize,
    bars: bars,
    barCount: bars.length,
    pixelOnCount: pixelOnCount,
    timestamp: new Date().toISOString()
  };
  
  console.log(`Generated ${bars.length} bars for "${singleChar}" (${pixelOnCount} pixels detected)`);
  
  return result;
}

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  console.log(`GET: http://localhost:${PORT}/generate?char=あ&resolution=128&threshold=120`);
  console.log(`POST: http://localhost:${PORT}/generate (with JSON body)`);
});