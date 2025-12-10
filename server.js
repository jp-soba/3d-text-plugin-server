const express = require('express');
const cors = require('cors');
const { createCanvas } = require('canvas');
const earcut = require('earcut'); // ポリゴンを三角形に分割するライブラリ

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ========== アルゴリズム部分 ==========

// 1. 画像から輪郭（点群）を抽出する関数 (Moore-Neighbor Tracing)
function findContours(width, height, data, threshold) {
  const grid = new Uint8Array(width * height);
  // 二値化
  for (let i = 0; i < width * height; i++) {
    const brightness = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
    grid[i] = brightness < threshold ? 1 : 0;
  }

  const contours = [];
  const visited = new Uint8Array(width * height); // 訪問済みフラグ

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      // 黒い画素で、かつ未訪問で、かつ境界（外周）である場合
      if (grid[idx] === 1 && visited[idx] === 0) {
        const contour = traceBoundary(x, y, width, height, grid, visited);
        if (contour.length > 5) {
          contours.push(contour);
        }
      }
    }
  }
  return contours;
}

// 境界を追跡するヘルパー
function traceBoundary(startX, startY, w, h, grid, visited) {
  const contour = [];
  let x = startX;
  let y = startY;
  
  // ムーア近傍の探索順序（時計回り）
  const dx = [0, 1, 1, 1, 0, -1, -1, -1];
  const dy = [-1, -1, 0, 1, 1, 1, 0, -1];
  let dir = 0; // 上から開始

  do {
    contour.push({ x, y });
    visited[y * w + x] = 1; // 訪問済みにする

    let found = false;
    // 現在の方向から左回り（反時計）に探索開始位置を探す
    const startDir = (dir + 6) % 8; // (dir - 2 + 8) % 8
    
    for (let i = 0; i < 8; i++) {
      const d = (startDir + i) % 8;
      const nx = x + dx[d];
      const ny = y + dy[d];

      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        if (grid[ny * w + nx] === 1) {
          x = nx;
          y = ny;
          dir = d;
          found = true;
          break;
        }
      }
    }
    
    if (!found) break; // 孤立点

  } while (x !== startX || y !== startY);

  return contour;
}

// 2. 点群を間引いて滑らかにする関数 (Ramer-Douglas-Peucker法)
function simplifyContour(points, epsilon) {
  if (points.length <= 2) return points;

  const len = points.length;
  
  // どの点を残すか管理するフラグ配列（メモリ効率良）
  // TypedArrayを使うとさらに軽量
  const keep = new Uint8Array(len);
  keep[0] = 1;
  keep[len - 1] = 1;

  const stack = [0, len - 1];

  while (stack.length > 0) {
    const endIndex = stack.pop();
    const startIndex = stack.pop();

    let dmax = 0;
    let index = startIndex;
    
    // 始点と終点を結ぶ線
    const a = points[startIndex];
    const b = points[endIndex];
    
    // 事前計算（割り算をループ内で減らす）
    let A = b.y - a.y;
    let B = a.x - b.x;
    let C = b.x * a.y - b.y * a.x;
    const distDenom = Math.sqrt(A*A + B*B);

    // 距離計算の最適化
    if (distDenom > 0.000001) {
       for (let i = startIndex + 1; i < endIndex; i++) {
         const p = points[i];
         const d = Math.abs(A * p.x + B * p.y + C) / distDenom;
         if (d > dmax) {
           index = i;
           dmax = d;
         }
       }
    } else {
        // 始点と終点がほぼ同じ場合
        for (let i = startIndex + 1; i < endIndex; i++) {
             const d = Math.sqrt(Math.pow(points[i].x - a.x, 2) + Math.pow(points[i].y - a.y, 2));
             if (d > dmax) {
                index = i;
                dmax = d;
             }
        }
    }

    if (dmax > epsilon) {
      keep[index] = 1;
      // 分割してスタックに積む
      stack.push(startIndex, index);
      stack.push(index, endIndex);
    }
  }

  // フラグが立っている点だけを集めて新しい配列を作る
  const result = [];
  for (let i = 0; i < len; i++) {
    if (keep[i]) result.push(points[i]);
  }
  return result;
}

