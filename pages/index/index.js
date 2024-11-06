// 最大玩家数量
const MAX_PLAYER_COUNT = 4;

// 提示信息
const toastQueue = [];
const TOAST_DURATION_MS_MS = 1000;
const SHOW_NEXT_TOAST_DELAY_MS = 500;

// 展示当前提示信息
const showToast = (message) => {
  toastQueue.push(message);
  if (toastQueue.length === 1) {
    showNextToast();
  }
};

// 展示下一个提示信息
const showNextToast = () => {
  if (toastQueue.length === 0) return;
  const message = toastQueue[0];
  wx.showToast({
    title: message,
    icon: "none",
    duration: TOAST_DURATION_MS,
    success: () => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        toastQueue.shift();
        showNextToast();
      }, TOAST_DURATION_MS + SHOW_NEXT_TOAST_DELAY_MS);
    },
  });
};

let canWatchRoom = false;

Page({
  data: {
    isLogin: false,
    userInfo: {
      openId: "",
      avatarUrl: "",
      nickName: "",
    },
    roomId: "",
    isModalVisible: false,
    host: {},
    players: [],
    playerSlots: Array(MAX_PLAYER_COUNT).fill({
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

  onShow() {
    // if (canWatchRoom && this.data.roomId) {
    //   this.clearWatcher();
    //   console.log("watch");
    //   this.watchRoom(this.data.roomId);
    // }
  },

  onHide() {
    // this.clearWatcher();
  },

  onUnload() {
    this.clearWatcher();
  },

  onShareAppMessage() {
    const { roomId } = this.data;
    if (!roomId) {
      showToast("房间无效，无法分享！");
      return;
    }
    return {
      title: "快来和我一起开心摸鱼吧！",
      imageUrl: "https://s21.ax1x.com/2024/10/20/pAawfZd.webp",
      path: `/pages/index/index?roomId=${roomId}`,
    };
  },

  clearWatcher() {
    if (this.watcher) {
      this.watcher.close();
    }
  },

  // 初始化用户信息
  initialUserInfo() {
    const cacheUserInfo = wx.getStorageSync("userInfo");
    if (cacheUserInfo) {
      this.setData({
        isLogin: true,
        userInfo: JSON.parse(cacheUserInfo),
      });
      const { roomId } = this.data;
      roomId && this.joinRoom(roomId);
    } else {
      this.login();
    }
  },

  // 用户登录
  login() {
    wx.cloud.callFunction({
      name: "login",
      success: (res) => {
        showToast("登录成功！");
        const { openId } = res.result;
        console.log("login success:", res.result);
        this.updateUserInfo({
          openId,
        });
      },
      fail: (error) => {
        showToast("登录失败！");
        console.error("login fail:", error);
      },
    });
  },

  // 用户修改头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    const { userInfo } = this.data;
    const cloudPath = `avatars/${userInfo.openId}_${Date.now()}.png`;
    wx.cloud.uploadFile({
      cloudPath,
      filePath: avatarUrl,
      success: (res) => {
        showToast("头像已更新！");
        const { fileID } = res;
        this.updateUserInfo({
          avatarUrl: fileID,
        });
        console.log("uploadFile success:", fileID);
      },
      fail: (err) => {
        showToast("头像上传失败！");
        console.error("uploadFile fail:", err);
      },
    });
  },

  // 用户修改昵称
  onChangeNickName(e) {
    const nickName = e.detail.value;
    const { userInfo } = this.data;
    if (nickName === userInfo.nickName) return;
    if (nickName) {
      this.updateUserInfo({
        nickName,
      });
      showToast("昵称已更新！");
    } else {
      showToast("昵称不能为空！");
    }
  },

  // 更新用户信息
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

  // 开始游戏（创建/加入房间）
  startGame() {
    const { userInfo, roomId } = this.data;
    if (!userInfo.avatarUrl) {
      showToast("请先设置头像！");
    } else if (!userInfo.nickName) {
      showToast("请先设置昵称！");
    } else if (roomId) {
      this.joinRoom(roomId);
    } else {
      this.createRoom();
    }
  },

  // 创建房间
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
          showToast("创建房间成功！");
          this.showRoomModal();
          this.watchRoom(data.roomId);
          console.log("createRoom success:", res.result);
        } else {
          showToast("创建房间失败！");
          console.error("createRoom error:", res.result);
        }
      },
      fail: (error) => {
        console.error("createRoom fail:", error);
      },
    });
  },

  // 加入房间
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
          showToast(message || "加入房间成功！");
          this.showRoomModal();
          this.watchRoom(roomId);
          console.log("joinRoom success:", res.result);
        } else {
          showToast(message || "加入房间失败！");
          console.error("joinRoom error:", message);
        }
      },
      fail: (error) => {
        showToast("加入房间失败！");
        console.error("joinRoom fail:", error);
      },
    });
  },

  // 实时监听房间信息变化
  watchRoom(roomId) {
    canWatchRoom = true;
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
            }
          }
        },
        onError: (error) => {
          console.error("watchRoom error:", error);
        },
      });
  },

  // 展示房间弹窗
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

  // 更新玩家座位信息
  updatePlayerSlots(players) {
    const { playerSlots } = this.data;
    return playerSlots.map(
      (_playerSlot, index) => players[index] || {
        avatarUrl: "", nickName: ""
      }
    );
  },

  // 开始游戏
  enterGame() {
    const { host, userInfo, players } = this.data;
    const isHost = host.openId === userInfo.openId;

    if (isHost && players.length > 1) {
      this.initializeGame();
    } else if (!isHost) {
      showToast("请联系房主开始游戏！");
    } else {
      showToast("至少需要2位玩家！");
    }
  },

  // 初始化游戏
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
          showToast("游戏加载失败！");
          console.error("initializeGame error:", res.result);
        }
      },
      fail: (error) => {
        showToast("游戏加载失败！");
        console.error("initializeGame fail:", error);
      },
    });
  },

  // 进入游戏页
  openGamePage(roomId) {
    this.clearWatcher();
    wx.navigateTo({
      url: `/pages/game/game?roomId=${roomId}`,
    });
  },
});
