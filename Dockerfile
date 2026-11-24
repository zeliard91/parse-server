############################################################
# Build stage
############################################################
# Pinned on purpose: node:lts-alpine silently changed the runtime between builds
FROM node:24.22.1-alpine AS build

RUN apk --no-cache add \
   build-base \
   git \
   python3

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
FROM node:24.22.1-alpine AS release

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

# Secure defaults, each one can be overridden by the container environment.
# Brute-force protection on authentication endpoints (per IP, 15 min window). Requests
# with the master key or from 127.0.0.1 are not limited. "/login(.*)" also matches GET
# /login?username=...&password=..., which a plain "/login" path does not.
ENV PARSE_SERVER_RATE_LIMIT='[{"requestPath":"/login(.*)","requestTimeWindow":900000,"requestCount":10},{"requestPath":"/users","requestMethods":["POST"],"requestTimeWindow":900000,"requestCount":10},{"requestPath":"/requestPasswordReset","requestTimeWindow":900000,"requestCount":5},{"requestPath":"/verificationEmailRequest","requestTimeWindow":900000,"requestCount":5}]'
# Take the client IP from X-Forwarded-For only when the request comes through a
# loopback or private address (reverse proxy, docker-proxy); without it, every client
# behind the proxy shares one IP and one rate limit counter
ENV PARSE_SERVER_TRUST_PROXY='["loopback","uniquelocal"]'
# Sessions last 90 days instead of 1 year; an active session is extended once half
# of that time has passed (so expiry happens after 45 to 90 days of inactivity)
ENV PARSE_SERVER_SESSION_LENGTH=7776000 \
    PARSE_SERVER_EXTEND_SESSION_ON_USE=true
USER node
EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["node", "./bin/healthcheck.js"]

ENTRYPOINT ["node", "./bin/parse-server"]
