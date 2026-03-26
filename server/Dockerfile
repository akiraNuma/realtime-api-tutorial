FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 9876
CMD ["npm", "run", "server"]
