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
    if (options.roomId) {
      this.setData({
        roomId: options.roomId,
      });
    }
    this.initUserInfo();
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

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    const { userInfo } = this.data;
    const cloudPath = `avatars/${userInfo.openid}_${Date.now()}.png`;
    wx.cloud.uploadFile({
      cloudPath,
      filePath: avatarUrl,
      success: (res) => {
        const { fileID } = res;
        this.updateUserInfo({
          avatarUrl: fileID,
        });
        wx.showToast({
          title: "头像上传成功",
          icon: "none",
        });
      },
      fail: (err) => {
        console.error("头像上传失败:", err);
        wx.showToast({
          title: "头像上传失败",
          icon: "none",
        });
      },
    });
  },

  onChangeNickName(e) {
    const nickName = e.detail.value;
    const { userInfo } = this.data;
    if (nickName === userInfo.nickName) return;

    if (nickName) {
      this.updateUserInfo({
        nickName,
      });
      wx.showToast({
        title: "昵称修改成功",
        icon: "none",
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
    wx.cloud.callFunction({
      name: "updateUser",
      data: userInfo,
      success: (res) => {
        console.log("更新用户信息成功:", res.result);
      },
      fail: (error) => {
        console.error("更新用户信息失败:", error);
      },
    });
  },

  startGame() {
    const { userInfo, roomId } = this.data;
    if (userInfo.avatarUrl === defaultAvatarUrl) {
      wx.showToast({
        title: "请设置头像",
        icon: "none",
      });
    } else if (!userInfo.nickName) {
      wx.showToast({
        title: "请设置昵称",
        icon: "none",
      });
    } else if (roomId) {
      this.joinRoom(roomId);
    } else {
      this.createRoom();
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
    console.log("userInfo", this.data.userInfo);
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
    const { players } = this.data;
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
            title: "初始化游戏失败",
          });
          console.error("初始化游戏失败:", res.result);
        }
      },
      fail: (error) => {
        wx.showToast({
          title: "初始化游戏失败",
        });
        console.error("初始化游戏失败:", error);
      },
    });
  },
});
