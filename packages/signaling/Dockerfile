FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY server.mjs .
EXPOSE 8080
ENV HOST=0.0.0.0
ENV PORT=8080
CMD ["node", "server.mjs"]
