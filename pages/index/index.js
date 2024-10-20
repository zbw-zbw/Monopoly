const defaultAvatarUrl =
  "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0";

Page({
  data: {
    isLogin: false,
    openid: "",
    userInfo: {
      avatarUrl: defaultAvatarUrl,
      nickName: "",
    },
    isModalVisible: false,
    roomId: "",
    players: [],
    playerSlots: [
      { avatarUrl: "", nickName: "" },
      { avatarUrl: "", nickName: "" },
      { avatarUrl: "", nickName: "" },
      { avatarUrl: "", nickName: "" },
    ],
  },

  // 在页面加载时
  onLoad(options) {
    this.initUserInfo();

    // 如果从邀请链接进入房间，获取roomId并加入房间
    if (options.roomId) {
      const roomId = +options.roomId;
      console.log(("房间id：", roomId));
      this.setData({
        roomId,
      });
      this.joinRoom(roomId);
      this.checkRoomStatus(roomId);
    }
  },

  // 在页面展示时
  onShow() {
    if (this.data.roomId) {
      this.checkRoomStatus(this.data.roomId);
    }
  },

  // 在页面卸载时
  onUnload() {
    // 清除定时器
    // clearInterval(this.checkRoomStatusInterval);
  },

  // 分享按钮
  onShareAppMessage() {
    const roomId = this.data.roomId;
    console.log("onShareAppMessage roomId:", roomId);

    return {
      title: "加入我的大富翁房间！", // 快来和我一起开心摸鱼吧！
      imageUrl: "https://s21.ax1x.com/2024/10/20/pAawfZd.webp",
      path: `/pages/index/index?roomId=${roomId}`,
    };
  },

  // 初始化用户信息
  initUserInfo() {
    const cacheUserInfo = wx.getStorageSync("userInfo");
    if (cacheUserInfo) {
      const userInfo = JSON.parse(cacheUserInfo);
      this.setData({
        userInfo,
      });
    } else {
      console.warn("未登录，无法获取用户头像和昵称");
    }
  },

  // 登录
  login() {
    wx.cloud.callFunction({
      name: "login",
      success: (res) => {
        wx.showToast({
          title: "登录成功",
          icon: "none",
        });
        const { openid } = res.result;
        console.log("登录成功，用户 openid:", openid);
        this.setData({ isLogin: true, openid });
        // 将用户信息存储到云数据库
        this.saveUserToDatabase(openid);
      },
      fail: (error) => {
        console.error("登录失败:", error);
      },
    });
  },

  // 保存用户信息到数据库
  saveUserToDatabase(openid) {
    const db = wx.cloud.database();
    db.collection("users")
      .where({
        _openid: openid,
      })
      .get({
        success: (res) => {
          if (res.data.length > 0) {
            console.warn("用户已存在:", res.data);
          } else {
            // 用户不存在，添加新用户
            db.collection("users").add({
              data: this.data.userInfo,
              success: (res) => {
                console.log("新用户已添加:", res);
              },
              fail: (error) => {
                console.error("添加用户失败:", error);
              },
            });
          }
        },
        fail: (error) => {
          console.error("查询用户失败:", error);
        },
      });
  },

  // 用户头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    const userInfo = {
      ...this.data.userInfo,
      avatarUrl,
    };
    this.setData({
      userInfo,
    });
    wx.setStorageSync("userInfo", JSON.stringify(userInfo));
  },

  // 用户昵称
  onChangeNickName(e) {
    let name = e.detail.value;
    if (name.length === 0) {
      wx.showToast({
        title: "昵称不能为空",
        icon: "error",
      });
    } else {
      const userInfo = {
        ...this.data.userInfo,
        nickName: name,
      };
      this.setData({
        userInfo,
      });
      wx.setStorageSync("userInfo", JSON.stringify(userInfo));
    }
  },

  // 开始游戏
  startGame() {
    if (this.data.isLogin) {
      if (this.data.userInfo.nickName) {
        this.createRoom();
      } else {
        wx.showToast({
          title: "请先设置头像和昵称",
          icon: "none",
        });
      }
    } else {
      wx.showToast({
        title: "请先登录",
        icon: "none",
      });
    }
  },

  // 创建房间
  createRoom() {
    wx.cloud.callFunction({
      name: "createRoom",
      data: {
        userInfo: this.data.userInfo,
      },
      success: (res) => {
        const { roomId, players } = res.result;
        this.setData({
          roomId,
          players,
          playerSlots: [
            {
              avatarUrl: this.data.userInfo.avatarUrl,
              nickName: this.data.userInfo.nickName,
            },
            { avatarUrl: "", nickName: "" },
            { avatarUrl: "", nickName: "" },
            { avatarUrl: "", nickName: "" },
          ],
        });
        console.log("房间已创建，ID:", roomId);
        this.showRoomModal();
      },
      fail: (error) => {
        console.error("房间创建失败:", error);
      },
    });
  },

  // 加入房间
  joinRoom(roomId) {
    wx.cloud.callFunction({
      name: "joinRoom",
      data: {
        roomId,
        userInfo: this.data.userInfo,
      },
      success: (res) => {
        if (res.result.success) {
          const players = res.result.players;
          this.setData({
            roomId,
            players,
          });
          this.updatePlayerSlots(players);
          this.showRoomModal();
          console.log("加入房间成功");
        } else {
          console.warn("加入房间失败:", res.result.message);
        }
      },
      fail: (error) => {
        console.error("加入房间失败:", error);
      },
    });
  },

  // 定期获取房间状态
  checkRoomStatus(roomId) {
    console.log("checkRoomStatus:", roomId);
    const db = wx.cloud.database();
    // const interval = setInterval(() => {
    db.collection("rooms")
      .where({ roomId })
      .get({
        success: (res) => {
          console.log("res", res);
          console.log("查询房间ID:", roomId);
          if (res.data.length > 0) {
            const players = res.data[0].players;
            console.log("房间玩家状态更新:", players);
            this.setData({ players });
            this.updatePlayerSlots(players);
          } else {
            // wx.showToast({
            //   title: "房间不存在!",
            //   icon: "none",
            // });
            // clearInterval(interval);
            console.warn("没有找到匹配的房间");
          }
        },
        fail: (error) => {
          console.error("获取房间状态失败:", error);
        },
      });
    // }, 3000); // 每3秒获取一次状态
  },

  // 打开房间弹窗
  showRoomModal() {
    this.setData({
      isModalVisible: true,
    });
  },

  // 关闭房间弹窗
  closeRoomModal() {
    this.setData({
      isModalVisible: false,
    });
  },

  // 更新房间玩家信息
  updatePlayerSlots(players) {
    const slots = this.data.playerSlots.map((_slot, index) => {
      return players[index] ? players[index] : { avatarUrl: "", nickName: "" };
    });
    this.setData({ playerSlots: slots });
  },

  // 开始匹配
  startMatch() {
    const playerCount = this.data.players.length;
    if (playerCount > 1) {
      wx.navigateTo({
        url: `/pages/game/game?roomId=${this.data.roomId}`,
      });
    } else {
      wx.showToast({
        title: "至少需要 2 位玩家才能开始游戏",
        icon: "none",
        duration: 2000,
      });
    }
  },
});
