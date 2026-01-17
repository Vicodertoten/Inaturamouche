FROM node:22 AS client-build
WORKDIR /app
COPY client/package*.json client/
RUN cd client && npm install
COPY client ./client
RUN cd client && npm run build

FROM node:22
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
COPY --from=client-build /app/client/dist ./client/dist
EXPOSE 3001
CMD ["node", "server/index.js"]
