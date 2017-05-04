FROM node:7.8.0-alpine

RUN apk update && apk upgrade && \
    apk add --no-cache git

WORKDIR /home/weipoint/app
RUN npm run prod_install

COPY ./server /home/weipoint/app/server

EXPOSE 3007

RUN adduser -S weipoint
USER weipoint

CMD ["npm","run","prod"]
