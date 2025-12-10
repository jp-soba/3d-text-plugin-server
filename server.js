const express = require('express');
const cors = require('cors');
const { createCanvas, registerFont } = require('canvas');

const app = express();
const PORT = process.env.PORT || 3000;

// CORSを有効化
app.use(cors());
app.use(express.json());

// ヘルスチェックエンドポイント
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Roblox 3D Text API',
    endpoints: {
      generate: '/generate?char=あ&resolution=128&threshold=120',
      debug: '/debug?char=あ'
    }
  });
});

// デバッグ用エンドポイント（画像を返す）
app.get('/debug', (req, res) => {
  try {
    const char = (req.query.char || 'あ').charAt(0);
    const resolution = Math.min(Math.max(parseInt(req.query.resolution) || 128, 32), 512);
    
    const canvasSize = 256;
    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');
    
    // 背景を白で塗りつぶす
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    
    // 文字を描画
    const fontSize = resolution * 0.9;
    ctx.font = `${fontSize}px "Noto Sans CJK JP", "Noto Sans JP", sans-serif`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, canvasSize / 2, canvasSize / 2);
    
    // PNGとして返す
    res.setHeader('Content-Type', 'image/png');
    canvas.createPNGStream().pipe(res);
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// メインのテキスト生成エンドポイント
app.get('/generate', (req, res) => {
  try {
    // パラメータの取得とバリデーション
    const char = req.query.char || 'あ';
    const resolution = Math.min(Math.max(parseInt(req.query.resolution) || 128, 32), 512);
    const threshold = Math.min(Math.max(parseInt(req.query.threshold) || 120, 0), 255);
    
    // 1文字のみに制限
    const singleChar = char.charAt(0) || 'あ';
    
    console.log(`Generating text for: "${singleChar}", resolution: ${resolution}, threshold: ${threshold}`);
    
    // Canvasの作成
    const canvasSize = 256;
    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');
    
    // 背景を白で塗りつぶす（明るさ判定のため）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    
    // 文字を描画
    const fontSize = resolution * 0.9;
    // フォント指定を明確に
    ctx.font = `${fontSize}px "Noto Sans CJK JP", "Noto Sans JP", "DejaVu Sans", sans-serif`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(singleChar, canvasSize / 2, canvasSize / 2);
    
    // 画像データを取得
    const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
    const data = imageData.data;
    
    // 棒のデータを収集
    const bars = [];
    let pixelOnCount = 0; // デバッグ用
    
    for (let y = 0; y < canvasSize; y++) {
      let runStart = -1;
      
      for (let x = 0; x < canvasSize; x++) {
        const index = (y * canvasSize + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        
        // 明るさを計算（白=255, 黒=0）
        const brightness = (r + g + b) / 3;
        
        // 背景が白なので、暗いピクセル（黒文字）を検出
        // brightness が threshold より小さければ「文字部分」
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
    
    // 結果をJSON形式で返す
    const result = {
      success: true,
      char: singleChar,
      resolution: resolution,
      threshold: threshold,
      canvasWidth: canvasSize,
      canvasHeight: canvasSize,
      bars: bars,
      barCount: bars.length,
      pixelOnCount: pixelOnCount, // デバッグ情報
      timestamp: new Date().toISOString()
    };
    
    console.log(`Generated ${bars.length} bars for "${singleChar}" (${pixelOnCount} pixels detected)`);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error generating text:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POSTエンドポイント
app.post('/generate', (req, res) => {
  try {
    const { char, resolution, threshold } = req.body;
    
    const singleChar = (char || 'あ').charAt(0);
    const res_value = Math.min(Math.max(parseInt(resolution) || 128, 32), 512);
    const thresh_value = Math.min(Math.max(parseInt(threshold) || 120, 0), 255);
    
    console.log(`POST: Generating text for: "${singleChar}", resolution: ${res_value}, threshold: ${thresh_value}`);
    
    const canvasSize = 256;
    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    
    const fontSize = res_value * 0.9;
    ctx.font = `${fontSize}px "Noto Sans CJK JP", "Noto Sans JP", "DejaVu Sans", sans-serif`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(singleChar, canvasSize / 2, canvasSize / 2);
    
    const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
    const data = imageData.data;
    
    const bars = [];
    let pixelOnCount = 0;
    
    for (let y = 0; y < canvasSize; y++) {
      let runStart = -1;
      
      for (let x = 0; x < canvasSize; x++) {
        const index = (y * canvasSize + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        const brightness = (r + g + b) / 3;
        const isOn = brightness < thresh_value;
        
        if (isOn) {
          pixelOnCount++;
        }
        
        if (isOn && runStart === -1) {
          runStart = x;
        } else if (!isOn && runStart !== -1) {
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
    
    const result = {
      success: true,
      char: singleChar,
      resolution: res_value,
      threshold: thresh_value,
      canvasWidth: canvasSize,
      canvasHeight: canvasSize,
      bars: bars,
      barCount: bars.length,
      pixelOnCount: pixelOnCount,
      timestamp: new Date().toISOString()
    };
    
    console.log(`POST: Generated ${bars.length} bars for "${singleChar}" (${pixelOnCount} pixels detected)`);
    
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
  console.log(`Try: http://localhost:${PORT}/generate?char=あ&resolution=128&threshold=120`);
  console.log(`Debug image: http://localhost:${PORT}/debug?char=あ`);
});