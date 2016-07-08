FROM node:6-slim
WORKDIR /app
COPY . /app
RUN npm install

ENTRYPOINT node app.js