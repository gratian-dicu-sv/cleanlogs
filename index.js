#! /usr/bin/env node
import readline from 'node:readline';
import { lastJson } from 'log-parsed-json';
import { createServer } from 'node:http';
import { ApolloServer } from '@apollo/server';
import { WebSocketServer } from 'ws';
import { PubSub } from 'graphql-subscriptions';

import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express5';
import express from 'express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { useServer } from 'graphql-ws/use/ws';
import cors from 'cors';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read and parse package.json
const packageJson = JSON.parse(
  readFileSync(join(__dirname, 'package.json'), 'utf-8')
);
const version = packageJson.version;

const args = process.argv;

if (args.length>2) {
  const option = args[2];
  switch (option) {
    case '-h': 
      console.log(`Ohana CleanLogs:
  This script starts an Apollo subscription on localhost:4000/graphql that will replicate the 
  logs line by line from a logsession.txt file.
  This file should be a "dump" log file from npm run start | tee -a logsession.txt
        Also it cleans and parses the logs.
        -v: Show the version of the script
        -u: Show an usage example`);
      break;
    case '-v':
      console.log(`Version: ${version}`)
      break;
    case '-u':
      console.log(`Usage:
        > tail -f logsession.txt | cleanlogs`);
      break;
    default:
      console.log("Try running > cleanlogs -h");
      break;
  }
  process.exit(1);
}


const typeDefs = `
  type Message {
    device: String
    message: String
  }

  type Subscription {
    messageReceived: Message
  }

  type Query {
    _empty: String
  }
`;

const resolvers = {
  Subscription: {
    messageReceived: {
        resolve: (payload) => {
            return payload.messageReceived;
        },
        subscribe: () => pubsub.asyncIterableIterator(LOG_MESSAGE_SENT)}
  }
};

// Create the schema, which will be used separately by ApolloServer and
// the WebSocket server.
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Create an Express app and HTTP server; we will attach both the WebSocket
// server and the ApolloServer to this HTTP server.
const app = express();
const httpServer = createServer(app);

// Create our WebSocket server using the HTTP server we just set up.
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});
// Save the returned server's info so we can shutdown this server later
const serverCleanup = useServer({ schema }, wsServer);

