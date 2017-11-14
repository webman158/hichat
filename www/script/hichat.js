
// 文档树加载完成
document.addEventListener('DOMContentLoaded', function() {
    // 实例并初始化我们的程序
    var hichat = new HiChat();
    hichat.init();
});

// 定义我们的 HiChat 类
var HiChat = function() {
    // socket
    this.socket = null;

    // 当前聊天群所有的用户
    this.users = [];
    // 当前聊天的未读总数
    this.msgNum = 0;

    //默认头像
    this.moAvatar = '../content/avatar.jpg';
    // 用户信息
    this.userinfo = {
        nickname: "",
        avatar: this.moAvatar
    };

    // 页面元素
    //登录页面的提示信息框
    this.info = document.getElementById('info');
    //用户名输入框
    this.nicknameInput = document.getElementById('nicknameInput');
    // 头像框
    this.avatar = document.getElementById('avatar');
    // 用户列表
    this.userList = document.getElementById('userList');
    //消息输入框
    this.messageInput = document.getElementById('messageInput');
    //表情容器
    this.emojiWrapper = document.getElementById('emojiWrapper');
    //登录界面
    this.loginWrapper = document.getElementById("loginWrapper");
    //登录按钮
    this.loginBtn = document.getElementById('loginBtn');
    // 在线人数状态
    this.status = document.getElementById('status');
    // 发送按钮
    this.sendBtn = document.getElementById("sendBtn");
    //清空列表按钮
    this.clearBtn = document.getElementById('clearBtn');
    // 聊天历史容器
    this.historyMsg = document.getElementById('historyMsg');
    // 颜色选择框
    this.colorStyle = document.getElementById('colorStyle');
    // 未读条数
    this.msgTip = document.getElementById('msgTip');
}

