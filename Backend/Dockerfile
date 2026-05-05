FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
