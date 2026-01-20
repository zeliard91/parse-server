#!/usr/bin/env node

/**
 * Wrapper to start parse-server with PM2
 * This cleans process.argv to avoid PM2 arguments being passed to parse-server CLI
 */

// Clean process.argv to only keep node and script path
// Remove any arguments that PM2 might add
process.argv = process.argv.slice(0, 2);

// Now require parse-server CLI which will read config from environment variables
require('./bin/parse-server');