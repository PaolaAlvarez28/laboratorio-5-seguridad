# Imagen de UNA Chat: Node.js 24 (misma version usada en local)
FROM node:24-alpine

WORKDIR /app

# primero solo los manifiestos, para aprovechar la cache de Docker
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# codigo de la aplicacion (.dockerignore excluye .env, node_modules y pruebas)
COPY . .

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# usuario sin privilegios
USER node

# comando de inicio definido en package.json
CMD ["npm", "start"]
