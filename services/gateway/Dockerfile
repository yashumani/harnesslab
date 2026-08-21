FROM node:22-alpine

WORKDIR /app

COPY --chown=node:node package.json ./package.json
COPY --chown=node:node apps/web/engine.js ./apps/web/engine.js
COPY --chown=node:node apps/web/result-contract.js ./apps/web/result-contract.js
COPY --chown=node:node services/gateway ./services/gateway

ENV APP_ENV=production \
    HARNESSLAB_GATEWAY_HOST=0.0.0.0 \
    HARNESSLAB_GATEWAY_PORT=8787 \
    HARNESSLAB_PROVIDER=deterministic

USER node
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "services/gateway/server.mjs"]
