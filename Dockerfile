FROM node:20-slim

RUN npm install -g vibium

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

ENV CI=true

CMD ["npm", "test"]
