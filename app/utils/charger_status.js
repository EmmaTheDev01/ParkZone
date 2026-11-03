



// We can read charger status through CSMS

let WebSocketServer = null;
let WebSocketClient = typeof WebSocket !== 'undefined' ? WebSocket : null;

try {
    const wsModule = require('ws');
    if (wsModule) {
        WebSocketServer = wsModule.WebSocketServer || null;
        if (wsModule.WebSocket) {
            WebSocketClient = wsModule.WebSocket;
        }
    }
} catch (_) {
    // Mobile React Native environment: ws native server package is not present
}

const wss = WebSocketServer ? new WebSocketServer({ port: 8080 }) : null;

// Ping chargers for every 30 seconds for status updates
const foundChargers = [];

function pingChargers() {
    if (!wss) return null;

    return setInterval(() => {
        wss.clients.forEach((ws) => {
            const status = checkChargerStatus(ws);

            if (status === 'online') {
                if (!foundChargers.includes(ws)) {
                    foundChargers.push(ws);
                }
            } else if (status === 'offline') {
                const sumfailure = foundChargers.indexOf(ws);
                if (sumfailure !== -1) {
                    foundChargers.splice(sumfailure, 1);
                }
            }
        });
    }, 30000);
}

if (wss) {
    wss.on('connection', (ws) => {
        ws.on('close', () => {
            const index = foundChargers.indexOf(ws);
            if (index !== -1) {
                foundChargers.splice(index, 1);
            }
        });
        ws.on('error', () => ws.terminate());
    });
}

function checkChargerStatus(ws) {
    if (!ws) return 'unknown';
    const WS = WebSocketClient || global.WebSocket;
    if (WS) {
        switch (ws.readyState) {
            case WS.CONNECTING:
                return 'connecting';
            case WS.OPEN:
                try {
                    ws.send(JSON.stringify({ message: 'Checking Status ONLINE......' }));
                } catch (_) {}
                return 'online';
            case WS.CLOSING:
                return 'closing';
            case WS.CLOSED:
                return 'offline';
            default:
                return 'unknown';
        }
    }
    return 'unknown';
}

// wss.clients is the set of connected chargers (WebSocket.length is not a count of anything)
function hasChargers() {
    return wss ? wss.clients.size > 0 : false;
}

module.exports = { checkChargerStatus, hasChargers, pingChargers };

// Route default export for Expo Router compatibility
module.exports.default = function ChargerStatusRoute() {
    return null;
};
