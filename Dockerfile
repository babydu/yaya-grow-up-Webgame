FROM node:22-alpine

WORKDIR /app

# Zero npm dependencies: server.js uses Node built-ins only.
COPY . .

EXPOSE 8080

# wget ships with alpine; probe the homepage so 1Panel can show a health badge.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/" || exit 1

CMD ["node", "server.js"]
