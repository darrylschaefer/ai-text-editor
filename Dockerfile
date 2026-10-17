FROM node:24-alpine

RUN npm install --global npm@11.19.0

RUN addgroup -S appgroup && \
  adduser -S appuser -G appgroup && \
  mkdir -p /home/appuser/app && \
  chown appuser:appgroup /home/appuser/app
USER appuser

WORKDIR /home/appuser/app
# The container serves the web build and does not need the desktop binary.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY --chown=appuser:appgroup package.json package-lock.json .npmrc ./
RUN npm ci
COPY --chown=appuser:appgroup . .
RUN npm run build

EXPOSE 3000
CMD ["./node_modules/.bin/serve", "-s", "dist", "-l", "3000"]
