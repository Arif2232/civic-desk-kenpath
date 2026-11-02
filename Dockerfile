FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev && mkdir -p /data && chown node:node /data
USER node
ENV NODE_ENV=production PORT=3001 DATA_DIR=/data
EXPOSE 3001
CMD ["node", "--import", "tsx", "server/index.ts"]
