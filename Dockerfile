FROM node:7.8.0-alpine

RUN apk update && apk upgrade && \
    apk add --no-cache git

WORKDIR /home/weipoint/app
COPY package.json /home/weipoint/app/package.json
RUN npm run prod_install

COPY ./src /home/weipoint/app/src

EXPOSE 3007

RUN adduser -S weipoint
USER weipoint

CMD ["npm","run","prod"]
