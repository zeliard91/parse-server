#!/usr/bin/env node
// Docker HEALTHCHECK: exits 0 when the Parse Server health endpoint answers "ok".
// 127.0.0.1 is used on purpose: "localhost" may resolve to ::1 while the server
// only listens on IPv4.
const port = process.env.PORT || 1337;
const mountPath = process.env.PARSE_SERVER_MOUNT_PATH || '/parse';

fetch(`http://127.0.0.1:${port}${mountPath}/health`, { signal: AbortSignal.timeout(4000) })
  .then(response => response.json())
  .then(body => process.exit(body.status === 'ok' ? 0 : 1))
  .catch(() => process.exit(1));
