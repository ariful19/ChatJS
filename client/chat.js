
var ws;
var myConnectionId = 0;
function initWebSocket() {
    return new Promise(function (resolve, reject) {
        ws = new WebSocket('ws://localhost:8081');
        ws.addEventListener('open', function open() {
            ws.send(JSON.stringify({ type: 'connectionId' }));
        });
        ws.addEventListener('message', function message(data) {
            var d = JSON.parse(data.data);
            switch (d.type) {
                case "connectionId":
                    myConnectionId = d.id;
                    resolve(myConnectionId);
                    break;
                case "userUpdated":
                    app.GetUsers();
                    break;
                case "chat":
                    var u = sessionStorage.getItem('id');
                    var su = window.app.users.find(o => o.Id == d.chat.FromUser);
                    console.log(d.chat);
                    if (!su.selected)
                        window.app.userClick(su);
                    window.app.addChat(d.chat.Id, d.chat.FromUser, d.chat.ToUser, d.chat.Message, d.chat.Time, d.chat.ToUser == u, d.chat.FileName);
                    window.app.chatScrollToBottom(0);
                    break;
                default:
                    break;
            }
        });
    });
}

const { createApp } = Vue;

function log(text) {
    var time = new Date();

    console.log("[" + time.toLocaleTimeString() + "] " + text);
}



window['app'] = createApp({
    data() {
        return {
            message: '',
            users: null,
            chats: null,
            selectedUser: null,
            callStarted: false,
            callEnabled: false
        }
    },
    async mounted() {
        var cid = await initWebSocket();
        var userName = "";
        while (userName == "") {
            userName = prompt("Please Enter your name: ", "");
        }
        var res = await fetch("/Chat/UpdateUser", { body: JSON.stringify({ id: userName, connectionId: myConnectionId }), method: 'POST', headers: { 'Content-Type': 'application/json' } });
        var user = await res.json();
        sessionStorage.setItem('id', user.id);
        if (res.ok) this.GetUsers();
    },
    methods: {
        async GetUsers() {
            var res = await fetch("/Chat/GetUsers");
            var data = await res.json();
            data.forEach(o => o["selected"] = false);
            if (this.selectedUser) {
                this.selectedUser = data.find(o => o.id == this.selectedUser.id);
                this.selectedUser.selected = true;
            }
            this.users = data;
        },
        async userClick(i) {
            this.users.forEach(o => o["selected"] = false);
            i.selected = true;
            this.selectedUser = i;
            var frm = sessionStorage.getItem('id');
            var res = await fetch(`/Chat/GetChats?from=${i.Id}&me=${frm}`);
            var data = await res.json();
            data.forEach(o => {
                o["isFrom"] = o.ToUser == frm;
                o["name"] = o["isFrom"] ? i.Name : "Me";
                var t = moment(parseInt(o.Time));
                o.Time = t.format('hh:mm:ssa DD-MM-yy');
            });
            this.chats = data;

            this.chatScrollToBottom(100);
        },
        sendClick() {
            var frm = sessionStorage.getItem('id');
            var to = this.users.find(o => o["selected"]);
            this.addChat(0, frm, to, this.message, new Date(), false);
            ws.send(JSON.stringify({ type: 'chat', from: frm, to: to.Id, message: this.message, toClientId: to.ConnectinId }));

            this.message = "";
        },
        addChat(id, fromUser, toUser, message, time, isFrom, fileName = null) {
            var name = this.users.find(o => o.selected).Name;
            var t = moment(time);
            if (!this.chats) this.chats = [];
            this.chats.push({ Id: id, FromUser: fromUser, ToUser: toUser, Message: message, Time: t.format('hh:mm:ssa DD-MM-yy'), isFrom: isFrom, Name: isFrom ? name : "Me", FileName: fileName });
            this.chatScrollToBottom(0);
        },
        chatScrollToBottom(delay) {
            var ivalelm = setInterval(() => {
                var elm = document.querySelector(".msgcont");// as HTMLElement;
                if (elm) {
                    setTimeout(() => {
                        elm.scrollTop = elm.scrollHeight;
                    }, delay);
                    clearInterval(ivalelm);
                }
            }, delay / 2);
        },
        onKeyPress(e) {
            if (e.key == 'Enter') {
                this.sendClick();
                e.preventDefault();
            }
            if (e.key == "\n") {
                var elm = e.target;//as HTMLTextAreaElement;
                var curPos = elm.selectionStart;
                elm.value = elm.value.slice(0, curPos) + "\n" + elm.value.slice(curPos);
            }
        },
        async onFileChange(e) {
            if (e.target.files) {
                var file = e.target.files[0];// as File;
                var frm = sessionStorage.getItem('id');
                var to = this.users.find(o => o.selected);
                var fd = new FormData();
                fd.append("file", file, file.name);
                fd.append("from", frm);
                fd.append("to", to.Id);
                fd.append("message", this.message);
                var res = await fetch("/Chat/FileUpload", {
                    method: 'POST', body: fd
                });
                var json = await res.json();
                if (res.ok) {
                    this.addChat(json.Id, frm, to.id, this.message, new Date(), false, json.FileName);
                    this.message = "";
                }
            }
        },
        isImage(fn) {
            var arr = fn.split('.');
            var ext = arr[arr.length - 1].toLowerCase();
            return ["jpg", "png", "jpeg", "gif"].find(o => o == ext);
        },
        getMyConnectionId() {
            var id = sessionStorage.getItem('id');
            return this.users.find(o => o.id == id).connectinId;
        }
    }
}).mount('#vapp')