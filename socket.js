//import WebSocket, { WebSocketServer } from 'ws';
const ws = require('ws');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('chat.db');
const wss = new ws.WebSocketServer({
    port: 8081,
    perMessageDeflate: {
        zlibDeflateOptions: {
            // See zlib defaults.
            chunkSize: 1024,
            memLevel: 7,
            level: 3
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024
        },
        // Other options settable:
        clientNoContextTakeover: true, // Defaults to negotiated value.
        serverNoContextTakeover: true, // Defaults to negotiated value.
        serverMaxWindowBits: 10, // Defaults to negotiated value.
        // Below options specified as default values.
        concurrencyLimit: 10, // Limits zlib concurrency for perf.
        threshold: 1024 // Size (in bytes) below which messages
        // should not be compressed if context takeover is disabled.
    }
});
var sockets = {};
var id = 0;
wss.on('connection', function connection(ws) {
    sockets[++id] = ws;
    ws["id"] = id;
    ws.on('message', async function incoming(message) {
        var msg = JSON.parse(message.toString("utf8"));
        if (msg.type)
            switch (msg.type) {
                case "connectionId":
                    ws.send(JSON.stringify({ type: "connectionId", id: ws.id }));
                    break;
                case "chat":
                    await sendChat(msg);
                    break;
                default:
                    break;
            }
    });
    ws.on('close', function close() {
        db.run("UPDATE Users SET ConnectinId='' WHERE ConnectinId=?", [ws.id]);
        delete sockets[ws.id];
    });
});
async function sendChat(msg) {
    let cid = parseInt(msg.toClientId);
    let cws = sockets[cid];
    let fromUser = await new Promise((resolve, reject) => {
        db.get("SELECT * FROM Users WHERE id=?", [msg.from], (err, raw) => resolve(raw));
    });
    let id = await new Promise((resolve, reject) => {
        db.get("select max(Id)+1 id from Chats", (err, raw) => resolve(raw.id));
    });
    var chatInfo = { FromUser: msg.from, ToUser: msg.to, Id: id, Message: msg.message, Time: new Date() };
    if (cws) {
        cws.send(JSON.stringify({ type: "chat", fromUser: fromUser.Name, chat: chatInfo }));
    }
    db.run(`INSERT INTO Chats
                    (Id,FromUser, ToUser, Message, Time, FileName) VALUES( ?,?,?,?,?,'')`, [id, msg.from, msg.to, msg.message, new Date()]);
}

module.exports = { wss };