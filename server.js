var fs = require('fs');
const express = require('express');
var bodyParser = require('body-parser');
const multer = require('multer')

const upload = multer({ dest: '/client/files' })

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('chat.db');

require('./socket');
const { wss } = require('./socket');

const app = express();
const PORT = process.env.PORT = 8080;

app.use(bodyParser.json())
app.use(express.static('client'));

app.post("/Chat/UpdateUser", async (req, res) => {
    var bdy = req.body;
    var uid = await new Promise((resolve, reject) => {
        db.get("SELECT Id, Name, Email, ConnectinId FROM Users where Name=? or Name=?", [bdy.id, bdy.id.toLowerCase()], (err, row) => {
            if (row) {
                resolve(row.Id);
                db.run("UPDATE Users SET ConnectinId=? WHERE Id=?", [bdy.connectionId, row.Id]);
            } else {
                db.get("select max(id)+1 id from Users", (err, row) => {
                    var id = row.id;
                    resolve(id);
                    db.run("INSERT INTO Users (id, Name, Email, ConnectinId) VALUES (?, ?, '', ?)", [id, bdy.id, bdy.connectionId]);
                });
            }
        });
    });
    wss.clients.forEach(c => c.send(JSON.stringify({ type: "userUpdated", id: uid, name: bdy.id })));
    return res.json({ id: uid });
});
app.get("/Chat/GetUsers", async (req, res) => {
    var users = await new Promise((resolve, reject) => {
        db.all("SELECT Id, Name, Email, ConnectinId FROM Users", (err, rows) => {
            resolve(rows);
        });
    });
    return res.json(users);
});
app.get("/Chat/GetChats", async (req, res) => {
    var from = req.query.from;
    var me = req.query.me;
    var chats = await new Promise((resolve, reject) => {
        db.all("SELECT Id, FromUser, ToUser, Message, Time, FileName FROM Chats where FromUser = ? and ToUser = ? or FromUser = ? and ToUser = ?", [from, me, me, from], (err, rows) => {
            resolve(rows);
        });
    });
    return res.json(chats);
});
app.post("/Chat/FileUpload", upload.single("file"), async (req, res) => {
    var from = req.body.from;
    var to = req.body.to;
    var message = req.body.message;
    var file = req.file;
    let fromUser = await new Promise((resolve, reject) => {
        db.get("SELECT * FROM Users WHERE id=?", [from], (err, raw) => resolve(raw));
    });
    let toUser = await new Promise((resolve, reject) => {
        db.get("SELECT * FROM Users WHERE id=?", [to], (err, raw) => resolve(raw));
    });
    let id = await new Promise((resolve, reject) => {
        db.get("select max(Id)+1 id from Chats", (err, raw) => resolve(raw.id));
    });
    var chatInfo = { FromUser: from, ToUser: to, Id: id, Message: message, Time: new Date() };
    if (file) {
        chatInfo["FileName"] = id + "_" + file.originalname;
        var dir = './client/files';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.copyFileSync(file.path, dir + "/" + chatInfo["FileName"]);
    }
    db.run(`INSERT INTO Chats
                    (Id,FromUser, ToUser, Message, Time, FileName) VALUES( ?,?,?,?,?,?)`, [id, from, to, message, new Date(), chatInfo["FileName"]]);
    wss.clients.forEach(c => {
        if (c.id == parseInt(toUser.ConnectinId)) {
            c.send(JSON.stringify({ type: 'chat', fromUser: fromUser.Name, chat: chatInfo }));
        }
    });
    return res.json(chatInfo);
});
app.listen(PORT, () => {
    console.log('Server is running at:', PORT);
});