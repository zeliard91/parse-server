############################################################
# Build stage
############################################################
# Pinned on purpose: node:lts-alpine silently changed the runtime between builds
FROM node:24.21.0-alpine AS build

RUN apk --no-cache add git
WORKDIR /tmp

# Copy package.json first to benefit from layer caching
COPY package*.json ./

# Copy src to have config files for install
COPY . .

# Install without scripts
RUN npm ci --omit=dev --ignore-scripts \
    # Copy production node_modules aside for later
 && cp -R node_modules prod_node_modules \
    # Install all dependencies
 && npm ci \
    # Run build steps
 && npm run build

############################################################
# Release stage
############################################################
FROM node:24.21.0-alpine AS release

VOLUME /parse-server/cloud /parse-server/config

WORKDIR /parse-server

# Bundled so that "nodemon" starts without npx downloading it at each container
# start (needs network, unpinned version, and an extra npm process in memory)
RUN npm install -g nodemon@3.1.14 && npm cache clean --force

# Copy build stage folders
COPY --from=build /tmp/prod_node_modules /parse-server/node_modules
COPY --from=build /tmp/lib lib

COPY package*.json ./
COPY bin bin
COPY public_html public_html
COPY views views
RUN mkdir -p logs && chown -R node: logs

ENV PORT=1337
USER node
EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["node", "./bin/healthcheck.js"]

ENTRYPOINT ["node", "./bin/parse-server"]
