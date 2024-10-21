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
    playerSlots: Array(4).fill({ avatarUrl: "", nickName: "" }),
    watcher: null,
  },

  onLoad(options) {
    this.initUserInfo();

    if (options.roomId) {
      this.setData({ roomId: options.roomId });
      this.joinRoom(options.roomId);
    }
  },

  onShow() {},

  onUnload() {
    if (this.data.watcher) {
      this.data.watcher.close();
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
      title: "加入我的大富翁房间！", // 快来和我一起开心摸鱼吧！
      imageUrl: "https://s21.ax1x.com/2024/10/20/pAawfZd.webp",
      path: `/pages/index/index?roomId=${roomId}`,
    };
  },

  initUserInfo() {
    const cacheUserInfo = wx.getStorageSync("userInfo");
    if (cacheUserInfo) {
      this.setData({ userInfo: JSON.parse(cacheUserInfo) });
    }
  },

  login() {
    wx.cloud.callFunction({
      name: "login",
      success: (res) => {
        const { openid } = res.result;
        this.setData({ isLogin: true, openid });
        this.updateUserInDatabase(openid);
      },
      fail: (error) => {
        console.error("登录失败:", error);
      },
    });
  },

  updateUserInDatabase(openid) {
    const db = wx.cloud.database();
    const { userInfo } = this.data;
    db.collection("users")
      .where({ _openid: openid })
      .get({
        success: (res) => {
          if (res.data.length > 0) {
            console.warn("用户已存在:", res.data);
          } else {
            db.collection("users").add({ data: userInfo });
          }
        },
        fail: (error) => {
          console.error("查询用户失败:", error);
        },
      });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.updateUserInfo({ avatarUrl });
  },

  onChangeNickName(e) {
    const name = e.detail.value;
    if (name) {
      this.updateUserInfo({ nickName: name });
    } else {
      wx.showToast({ title: "昵称不能为空", icon: "none" });
    }
  },

  updateUserInfo(updates) {
    const userInfo = { ...this.data.userInfo, ...updates };
    this.setData({ userInfo });
    wx.setStorageSync("userInfo", JSON.stringify(userInfo));
  },

  startGame() {
    if (this.data.isLogin && this.data.userInfo.nickName) {
      this.createRoom();
    } else {
      wx.showToast({ title: "请先登录并设置昵称", icon: "none" });
    }
  },

  createRoom() {
    wx.cloud.callFunction({
      name: "createRoom",
      data: { userInfo: this.data.userInfo },
      success: (res) => {
        const { roomId, players } = res.result;
        this.setData({ roomId, players });
        this.updatePlayerSlots(players);
        this.showRoomModal();

        wx.showToast({
          title: "创建房间成功",
          icon: "none",
        });

        // 设置实时监听
        this.listenToRoomUpdates(roomId);
        console.log("创建房间成功");
      },
      fail: (error) => {
        console.error("创建房间失败:", error);
      },
    });
  },

  joinRoom(roomId) {
    wx.cloud.callFunction({
      name: "joinRoom",
      data: { roomId, userInfo: this.data.userInfo },
      success: (res) => {
        if (res.result.success) {
          const players = res.result.players;
          this.setData({ roomId, players });
          this.updatePlayerSlots(players);
          this.showRoomModal();

          wx.showToast({
            title: "加入房间成功",
            icon: "none",
          });

          // 设置实时监听
          this.listenToRoomUpdates(roomId);
          console.log("加入房间成功");
        } else {
          wx.showToast({
            title: res.result.message || "加入房间失败",
            icon: "none",
          });
        }
      },
      fail: (error) => {
        console.error("加入房间失败:", error);
      },
    });
  },

  // 设置实时监听
  listenToRoomUpdates(roomId) {
    const db = wx.cloud.database();
    const watcher = db
      .collection("rooms")
      .where({ roomId })
      .watch({
        onChange: function (snapshot) {
          console.log("snapshot", snapshot);
          if (snapshot.docChanges.length > 0) {
            const updatedRoom = snapshot.docs[0];
            if (updatedRoom && updatedRoom.data) {
              const updatedPlayers = updatedRoom.data.players;
              this.setData({
                players: updatedPlayers,
              });
              this.updatePlayerSlots(updatedPlayers);
            }
          }
        },
        onError: (error) => {
          console.error("the watch closed because of error", error);
        },
      });

    this.setData({ watcher });
  },

  showRoomModal() {
    this.setData({ isModalVisible: true });
  },

  closeRoomModal() {
    this.setData({ isModalVisible: false });
  },

  updatePlayerSlots(players) {
    const slots = this.data.playerSlots.map((_slot, index) => {
      return players[index] || { avatarUrl: "", nickName: "" };
    });
    this.setData({ playerSlots: slots });
  },

  startMatch() {
    if (this.data.players.length > 1) {
      wx.navigateTo({ url: `/pages/game/game?roomId=${this.data.roomId}` });
    } else {
      wx.showToast({ title: "至少需要 2 位玩家才能开始游戏", icon: "none" });
    }
  },
});
