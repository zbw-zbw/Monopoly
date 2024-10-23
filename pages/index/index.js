const defaultAvatarUrl =
  "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0";

Page({
  data: {
    isLogin: false,
    userInfo: {
      openid: "",
      avatarUrl: defaultAvatarUrl,
      nickName: "",
    },
    roomId: "",
    isModalVisible: false,
    players: [],
    playerSlots: Array(4).fill({ avatarUrl: "", nickName: "" }),
  },

  onLoad(options) {
    // FIXME: 本地调试代码
    wx.navigateTo({
      url: `/pages/game/game?roomId=内测玩家专属房间`,
    });
    return;

    this.initUserInfo();

    if (options.roomId) {
      this.setData({
        roomId: options.roomId,
      });
      this.joinRoom(options.roomId);
    }
  },

  onUnload() {
    if (this.watcher) {
      this.watcher.close();
    }
  },

  onShareAppMessage() {
    const { roomId } = this.data;
    if (!roomId) {
      wx.showToast({
        title: "房间无效，无法分享。",
        icon: "none",
      });
      return;
    }

    console.log("onShareAppMessage roomId:", roomId);

    return {
      title: "快来和我一起开心摸鱼吧！",
      imageUrl: "https://s21.ax1x.com/2024/10/20/pAawfZd.webp",
      path: `/pages/index/index?roomId=${roomId}`,
    };
  },

  initUserInfo() {
    const cacheUserInfo = wx.getStorageSync("userInfo");
    if (cacheUserInfo) {
      this.setData({
        isLogin: true,
        userInfo: JSON.parse(cacheUserInfo),
      });
    } else {
      this.login();
    }
  },

  login() {
    wx.cloud.callFunction({
      name: "login",
      success: (res) => {
        wx.showToast({
          title: "登录成功",
          icon: "none",
        });
        const { openid } = res.result;
        this.updateUserInfo({ openid });
      },
      fail: (error) => {
        console.error("登录失败:", error);
      },
    });
  },

  updateUserInDatabase(data) {
    const db = wx.cloud.database();
    db.collection("users")
      .where({
        _openid: data.openid,
      })
      .get({
        success: (res) => {
          if (res.data.length > 0) {
            db.collection("users").doc(res.data[0]._id).update({ data });
            console.log("更新用户信息:", data);
          } else {
            db.collection("users").add({ data });
            console.log("添加新用户:", data);
          }
        },
        fail: (error) => {
          console.error("查询用户失败:", error);
        },
      });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.updateUserInfo({
      avatarUrl,
    });
  },

  onChangeNickName(e) {
    const nickName = e.detail.value;
    if (nickName) {
      this.updateUserInfo({
        nickName,
      });
    } else {
      wx.showToast({
        title: "昵称不能为空",
        icon: "none",
      });
    }
  },

  updateUserInfo(updates) {
    const userInfo = {
      ...this.data.userInfo,
      ...updates,
    };
    this.setData({
      isLogin: true,
      userInfo,
    });
    wx.setStorageSync("userInfo", JSON.stringify(userInfo));
    this.updateUserInDatabase(userInfo);
  },

  startGame() {
    if (this.data.userInfo.nickName) {
      this.createRoom();
    } else {
      wx.showToast({
        title: "请先设置昵称和头像",
        icon: "none",
      });
    }
  },

  createRoom() {
    wx.cloud.callFunction({
      name: "createRoom",
      data: {
        userInfo: this.data.userInfo,
      },
      success: (res) => {
        wx.showToast({
          title: "创建房间成功",
          icon: "none",
        });
        const { roomId, players } = res.result;
        const playerSlots = this.updatePlayerSlots(players);
        this.setData({
          roomId,
          players,
          playerSlots,
        });
        this.showRoomModal();
        this.watchRoom(roomId);
      },
      fail: (error) => {
        console.error("创建房间失败:", error);
      },
    });
  },

  joinRoom(roomId) {
    wx.cloud.callFunction({
      name: "joinRoom",
      data: {
        roomId,
        userInfo: this.data.userInfo,
      },
      success: (res) => {
        const { success, message, players } = res.result;
        if (success) {
          wx.showToast({
            title: message || "加入房间成功",
            icon: "none",
          });
          const playerSlots = this.updatePlayerSlots(players);
          this.setData({
            roomId,
            players,
            playerSlots,
          });
          this.showRoomModal();
          this.watchRoom(roomId);
        } else {
          wx.showToast({
            title: message || "加入房间失败",
            icon: "none",
          });
          console.error("加入房间失败:", message);
        }
      },
      fail: (error) => {
        wx.showToast({
          title: "加入房间失败",
          icon: "none",
        });
        console.error("加入房间失败:", error);
      },
    });
  },

  watchRoom(roomId) {
    const db = wx.cloud.database();
    this.watcher = db
      .collection("rooms")
      .where({ roomId })
      .watch({
        onChange: (snapshot) => {
          console.log("~ watchRoom ~ snapshot", snapshot);
          if (snapshot.docs.length > 0) {
            const players = snapshot.docs[0].players;
            const playerSlots = this.updatePlayerSlots(players);
            this.setData({
              players,
              playerSlots,
            });
          }
        },
        onError: (error) => {
          console.error("the watch closed because of error:", error);
        },
      });
  },

  showRoomModal() {
    this.setData({ isModalVisible: true });
  },

  closeRoomModal() {
    this.setData({ isModalVisible: false });
  },

  updatePlayerSlots(players) {
    return this.data.playerSlots.map(
      (_playerSlot, index) => players[index] || { avatarUrl: "", nickName: "" }
    );
  },

  enterGame() {
    const { players, roomId } = this.data;

    // FIXME: 本地调试代码
    this.initializeGame(roomId, players);
    return;

    if (players.length > 1) {
      this.initializeGame();
    } else {
      wx.showToast({
        title: "至少需要 2 位玩家才能开始游戏",
        icon: "none",
      });
    }
  },

  initializeGame() {
    const { players, roomId } = this.data;
    wx.cloud.callFunction({
      name: "initializeGame",
      data: {
        roomId,
        players,
      },
      success: (res) => {
        if (res.result.success) {
          wx.navigateTo({
            url: `/pages/game/game?roomId=${roomId}`,
          });
        } else {
          wx.showToast({
            title: "初始化游戏失败，请稍后再试",
          });
          console.error("初始化游戏失败:", res.result);
        }
      },
      fail: (error) => {
        wx.showToast({
          title: "初始化游戏失败，请稍后再试",
        });
        console.error("初始化游戏失败:", error);
      },
    });
  },
});