// 3. 穴（Holes）の判定
// 文字「A」などの場合、外側の輪郭と内側の輪郭を区別する必要があります
function identifyHoles(contours) {
  // 面積でソート（大きい順）
  // 多角形の符号付き面積を求める（Shoelace formula）
  const polys = contours.map(c => {
    let area = 0;
    for (let i = 0; i < c.length; i++) {
      const j = (i + 1) % c.length;
      area += c[i].x * c[j].y;
      area -= c[i].y * c[j].x;
    }
    area /= 2;
    return { points: c, area: Math.abs(area), isHole: false, children: [] };
  }).sort((a, b) => b.area - a.area);

  // 包含判定
  const hierarchy = [];
  for (let i = 0; i < polys.length; i++) {
    let parent = null;
    // 自分より大きいポリゴンに対して、自分が含まれているかチェック
    for (let j = 0; j < i; j++) {
      if (isPointInPolygon(polys[i].points[0], polys[j].points)) {
        // 一番近い親を探す（実際はもっと厳密なロジックが必要だが、文字ならこれで概ねOK）
        // ここでは単純化のため、最も小さい親（直近の親）を採用すべきだが
        // 簡易的に「偶数番目のネストは穴」とするルールで処理されることが多い
        // Earcut用にフラットにするため、ここでは親子関係だけ把握する
        
        // 簡易実装: 一番最初に見つかった「自分を含んでいるポリゴン」を親とする
        // （ソート済みなので、最大のポリゴンからチェックされる）
        // ただし、親がすでに穴なら、自分は島（実体）になる
        if (!polys[j].isHole) {
            parent = polys[j];
        } else {
             // 親が穴＝自分は穴の中の島。今回は単純化のため、
             // 「穴の中の島」はないものとして（文字でそこまで複雑なのは稀）、
             // 一番外側のコンテナに入れる
             parent = polys[j]; 
        }
      }
    }
    
    if (parent) {
      polys[i].isHole = !parent.isHole; // 反転させる
      parent.children.push(polys[i]);
    } else {
      hierarchy.push(polys[i]);
    }
  }
  return hierarchy;
}

function isPointInPolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}


// ========== エンドポイント ==========

app.post('/generate', (req, res) => {
  try {
    const { char, resolution, threshold } = req.body;
    const size = Math.min(Math.max(parseInt(resolution) || 128, 64), 1024);
    const thresh = Math.min(Math.max(parseInt(threshold) || 120, 0), 255);
    const text = (char || 'あ').charAt(0);

    console.log(`Generating Vector Mesh for: "${text}" (Size: ${size})`);

    // 1. Canvas描画
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.font = `bold ${size * 0.8}px sans-serif`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);

    const imageData = ctx.getImageData(0, 0, size, size);

    // 2. 輪郭抽出 (自作関数)
    const rawContours = findContours(size, size, imageData.data, thresh);
    
    // 3. 簡略化 (頂点数を減らす)
    // 許容誤差(epsilon)はサイズに応じて調整。1.0〜2.0くらいが適当
    const simplified = rawContours.map(c => simplifyContour(c, 1.5));

    // 4. 穴の特定とEarcut用データ作成
    // Earcutは [x,y, x,y...] のフラット配列と、穴の開始インデックス配列を受け取る
    const hierarchy = identifyHoles(simplified);
    
    const allTriangles = [];
    const allOutlines = []; // 側面生成用

    // 各「島（文字の本体パーツ）」ごとに処理
    hierarchy.forEach(poly => {
        // Earcut用のデータ構造を作成
        // data: [outerX, outerY, ..., hole1X, hole1Y, ...]
        // holeIndices: [index_of_hole1, index_of_hole2...]
        
        let flatData = [];
        let holeIndices = [];
        let indexOffset = 0;

        // 外周
        poly.points.forEach(p => { flatData.push(p.x, p.y); });
        allOutlines.push({ points: poly.points, isHole: false });
        indexOffset = poly.points.length;

        // 穴 (子供たち)
        poly.children.forEach(child => {
            holeIndices.push(indexOffset);
            child.points.forEach(p => { flatData.push(p.x, p.y); });
            allOutlines.push({ points: child.points, isHole: true });
            indexOffset += child.points.length;
        });

        // 三角形分割を実行 (Earcut)
        const triangles = earcut(flatData, holeIndices);
        
        // 座標データを正規化して結果に追加
        // Earcutはインデックスを返すので、実際の座標とペアにする必要があるが、
        // Roblox側で再構築しやすいように「頂点リスト」と「インデックス」で返す
        
        allTriangles.push({
            vertices: flatData, // [x,y, x,y...]
            indices: triangles  // [0,1,2, 0,2,3...]
        });
    });

    res.json({
        success: true,
        char: text,
        canvasSize: size,
        meshes: allTriangles, // 正面・背面の三角形データ
        outlines: allOutlines // 側面を作るための輪郭線データ
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Vector Text Server running on http://0.0.0.0:${PORT}`);
});