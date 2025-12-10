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
  
  // 背景白、文字黒で描画
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  
  const fontSize = resolution * 0.9;
  ctx.font = `bold ${fontSize}px sans-serif`; // 太字の方が3Dで見栄えが良い
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(singleChar, canvasSize / 2, canvasSize / 2);
  
  const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
  const data = imageData.data;
  
  // 1. ピクセルのON/OFFを2次元配列化（処理しやすくするため）
  const grid = new Array(canvasSize).fill(0).map(() => new Array(canvasSize).fill(false));
  let pixelOnCount = 0;

  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      const index = (y * canvasSize + x) * 4;
      const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
      if (brightness < threshold) {
        grid[y][x] = true;
        pixelOnCount++;
      }
    }
  }

  // 2. Greedy Meshing (大きな長方形として切り出す)
  const bars = [];
  
  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      if (grid[y][x]) {
        // 開始点を見つけた
        
        // A. 横幅(width)を決定
        let width = 0;
        while (x + width < canvasSize && grid[y][x + width]) {
          width++;
        }
        
        // B. 高さ(height)を決定
        // この width の幅が、下の行でも全く同じように続いているか確認
        let height = 1;
        while (y + height < canvasSize) {
          let nextRowMatch = true;
          for (let k = 0; k < width; k++) {
            if (!grid[y + height][x + k]) {
              nextRowMatch = false;
              break;
            }
          }
          if (!nextRowMatch) break;
          height++;
        }
        
        // C. 長方形を記録
        bars.push({
          x: x,
          y: y,
          width: width,
          height: height
        });
        
        // D. 記録した部分をグリッドから削除（使用済みにする）
        for (let dy = 0; dy < height; dy++) {
          for (let dx = 0; dx < width; dx++) {
            grid[y + dy][x + dx] = false;
          }
        }
      }
    }
  }
  
  const result = {
    success: true,
    char: singleChar,
    resolution: resolution,
    threshold: threshold,
    canvasWidth: canvasSize,
    canvasHeight: canvasSize,
    bars: bars,     // これで {x, y, width, height} が返る（height > 1 になりうる）
    barCount: bars.length,
    pixelOnCount: pixelOnCount
  };
  
  console.log(`Generated ${bars.length} blocks for "${singleChar}" (Greedy Mesh)`);
  
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