HiChat.prototype = {
    constructor: HiChat,
    init: function() {
        // 用于初始化该程序
        var that = this;

        // "socket的on事件"都是服务器告诉我们的事件
        // 根据返回来的数据做处理

        //建立与服务器的socket连接
        this.socket = io.connect();

        //监听socket的connect事件，该事件表示与服务器连接成功
        this.socket.on('connect', function() {
            console.log('与服务器 connect 连接成功');

            // 连接到服务器，显示昵称输入框
            that.info.innerHTML = '请输入你的昵称';
            document.getElementById('nickWrapper').style.display = "block";
            that.nicknameInput.focus();
        });

        //用户名已经存在
        this.socket.on('nickExisted', function() {
            console.log("用户名已经存在");
            that.info.innerHTML = "该用户名已被占用，请重新输入！"
        });

        //登录成功
        this.socket.on('loginSuccess', function(data) {
            console.log("登录成功");
            document.title = "Hi " + that.nicknameInput.value;
            that.loginWrapper.style.display = "none";
            that.messageInput.focus();

            // newAdd
            // 登录成功之后拿到聊天群所有的在线用户
            that.users = data.users;

            // 由于后台改成登录成功给自己发送loginSuccess，给其他人发送system的login事件
            // 所以需要在loginSuccess事件内，调用_systemShow事件，来显示在线用户列表，以及同步在线人数
            // 系统消息
            that._systemShow({
                avatar: data.avatar,
                nickname: data.nickname,
                type: data.type
            });

            //给元素绑定相关事件
            that.bindChatEvent();
            //初始化表情包
            that._initEmoji();
        });

        // 服务器异常
        this.socket.on('error', function(err) {
            console.log('这是error ' + err);
            if (that.loginWrapper.style.display === 'none') {
                that.status.innerHTML = "于服务器链接失败，请重新链接";
            } else {
                that.info.innerHTML = "登录失败，于服务器链接失败，请重新链接"
            }
        });

        //处理有人加入或者是离开
        this.socket.on('system', function(data) {
            // console.log(data);

            //判断用户是加入还是离开显示不同的信息
            //var msg = data.nickname + (data.type === "login" ? " 加入" : " 离开");
            // 系统消息
            that._systemShow({
                avatar: data.avatar,
                nickname: data.nickname,
                type: data.type
            });
        });

        //处理接受到的聊天消息
        this.socket.on('newMsg', function(data) {
            that._displayNewMsg({
                nickname: data.nickname,
                avatar: data.avatar,
                msg: data.msg,
                color: data.color
            });
            // 更新未读提示
            that._newMessage();
        });

        //接收图片
        this.socket.on('newImg', function(data) {
            that._displayNewMsg({
                avatar: data.avatar,
                nickname: data.nickname,
                msg: data.imgData,
                color: data.color,
                type: "img",
            });
            // 更新未读提示
            that._newMessage();
        })

        // 绑定登录相关事件
        that.login();
    },
    login: function() {
        //登录相关的DOM操作
        var that = this;

        // 更换头像
        that.avatar.addEventListener('change', function() {
            var ele = this;
            that._upLoadImg(this, function(data) {
                ele.parentNode.style.backgroundImage = 'url(' + data + ')';
                // 将avatar信息保存在userinfo信息内
                that.userinfo.avatar = data;
            });
        })

        //登录按钮
        that.loginBtn.addEventListener('click', function() {
            var userInput = that.nicknameInput;
            var nickname = userInput.value;
            if (nickname.trim().length) {
                //将昵称保存到userinfo对象内
                that.userinfo.nickname = nickname;
                //将userinfo发送到服务端
                that.socket.emit('login', that.userinfo);
            } else {
                userInput.focus();
            }

            return false;
        });
        //登录按钮的回车事件绑定
        that.nicknameInput.addEventListener('keyup', function(e) {
            if (e.keyCode === 13) {
                that.loginBtn.click();
            }
        })
    },
    bindChatEvent: function() {
        var that = this;

        //发送消息
        that.sendBtn.addEventListener('click', function() {
            var messageInput = that.messageInput,
                msg = messageInput.value,
                color = that.colorStyle.value;

            // 清空输入框
            messageInput.value = "";
            // 光标聚焦输入框
            messageInput.focus();

            if (msg.trim().length) {
                //发送给服务器端，群发给其他用户
                // that.socket.emit('postMsg',msg,color);
                that.socket.emit('postMsg', {
                    avatar: that.userinfo.avatar,
                    nickname: that.userinfo.nickname,
                    msg: msg,
                    color: color
                });

                //把自己的消息显示在自己的窗口上
                that._displayNewMsg({
                    nickname: '',
                    avatar: that.userinfo.avatar,
                    msg: msg,
                    color: color
                });
            }
        });
        // 发送消息的回车事件绑定
        that.messageInput.addEventListener('keyup', function(e) {
            if (e.keyCode === 13) {
                that.sendBtn.click();
            }
        })

        //发送图片
        document.getElementById('sendImage').addEventListener('change', function() {
            that._upLoadImg(this, function(data) {
                // 注意这里
                that.socket.emit('sendImg', {
                    avatar: that.userinfo.avatar,
                    nickname: that.userinfo.nickname,
                    imgData: data,
                    color: that.colorStyle
                });
                // that.socket.emit('sendImg',data,that.colorStyle);
                that._displayNewMsg({
                    nickname: "",
                    msg: data,
                    type: "img"
                });
            });
        });

        //展开表情包
        document.getElementById('emoji').addEventListener('click', function(e) {
            that.emojiWrapper.style.display = 'block';
            e.stopPropagation();
        });
        //点击页面其他地方关闭表情包
        document.body.addEventListener('click', function(e) {
            if (e.target !== that.emojiWrapper) {
                that.emojiWrapper.style.display = 'none';
            }
        });

        //具体选择某个表情
        that.emojiWrapper.addEventListener('click', function(e) {
            var target = e.target;

            if (target.nodeName.toLowerCase() === 'img') {
                var messageInput = that.messageInput;
                messageInput.focus();
                messageInput.value += ('[emoji:' + target.title + ']');
            }
        });

        // 清空聊天列表
        that.clearBtn.addEventListener('click', function() {
            that.historyMsg.innerHTML = "";
        });

        // 点击未读消息跳转到页面最底部
        that.msgTip.addEventListener('click', function() {
            that.historyMsg.parentNode.scrollTop = that.historyMsg.parentNode.scrollHeight;
            // 隐藏显示层
            this.style.display = "none";
        });
    },
    _upLoadImg: function(ele, fn) {
        var that = this;

        // 检查是否有文件被选中
        if (ele.files.length) {
            //获取到文件并用fileRender进行读取
            var file = ele.files[0],
                reader = new FileReader();

            if (!reader) {
                that._displayNewMsg({
                    user: '系统消息：',
                    msg: '你的浏览器不支持文件读取，请更换浏览器',
                    color: 'red'
                });
                ele.value = "";
                return;
            }

            // 读取图片完毕
            reader.onload = function(e) {
                    ele.value = "";
                    // 执行回调函数
                    fn && fn(e.target.result);
                }
                // 要读取的文件
            reader.readAsDataURL(file);
        }
    },
    _systemShow: function(config) {
        var type = config.type;

        var that = this;

        switch (type) {
            case 'login':
                //有人登陆
                that.users.push({
                    avatar: config.avatar,
                    nickname: config.nickname
                });
                break;
            case 'logout':
                //有人退出
                for (var i = 0; i < that.users.length; i++) {
                    if (that.users[i].nickname === config.nickname) {
                        that.users.splice(i, 1);
                        break;
                    }
                }
                break;
            default:
        }

        //显示在线人数
        that.status.innerHTML = "(" + that.users.length + "人在线)";

        //遍历渲染数据
        var docFragment = document.createDocumentFragment();
        that.users.forEach(function(v, i) {
            var li = document.createElement('li');
            html = "<img src='" + v.avatar + "' alt=''>" +
                "<p>" + v.nickname + "</p>";

            li.innerHTML = html;
            docFragment.appendChild(li);
        });
        //往容器里面添加
        // 由于遍历循环的是整个数组，所以为了防止内容的多余，先清空用户列表dom节点，在往里面插入
        that.userList.innerHTML = "";
        that.userList.appendChild(docFragment);
    },
    _displayNewMsg: function(config) {
        // 展示群聊的普通消息
        var that = this;

        var nickname = config.nickname,
            avatar = config.avatar || that.moAvatar,
            msg = config.msg,
            color = config.color || '#000',
            type = config.type || 'text';

        var contain = that.historyMsg,
            li = document.createElement('li'),
            time = new Date().toTimeString().substr(0, 8);

        //将消息中的表情转化成图片
        msg = this._showEmoji(msg);

        // 给li元素添加类来标识自己或者别人的
        (nickname ? li.className = "goLeft" : li.className = "goRight");

        var html = '<div class="avatarBox">' +
            '<img src="' + avatar + '" alt="" />' +
            '</div>' +
            '<p style="color:' + color + '">' +
            // 这里判断是图片还是文字
            (type === "text" ?
                ((nickname ? nickname + " : " : "") + '<span class="timespan">' + time + ' </span>' + msg) :
                ((nickname ? nickname + " : " : "") + '<span class="timespan">' + time + ' </span><br/><img src="' + msg + '" class="talkimg" /></a>')) +
            '</p>';

        li.innerHTML = html;
        contain.appendChild(li);

        // 聊天内容往上拱(如存在图片，需要等图片加载完成之后滚动到底部)
        var imgs = document.querySelectorAll('.talkimg');
        var far = contain.parentNode;
        if (imgs.length) {
            imgs[imgs.length - 1].onload = function() {
                far.scrollTop = far.scrollHeight;
            };
        }
        far.scrollTop = far.scrollHeight;
    },
    _initEmoji: function() {
        // 初始化表情包
        var docFragment = document.createDocumentFragment();

        for (var i = 69; i > 0; i--) {
            var img = document.createElement('img');
            img.src = '../content/emoji/' + i + ".gif";
            img.title = i;
            docFragment.appendChild(img);
        }

        this.emojiWrapper.appendChild(docFragment);
    },
    _showEmoji: function(msg) {
        // 将文字中的表情符号转化为图片
        var match,
            result = msg,
            reg = /\[emoji:\d+\]/g,
            emojiIndex,
            totalNum = this.emojiWrapper.children.length;

        while (match = reg.exec(msg)) {
            emojiIndex = match[0].slice(7, -1);
            if (emojiIndex > totalNum) {
                result = result.replace(match[0], '[X]');
            } else {
                result = result.replace(match[0], '<img class="emoji" src="../content/emoji/' + emojiIndex + '.gif" />');
            }
        }

        return result;
    },
    _newMessage: function() {
        var that = this;

        // 更新条数
        that.msgNum++;
        // 显示未读消息条数
        that.msgTip.innerHTML = that.msgNum;
        that.msgTip.style.display = "block";
    }
};
