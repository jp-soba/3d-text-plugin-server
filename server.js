const express = require('express');
const cors = require('cors');
const { createCanvas } = require('canvas');
const d3 = require('d3-contour'); // 信頼の幾何学ライブラリ
const earcut = require('earcut');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/generate', (req, res) => {
  try {
    const { char, resolution, threshold } = req.body;
    // 解像度制限 (メモリ保護のため最大512程度にしておくのが無難です)
    const size = Math.min(Math.max(parseInt(resolution) || 128, 64), 512);
    // しきい値を 0~1 に正規化
    const threshVal = Math.min(Math.max(parseInt(threshold) || 120, 0), 255);
    const text = (char || 'あ').charAt(0);

    console.log(`Generating(D3): "${text}" (Size: ${size})`);

    // 1. Canvas描画
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // 背景黒、文字白にする（d3-contoursは「値が高いところ」を島とみなすため）
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    
    ctx.font = `bold ${size * 0.8}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);

    const imageData = ctx.getImageData(0, 0, size, size);
    const { width, height, data } = imageData;

    // 2. 輝度データの抽出 (1次元配列)
    // d3-contoursは [0, 1, 0, ...] のようなフラットな配列を求めます
    const values = new Float64Array(width * height);
    for (let i = 0; i < width * height; i++) {
      // 白(255)なら1、黒(0)なら0に近い値
      const brightness = data[i * 4]; 
      values[i] = brightness; 
    }

    // 3. 輪郭抽出 (d3-contours)
    // しきい値を指定して輪郭を生成。GeoJSON形式で返ってきます。
    // GeoJSONの構造: MultiPolygon -> Polygons -> Rings (1つ目が外周、2つ目以降は穴)
    const contours = d3.contours()
      .size([width, height])
      .thresholds([threshVal]) // しきい値
      (values);

    const allTriangles = [];
    const allOutlines = [];

    // 生成された等高線（普通は1つだけだが、念のためループ）
    contours.forEach(geometry => {
      // geometry.coordinates は MultiPolygon (ポリゴンの配列)
      geometry.coordinates.forEach(polygon => {
        // polygon はリングの配列
        // polygon[0]: 外周 (Exterior Ring)
        // polygon[1...]: 穴 (Interior Rings / Holes)

        const flatVertices = [];
        const holeIndices = [];
        let vertexCount = 0;

        // 各リング（外周＋穴）を処理
        polygon.forEach((ring, ringIndex) => {
          // 穴の開始位置を記録 (earcut用)
          if (ringIndex > 0) {
            holeIndices.push(vertexCount);
          }

          // リングの頂点をフラット配列に追加
          // d3の座標は反時計回りなど一貫しているのでそのまま使えます
          // ringは [[x,y], [x,y]...] の形
          
          // ★簡略化（間引き）処理★
          // すべての点を使うと重いので、距離が近すぎる点はスキップしても良いですが、
          // d3-contoursはすでに滑らかなので、そのまま使うか、単純に間引く
          ring.forEach((point) => {
            flatVertices.push(point[0], point[1]);
            vertexCount++;
          });

          // 側面生成用に保存 (穴かどうかを記録)
          allOutlines.push({
            points: ring.map(p => ({ x: p[0], y: p[1] })),
            isHole: ringIndex > 0
          });
        });

        // 4. 三角形分割 (Earcut)
        // 頂点が少なすぎる(三角形にならない)場合はスキップ
        if (flatVertices.length >= 6) {
            const triangles = earcut(flatVertices, holeIndices);
            
            allTriangles.push({
                vertices: flatVertices,
                indices: triangles
            });
        }
      });
    });

    res.json({
        success: true,
        char: text,
        canvasSize: size,
        meshes: allTriangles,
        outlines: allOutlines
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Stable D3 Text Server running on http://0.0.0.0:${PORT}`);
});