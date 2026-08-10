# ---- build : compile l'app Nuxt en bundle Nitro autonome ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime : image minimale, utilisateur non-root ----
FROM node:22-alpine
ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000
WORKDIR /app
COPY --from=build /app/.output ./.output
# .data (plugins + réglages chiffrés) doit être inscriptible par l'utilisateur node
RUN mkdir -p /app/.data && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3000/api/auth/session || exit 1
CMD ["node", ".output/server/index.mjs"]
