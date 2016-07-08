FROM node:6-slim
WORKDIR /app
COPY . /app
RUN npm install

ENV NODE_ENV=development
EXPOSE 3000
ENTRYPOINT node app.js