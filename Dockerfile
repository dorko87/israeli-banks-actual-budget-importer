FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

USER root
RUN mkdir -p /app/.yarn && chown -R pptruser:pptruser /app

USER pptruser

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
RUN yarn install

COPY . .

CMD ["yarn", "start"]
