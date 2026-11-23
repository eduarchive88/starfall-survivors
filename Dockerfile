FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js ./
COPY index.html data.js engine.js ui.js net.js manifest.webmanifest icon-192.png icon-512.png ./public/
COPY fonts ./public/fonts
ENV PORT=80
EXPOSE 80
CMD ["node", "server.js"]
