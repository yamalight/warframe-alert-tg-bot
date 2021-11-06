FROM node:16-alpine

# Disable npm audit to speed things up
RUN npm set audit false

# create new workdir
WORKDIR /app

# install deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy rest of code
COPY . .

# set environment to production
ENV NODE_ENV production

# set binary as entry point
CMD ["node", "index.js"]
