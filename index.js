#! /usr/bin/env node
import readline from 'node:readline';

// Log type
//  DEBUG  [WS-Connection] Event triggering socket close: {"code": 1006, "isTrusted": false, "reason": "Expected HTTP 101 response but was '401 Unauthorized'"} {"buildNumber": "1", "deviceId": "dcd54ec5a16c2d34", "deviceModel": "sdk_gphone64_arm64", "deviceName": "sdk_gphone64_arm64 - dcd54ec5a16c2d34", "filterLevel": {"name": "DEBUG", "value": 2}, "level": {"name": "DEBUG", "value": 2}, "name": "WS-Connection", "osVersion": "15", "sessionId": "aae99673-5b2b-4f58-8a96-febc40c5743d", "tenantId": "01h0", "userId": "627d2bb2-5420-422d-8e7a-999230f5c9bd", "version": "2.0.0"}
const rl = readline.createInterface({
    input: process.stdin,
    terminal: false
});

rl.on('line', (line) => {
    const isOhanaLikeLog = /\[|\]/.test(line.split(" ")[3]);
    if (isOhanaLikeLog) {
        console.info("OHANA_LOG: ", line);
    } else {
        console.info("just a log: ", line);
    }
});
