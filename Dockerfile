FROM node:18-alpine

# Canvasのビルドに必要な依存関係と日本語フォントをインストール
RUN apk add --no-cache \
    build-base \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    fontconfig \
    font-noto-cjk-extra

# フォントキャッシュを更新
RUN fc-cache -fv

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonをコピー
COPY package.json ./

# 依存関係をインストール
RUN npm install --production

# アプリケーションのソースをコピー
COPY . .

# ポートを公開
EXPOSE 3000

# アプリケーションを起動
CMD ["node", "server.js"]