// Set up ApolloServer.
const server = new ApolloServer({
  schema,
  plugins: [
    // Proper shutdown for the HTTP server.
    ApolloServerPluginDrainHttpServer({ httpServer }),

    // Proper shutdown for the WebSocket server.
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

await server.start();
app.use(
  '/graphql',
  cors(),
  express.json(),
  expressMiddleware(server),
);

const PORT = 4000;
// Now that our HTTP server is fully set up, we can listen to it.
httpServer.listen(PORT, () => {
  console.log(`Server is now running on http://localhost:${PORT}/graphql`);
});


const pubsub = new PubSub();
const LOG_MESSAGE_SENT = 'LOG_MESSAGE_SENT';

const sendLog = (json, message) => {
    pubsub.publish(LOG_MESSAGE_SENT, {messageReceived: {device: json, message}});
    return true;
}

// Log type
//  DEBUG  [WS-Connection] Event triggering socket close: {"code": 1006, "isTrusted": false, "reason": "Expected HTTP 101 response but was '401 Unauthorized'"} {"buildNumber": "1", "deviceId": "dcd54ec5a16c2d34", "deviceModel": "sdk_gphone64_arm64", "deviceName": "sdk_gphone64_arm64 - dcd54ec5a16c2d34", "filterLevel": {"name": "DEBUG", "value": 2}, "level": {"name": "DEBUG", "value": 2}, "name": "WS-Connection", "osVersion": "15", "sessionId": "aae99673-5b2b-4f58-8a96-febc40c5743d", "tenantId": "01h0", "userId": "627d2bb2-5420-422d-8e7a-999230f5c9bd", "version": "2.0.0"}

// DEBUG  [ResponseLoggerLink] query getWebSocketUrl has returned with status code 200, with data {"responseData": {"getWebSocketUrl": {"__typename": "WebSocketUrlResponse", "url": "wss://pubsub-dev-ohana-dev.webpubsub.azure.com/client/hubs/ohana_pubsub_hub?access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjpbIndlYnB1YnN1Yi5qb2luTGVhdmVHcm91cC42MjdkMmJiMi01NDIwLTQyMmQtOGU3YS05OTkyMzBmNWM5YmQiLCJ3ZWJwdWJzdWIuc2VuZFRvR3JvdXAuNjI3ZDJiYjItNTQyMC00MjJkLThlN2EtOTk5MjMwZjVjOWJkIl0sIndlYnB1YnN1Yi5ncm91cCI6WyI2MjdkMmJiMi01NDIwLTQyMmQtOGU3YS05OTkyMzBmNWM5YmQiXSwiaWF0IjoxNzQ4NTEwMTA0LCJleHAiOjE3NDg1MTM3MDQsImF1ZCI6Imh0dHBzOi8vcHVic3ViLWRldi1vaGFuYS1kZXYud2VicHVic3ViLmF6dXJlLmNvbS9jbGllbnQvaHVicy9vaGFuYV9wdWJzdWJfaHViIiwic3ViIjoiZGNkNTRlYzVhMTZjMmQzNCJ9.P481CqEu2JnPZ8D_VM97fhV2vwEakBoKMUzR4IWOa0s"}}} {"buildNumber": "1", "deviceId": "dcd54ec5a16c2d34", "deviceModel": "sdk_gphone64_arm64", "deviceName": "sdk_gphone64_arm64 - dcd54ec5a16c2d34", "filterLevel": {"name": "DEBUG", "value": 2}, "level": {"name": "DEBUG", "value": 2}, "name": "ResponseLoggerLink", "osVersion": "15", "sessionId": "aae99673-5b2b-4f58-8a96-febc40c5743d", "tenantId": "01h0", "userId": "627d2bb2-5420-422d-8e7a-999230f5c9bd", "version": "2.0.0"}
const rl = readline.createInterface({
    input: process.stdin,
    terminal: false
});

let prevDevice = '';
const SHOW_LOG_LEVEL = false;

const removeContext = (log) => {
    const startToken =  "{\"buildNumber\":";
    const contextStartIndex = log.indexOf(startToken);
    return log.substring(0, contextStartIndex).trim();
}

const formatters = {
    "ResponseLoggerLink": (log) => {
        try {
            log = removeContext(log);
            const startToken =  "{\"responseData\":";
            const endToken = "} {";
            const formatLog = log.split(startToken)[1] ? log.split(startToken)?.[1]?.split(endToken)?.[0] : log;
            return formatLog;
        } catch (error) {
            console.warn("Error parsing log:", error);
            return ''            
        }
    }
}
rl.on('line', (line) => {
    try {
        let formattedLog = line;
        const isOhanaLikeLog = /\[|\]/.test(line.split(" ")[3]);
        if (isOhanaLikeLog) {
            const loggerContext = lastJson(line);
            if (loggerContext && loggerContext.length > 0) {
                const logObject = JSON.parse(loggerContext);
                // Log the parsed JSON object
                if (logObject.buildNumber) {
                    if (prevDevice !== logObject.deviceName) {
                        prevDevice = logObject.deviceName;
                        console.info(`\n📱\x1b[32m ${logObject.deviceName}\x1b[0m\n`);
                    }
                    const hasFormatter = Object.keys(formatters).some((key) => key === logObject.name);
                    if (hasFormatter) {
                        Object.keys(formatters).forEach((key) => {
                            if (logObject.name === key) {
                                formattedLog = "" + formatters[key](line);
                            }
                        });
                    } else {
                        formattedLog = formattedLog.split("] ")[1].split(" {")[0];
                    }
                    
                    sendLog(JSON.stringify(logObject), formattedLog);
                    // If the log object has a build number, it's likely a valid log line
                    console.info(`${new Date().toLocaleTimeString('ro-RO')} | ${SHOW_LOG_LEVEL ? logObject.level?.name + '| ' : ''}${logObject.name} ~ ${formattedLog}`);
                }
            }
        }
    }
    catch (e) {
        // If parsing fails, it's not a valid JSON log line
        console.error("Invalid JSON log line:", line);
        return;
    }
});
