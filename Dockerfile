FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS server-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY --from=server-deps /app/node_modules ./node_modules
COPY server ./server
COPY lib ./lib
COPY shared ./shared
COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 3001
CMD ["node", "server/index.js"]
