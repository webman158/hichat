var http = require('http'),
    express = require('express'),
    app = express(),
    server = http.createServer(app),
    io = require('socket.io').listen(server),
    users = []; //保留所有在线用户的信息(头像和昵称)

app.use('/', express.static(__dirname + '/www'));
server.listen(process.env.PORT || 9999);

/*
 * 得到自己电脑的局域网IP地址
 */
var os = require('os'),
    iptable = {},
    ifaces = os.networkInterfaces();
for (var dev in ifaces) {
    ifaces[dev].forEach(function(details, alias) {
        if ((details.family == 'IPv4') && (details.internal == false)) {
            // iptable[dev+(alias?':'+alias:'')]=details.address;
            iptable['localIP'] = details.address;
        }
    });
}
// 自动打开页面
ipcode = iptable.localIP + ":9999";
console.log(ipcode);

// node 自动打开默认浏览器
var open = require('child_process');
open.exec('start http://' + ipcode);


// socket部分
io.on('connection', function(socket) {

    //处理登录
    socket.on('login', function(data) {
        var nickname = data.nickname;
        var flag = true;

        for (var i = 0; i < users.length; i++) {
            if (users[i].nickname == nickname) {
                //向该用户发送表示用户名已经存在
                socket.emit('nickExisted');
                flag = false;
                break;
            }
        }

        if (flag) {
            var id = socket.id;
            data.id = id;
            // 将登录类型绑定为login
            data.type = "login";

            //将用户的在数组中的索引保存在当前socket中
            // socket.userIndex = users.length;
            //将该用户的信息存在当前socket中
            socket.nickname = nickname;
            socket.avatar = data.avatar;
            users.push(data);
            //向该用户发送表示登录成功
            socket.emit('loginSuccess', {
                users: users,
                len: users.length,
            });

            //向所有连接到服务器的客户端广播该用户的登录上线 io.sockets
            //向所有连接到服务器的客户端广播该用户的登录上线 除了他自己 socket.broadcast
            socket.broadcast.emit('system', {
                id: socket.id,
                avatar: data.avatar,
                nickname: nickname,
                len: users.length,
                type: 'login'
            });
            console.log("当前在线人数login:  "+users.length);
        }
    })

    //处理退出
    socket.on('disconnect', function() {
        // console.log('disconnect   '+ socket.nickname);
        if (socket.nickname != null) {
            // 上面userIndex属性保存在socket中的意义就体现出来了
            // users.splice(socket.userIndex, 1);

            //将该用户从数组中删掉
            users.forEach(function(v,i){
              if(v.id === socket.id){
                  users.splice(i, 1);
              }
            })

            // console.log('socket.userIndex  '+ socket.userIndex);

            //通知除自己以外的所有人，nickname睡醒保存在socket的意义体现出来了
            socket.broadcast.emit('system', {
                id: socket.id,
                avatar: socket.avatar,
                nickname: socket.nickname,
                len: users.length,
                type: 'logout'
            });
            console.log("当前在线人数logout:  "+users.length);
        }
    })

    //处理聊天
    socket.on('postMsg', function(data) {
        //除自己以外的其他用户广播
        socket.broadcast.emit('newMsg', {
            avatar: data.avatar,
            nickname: data.nickname,
            msg: data.msg,
            color: data.color
        });
        // socket.broadcast.emit('newMsg',socket.nickname,msg,color);
    })

    //接收图片
    socket.on('sendImg', function(data) {
        // 通过一个 newImg 事件分发到除自己外的每个用户
        socket.broadcast.emit('newImg', {
            avatar: data.avatar,
            nickname: data.nickname,
            imgData: data.imgData,
            color: data.color
        });
        // socket.broadcast.emit('newImg',socket.nickname,imgData,color);
    })
});

console.log('server started');
