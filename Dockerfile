FROM pablozaiden/typescript:onbuild

ENV NODE_ENV=development

EXPOSE 3000
ENTRYPOINT node app.js