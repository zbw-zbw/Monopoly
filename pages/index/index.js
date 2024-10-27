const defaultAvatarUrl =
  "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0";

Page({
  data: {
    isLogin: false,
    userInfo: {
      openId: "",
      avatarUrl: defaultAvatarUrl,
      nickName: "",
    },
    roomId: "",
    isModalVisible: false,
    host: {},
    players: [],
    playerSlots: Array(4).fill({
      avatarUrl: "",
      nickName: "",
    }),
    gameStatus: "NOT_START",
  },

  onLoad(options) {
    if (options.roomId) {
      this.setData({
        roomId: options.roomId,
      });
    }
    this.initialUserInfo();
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

    console.log("onShareAppMessage, roomId:", roomId);

    return {
      title: "快来和我一起开心摸鱼吧！",
      imageUrl: "https://s21.ax1x.com/2024/10/20/pAawfZd.webp",
      path: `/pages/index/index?roomId=${roomId}`,
    };
  },

  initialUserInfo() {
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
        const { openId } = res.result;
        console.log("login success:", res.result);
        this.updateUserInfo({
          openId,
        });
      },
      fail: (error) => {
        wx.showToast({
          title: "登录失败",
          icon: "none",
        });
        console.error("login fail:", error);
      },
    });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    const { userInfo } = this.data;
    const cloudPath = `avatars/${userInfo.openId}_${Date.now()}.png`;
    wx.cloud.uploadFile({
      cloudPath,
      filePath: avatarUrl,
      success: (res) => {
        wx.showToast({
          title: "头像已更新",
          icon: "none",
        });
        const { fileID } = res;
        this.updateUserInfo({
          avatarUrl: fileID,
        });
        console.log("uploadFile success:", fileID);
      },
      fail: (err) => {
        wx.showToast({
          title: "头像上传失败",
          icon: "none",
        });
        console.error("uploadFile fail:", err);
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
        title: "昵称已更新",
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
        if (res.result.success) {
          console.log("updateUserInfo success:", res.result);
        } else {
          console.error("updateUserInfo error:", res.result);
        }
      },
      fail: (error) => {
        console.error("updateUserInfo fail:", error);
      },
    });
  },

  startGame() {
    const { userInfo, roomId } = this.data;
    if (userInfo.avatarUrl === defaultAvatarUrl) {
      wx.showToast({
        title: "请先设置头像",
        icon: "none",
      });
    } else if (!userInfo.nickName) {
      wx.showToast({
        title: "请先设置昵称",
        icon: "none",
      });
    } else if (roomId) {
      this.joinRoom(roomId);
    } else {
      this.createRoom();
    }
  },

  createRoom() {
    const { userInfo } = this.data;
    wx.cloud.callFunction({
      name: "createRoom",
      data: {
        user: userInfo,
      },
      success: (res) => {
        const { success, data } = res.result;
        if (success) {
          wx.showToast({
            title: "创建房间成功",
            icon: "none",
          });
          this.watchRoom(data.roomId);
          console.log("createRoom success:", res.result);
        } else {
          wx.showToast({
            title: "创建房间失败",
            icon: "none",
          });
          console.error("createRoom error:", res.result);
        }
      },
      fail: (error) => {
        console.error("createRoom fail:", error);
      },
    });
  },

  joinRoom(roomId) {
    const { userInfo } = this.data;
    wx.cloud.callFunction({
      name: "joinRoom",
      data: {
        roomId,
        user: userInfo,
      },
      success: (res) => {
        const { success, message } = res.result;
        if (success) {
          wx.showToast({
            title: message || "加入房间成功",
            icon: "none",
          });
          this.watchRoom(roomId);
          console.log("joinRoom success:", res.result);
        } else {
          wx.showToast({
            title: message || "加入房间失败",
            icon: "none",
          });
          console.error("joinRoom error:", message);
        }
      },
      fail: (error) => {
        wx.showToast({
          title: "加入房间失败",
          icon: "none",
        });
        console.error("joinRoom fail:", error);
      },
    });
  },

  watchRoom(roomId) {
    const db = wx.cloud.database();
    this.watcher = db
      .collection("rooms")
      .where({
        roomId,
      })
      .watch({
        onChange: (snapshot) => {
          if (snapshot.docs.length > 0) {
            console.log("watchRoom update:", snapshot.docs[0]);
            const { roomId, host, players, gameStatus } = snapshot.docs[0];
            const playerSlots = this.updatePlayerSlots(players);
            this.setData({
              roomId,
              host,
              players,
              playerSlots,
            });

            if (gameStatus === "IN_PROGRESS") {
              this.openGamePage(roomId);
            } else {
              this.showRoomModal();
            }
          }
        },
        onError: (error) => {
          console.error("watchRoom error:", error);
        },
      });
  },

  showRoomModal() {
    this.setData({
      isModalVisible: true,
    });
  },

  closeRoomModal() {
    this.setData({
      isModalVisible: false,
    });
  },

  updatePlayerSlots(players) {
    const { playerSlots } = this.data;
    return playerSlots.map(
      (_playerSlot, index) => players[index] || { avatarUrl: "", nickName: "" }
    );
  },

  enterGame() {
    const { host, userInfo, players } = this.data;
    const isHost = host.openId === userInfo.openId;

    if (isHost && players.length > 1) {
      this.initializeGame();
    } else if (!isHost) {
      wx.showToast({
        title: "只有房主可以开始游戏",
        icon: "none",
      });
    } else {
      wx.showToast({
        title: "至少需要 2 位玩家才能开始游戏",
        icon: "none",
      });
    }
  },

  initializeGame() {
    const { roomId, players } = this.data;
    wx.cloud.callFunction({
      name: "initializeGame",
      data: {
        roomId,
        players,
      },
      success: (res) => {
        if (res.result.success) {
          console.log("initializeGame success:", res.result);
        } else {
          wx.showToast({
            title: "游戏加载失败",
            icon: "none",
          });
          console.error("initializeGame error:", res.result);
        }
      },
      fail: (error) => {
        wx.showToast({
          title: "游戏加载失败",
          icon: "none",
        });
        console.error("initializeGame fail:", error);
      },
    });
  },

  openGamePage(roomId) {
    wx.navigateTo({
      url: `/pages/game/game?roomId=${roomId}`,
    });
    if (this.watcher) {
      this.watcher.close();
    }
  },
});
