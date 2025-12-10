# ベースイメージには軽量かつCanvasのビルドが安定しているDebianベース(slim)を使用
FROM node:20-slim

# 1. システム依存関係と日本語フォントのインストール
# canvasに必要なライブラリ + 日本語フォント(fonts-noto-cjk)
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 2. 作業ディレクトリの設定
WORKDIR /app

# 3. 依存パッケージのインストール
COPY package*.json ./
# 開発用依存を除外してインストール
RUN npm install --production

# 4. アプリケーションコードのコピー
COPY server.js ./

# 5. ポートの公開 (server.jsのデフォルト)
EXPOSE 3000

# 6. サーバー起動
CMD ["npm", "start"]