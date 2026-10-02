FROM node:20-slim

WORKDIR /app

# Install native compilation dependencies for SQLite bindings
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./
RUN npm install

COPY . .
RUN npm run build

RUN mkdir -p /app/data

EXPOSE 4000

CMD ["node", "dist/index.js"]
