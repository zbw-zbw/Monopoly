// 提示信息
let toastQueue = [];
const MAX_TOAST_COUNT = 3;
const TOAST_DURATION_MS = 1000;
const SHOW_NEXT_TOAST_DELAY_MS = 500;
// 玩家回合倒计时更新间隔
const START_TURN_COUNT_DOWN_MS = 1000;
// 玩家移动一格的动画时间
const PLAYER_MOVE_DURATION_MS = 500;
// 一秒的毫秒数
const ONE_SECOND_MS = 1000;

// 展示当前提示信息
const showToast = (message) => {
  if (toastQueue.length >= MAX_TOAST_COUNT) {
    toastQueue.shift();
  }
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

// 清空提示信息队列
const clearToastQueue = () => {
  toastQueue = [];
};

// 格式化时间（不足两位补0）
const formatTime = (time) => {
  return time < 10 ? "0" + time : time.toString();
};

// 玩家回合时间（秒）
const initCountdown = formatTime(15);

let canWatchRoom = false;

Page({
  data: {
    roomId: null,
    userInfo: {},
    isInited: false,
    players: [],
    myPlayerData: {},
    board: [],
    currentRound: 1,
    currentPlayerIndex: -1,
    canRollDice: false,
    isRollingDice: false,
    diceImg: "/assets/dice-1.png",
    diceResult: 0,
    gameStatus: "IN_PROGRESS",
    chanceEvents: [
      {
        type: "reward",
        amount: 500,
        message: `中了彩票，获得500元！`,
      },
      {
        type: "penalty",
        amount: 500,
        message: `随地扔垃圾，罚款500元！`,
      },
      {
        type: "item",
        item: "双倍卡",
        message: "运气爆棚，捡到了双倍卡！",
      },
      {
        type: "item",
        item: "控制骰子",
        message: "运气爆棚，捡到了控制骰子！",
      },
      {
        type: "item",
        item: "防护罩",
        message: "运气爆棚，捡到了防护罩！",
      },
      {
        type: "skip",
        message: "掉进了陷阱，跳过下一轮行动！",
      },
    ],
    trapEvents: [
      {
        type: "penalty",
        amount: 500,
        message: `随地大小便，罚款500元！`,
      },
      {
        type: "skip",
        message: "踩到香蕉皮，跳过下一轮行动！",
      },
    ],
    items: [
      {
        name: "双倍卡",
        price: 300,
      },
      {
        name: "防护罩",
        price: 400,
      },
      {
        name: "控制骰子",
        price: 500,
      },
    ],
    countdown: initCountdown,
  },

  onLoad(options) {
    const roomId = options.roomId;
    if (roomId) {
      this.initialData(roomId);
      this.initialRoomData(roomId);
    } else {
      showToast("游戏异常，请退出重试！");
      // this.resetGame();
    }
  },

  onShow() {
    // if (canWatchRoom && this.data.roomId) {
    //   this.clearWatcher();
    //   this.watchRoomData(this.data.roomId);
    // }
  },

  onHide() {
    // this.clearWatcher();
  },

  onUnload() {
    clearToastQueue();
    this.clearWatcher();
    this.clearTurnCountdown();
  },

  clearWatcher() {
    if (this.watcher) {
      this.watcher.close();
    }
  },

  // 初始化房间ID和用户数据
  initialData(roomId) {
    const userInfo = JSON.parse(wx.getStorageSync("userInfo"));
    this.setData({
      roomId,
      userInfo,
    });
  },

  // 初始化房间数据
  initialRoomData(roomId) {
    wx.cloud.callFunction({
      name: "getRoomData",
      data: {
        roomId,
      },
      success: (res) => {
        const { success, data } = res.result;
        if (success) {
          console.log("initialRoomData success:", data);
          this.watchRoomData(roomId);
        }
      },
      fail: (error) => {
        console.error("initialRoomData fail:", error);
      },
    });
  },

  // 更新房间数据
  updateRoomData(data) {
    const { roomId, currentRound, currentPlayerIndex, players } = this.data;
    const roomData = {
      currentPlayerIndex,
      players: data.players || players,
      currentRound,
      ...data,
    };

    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: "updateRoomData",
        data: {
          roomId,
          roomData,
        },
        success: (res) => {
          if (res.result.success) {
            resolve(res.result);
            console.log("updateRoomData success:", res.result);
          } else {
            reject(new Error("updateRoomData error"));
            console.error("updateRoomData error:", res.result);
          }
        },
        fail: (error) => {
          reject(error);
          console.error("updateRoomData fail:", error);
        },
      });
    });
  },

  // 实时监听房间数据变化
  watchRoomData(roomId) {
    canWatchRoom = true;
    const db = wx.cloud.database();
    this.watcher = db
      .collection("rooms")
      .where({
        roomId,
      })
      .watch({
        onChange: (snapshot) => {
          if (snapshot.docs.length) {
            const roomData = snapshot.docs[0];
            console.log("watchRoomData update:", roomData);
            this.handleRoomDataUpdate(roomData);
          }
        },
        onError: (error) => {
          console.error("watchRoomData error:", error);
        },
      });
  },

  // 处理房间数据更新
  handleRoomDataUpdate(roomData) {
    const { userInfo } = this.data;
    const { players, currentPlayerIndex, message } = roomData;
    const currentPlayer = players[currentPlayerIndex];
    const isMyTurn = currentPlayer.openId === userInfo.openId;
    const myPlayerData = players.find(
      (player) => player.openId === userInfo.openId
    );
    roomData.isMyTurn = isMyTurn;
    roomData.myPlayerData = myPlayerData;
    const isInitializing = !this.lastRoomData;
    if (isInitializing) {
      this.onChangeCurrentPlayerIndex(roomData);
      this.onOtherPlayerRollingDice(roomData);
      this.checkGameStatus(roomData);
      this.setData({
        isInited: true,
      });
    } else {
      const {
        currentPlayerIndex,
        gameStatus,
        isRollingDice,
        message,
      } = roomData;
      const {
        currentPlayerIndex: lastCurrentPlayerIndex,
        gameStatus: lastGameStatus,
        isRollingDice: lastIsRollingDice,
        message: lastMessage,
      } = this.lastRoomData;
      // 判断是否有其他玩家的提示信息需要显示
      if (message !== lastMessage) {
        this.showOtherPlayerMessage(roomData);
      }
      // 判断当前玩家索引是否发生变化
      if (roomData.isUpdateCurrentIndex) {
        this.onChangeCurrentPlayerIndex(roomData);
      }
      // 判断其他玩家是否正在摇骰子（如果是则播放摇骰子动画）
      if (isRollingDice !== lastIsRollingDice && isRollingDice) {
        this.onOtherPlayerRollingDice(roomData);
      }
      // 判断游戏状态是否发生变化
      if (gameStatus !== lastGameStatus) {
        this.checkGameStatus(roomData);
      }
    }
    this.lastRoomData = roomData;
    this.setData({
      ...roomData,
    });
  },

  // 摇骰子
  rollDice() {
    const { canRollDice, isMyTurn } = this.data;
    if (!canRollDice) {
      !isMyTurn && showToast("别着急，还没轮到你呢！");
      return;
    }
    this.clearTurnCountdown();
    this.playDiceAnimation();
  },

  // 播放摇骰子动画
  async playDiceAnimation(result) {
    this.setData({
      canRollDice: false,
      diceImg: "/assets/roll-dice.gif",
    });

    let isMyTurn = true;
    let diceResult = result;
    if (result) {
      isMyTurn = false;
    } else {
      const { myPlayerData } = this.data;
      if (myPlayerData.controlDiceValue) {
        diceResult = myPlayerData.controlDiceValue;
        myPlayerData.controlDiceValue = 0;
      } else {
        diceResult = Math.floor(Math.random() * 6) + 1;
      }
      await this.updateRoomData({
        isRollingDice: true,
        isUpdateCurrentIndex: false,
        diceResult,
        players: this.updatePlayers(myPlayerData),
      });
    }
    const rollDiceTimer = setTimeout(async () => {
      clearTimeout(rollDiceTimer);
      const diceImg = `/assets/dice-${diceResult}.png`;
      this.setData({
        isRollingDice: false,
        diceResult,
        diceImg,
      });
      // 通知后再移动 避免其他玩家接收到的位置有误
      await this.updateRoomData({
        isRollingDice: false,
        isUpdateCurrentIndex: false,
      });
      this.movePlayer(diceResult, isMyTurn);
    }, 1000);
  },

  // 移动玩家
  movePlayer(diceResult, isMyTurn) {
    const { currentPlayerIndex, players, board } = this.data;
    const player = players[currentPlayerIndex];
    const startPosition = player.position;
    const targetPosition = (startPosition + diceResult) % board.length;
    this.animatePlayerMovement(startPosition, targetPosition, isMyTurn);
  },

  // 玩家移动动画
  animatePlayerMovement(start, target, isMyTurn) {
    const { players, board, currentPlayerIndex } = this.data;
    const player = players[currentPlayerIndex];
    if (start === target) {
      isMyTurn && this.handleTileEvent(player, board[player.position]);
      return;
    }
    const nextPosition = (start + 1) % board.length;
    player.position = nextPosition;
    const animation = wx.createAnimation({
      duration: PLAYER_MOVE_DURATION_MS,
      timingFunction: "ONE_SECOND_MS",
    });
    animation
      .left(board[nextPosition].x + "px")
      .top(board[nextPosition].y + "px");
    this.setData({
      players: this.updatePlayers(player),
      playerAnimation: animation.export(),
    });
    setTimeout(() => {
      this.animatePlayerMovement(nextPosition, target, isMyTurn);
    }, PLAYER_MOVE_DURATION_MS);
  },

  // 处理玩家到达的格子事件
  handleTileEvent(player, tile) {
    const { chanceEvents, trapEvents } = this.data;
    switch (tile.type) {
      case "start":
        this.handleStartEvent(player, tile);
        break;
      case "shop":
        this.handleShopEvent(player);
        break;
      case "chance":
        this.handleChanceEvent(player, chanceEvents);
        break;
      case "trap":
        this.handleTrapEvent(player, trapEvents);
        break;
      case "property":
        this.handlePropertyEvent(player, tile);
        break;
      default:
        break;
    }
  },

  // 处理玩家经过起点事件
  async handleStartEvent(player, tile) {
    const price = this.checkDoubleCardActive(player, tile.price);
    const message = `${player.nickName}经过了起点，获得${price}元补贴`;
    await this.updateRoomData({
      players: this.updatePlayers(player),
      isUpdateCurrentIndex: true,
      message,
    });
  },

  // 处理玩家经过商品事件
  handleShopEvent(player) {
    const { items } = this.data;
    const itemList = items.map(({ name, price }) => `购买${name}（${price}元)`);
    let message = "";
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const { tapIndex } = res;
        const { name, price } = items[tapIndex];
        if (player.money >= price) {
          this.addItem(player, name);
          player.money -= price;
          message = `${player.nickName}购买了${name}`;
        } else {
          showToast("资产不足！");
        }
      },
      fail: (error) => {
        console.warn("购买失败:", error);
      },
      complete: async () => {
        await this.updateRoomData({
          players: this.updatePlayers(player),
          isUpdateCurrentIndex: true,
          message,
        });
      },
    });
  },

  // 处理玩家经过机会事件
  async handleChanceEvent(player, chanceEvents) {
    const event = chanceEvents[Math.floor(Math.random() * chanceEvents.length)];
    let message = `${player.nickName}${event.message}`;
    switch (event.type) {
      case "reward":
        const price = this.checkDoubleCardActive(player, event.amount);
        message = `${player.nickName}${event.message.replace(/(\d+)/g, price)}`;
        break;
      case "penalty":
        const shieldActiveMessage = this.checkShieldActive(player);
        if (shieldActiveMessage) {
          message = shieldActiveMessage;
        } else {
          player.money -= event.amount;
        }
        break;
      case "item":
        this.addItem(player, event.item);
        break;
      case "skip":
        player.skipNextTurn = true;
        break;
    }
    await this.updateRoomData({
      players: this.updatePlayers(player),
      isUpdateCurrentIndex: true,
      message,
    });
  },

  // 处理玩家经过陷阱事件
  async handleTrapEvent(player, trapEvents) {
    const event = trapEvents[Math.floor(Math.random() * trapEvents.length)];
    let message = `${player.nickName}${event.message}`;
    showToast(message);
    switch (event.type) {
      case "penalty":
        const shieldActiveMessage = this.checkShieldActive(player);
        if (shieldActiveMessage) {
          message = shieldActiveMessage;
        } else {
          player.money -= event.amount;
        }
        break;
      case "skip":
        player.skipNextTurn = true;
        break;
    }
    await this.updateRoomData({
      players: this.updatePlayers(player),
      isUpdateCurrentIndex: true,
      message,
    });
  },

  // 处理玩家经过领地事件
  async handlePropertyEvent(player, tile) {
    const { players } = this.data;
    switch (true) {
      // 经过空地 可占领
      case !tile.owner && !tile.level:
        let buyMessage = "";
        wx.showModal({
          content: `你要占领此空地吗？费用：${tile.price}元！`,
          success: ({ confirm }) => {
            if (confirm) {
              if (player.money >= tile.price) {
                player.money -= tile.price;
                tile.owner = player.openId;
                tile.bgColor = player.primaryColor;
                tile.level = 1;
                player.ownedPropertiesCount += 1;
                buyMessage = `${player.nickName}占领了此空地！`;
              } else {
                showToast("兄弟，你的钱不够！");
              }
            }
          },
          complete: async () => {
            await this.updateRoomData({
              players: this.updatePlayers(player),
              board: this.updateBoard(tile),
              isUpdateCurrentIndex: true,
              message: buyMessage,
            });
          },
        });
        break;
      // 经过自家领地 可升级
      case tile.owner === player.openId:
        const upgradeCost = tile.level * tile.price;
        let upgradeMessage = "";
        wx.showModal({
          content: `你要升级此领地吗？费用: ${upgradeCost}元！`,
          success: ({ confirm }) => {
            if (confirm) {
              if (player.money >= upgradeCost) {
                player.money -= upgradeCost;
                if (tile.level < 5) {
                  tile.level += 1;
                  upgradeMessage = `${player.nickName}成功将此领地升到${tile.level}级！`;
                } else {
                  showToast("已达到最高等级！");
                }
              } else {
                showToast("兄弟，你的钱不够！");
              }
            }
          },
          complete: async () => {
            await this.updateRoomData({
              players: this.updatePlayers(player),
              board: this.updateBoard(tile),
              isUpdateCurrentIndex: true,
              message: upgradeMessage,
            });
          },
        });
        break;
      // 经过别家领地 需过路费
      case tile.owner !== player.openId:
        const toll = tile.price * tile.level;
        let payMessage = this.checkShieldActive(player);
        if (!payMessage) {
          player.money -= toll;
          const owner = players.find((p) => p.openId === tile.owner);
          owner.money += toll;
          payMessage = `${player.nickName}支付了${toll}元过路费给${owner.nickName}`;
        }
        await this.updateRoomData({
          players: this.updatePlayers(player),
          isUpdateCurrentIndex: true,
          message: payMessage,
        });
        break;
    }
  },

  // 更新地图数据
  updateBoard(newTile) {
    const { board } = this.data;
    let newBoard = { ...board };
    newBoard = board.map((tile) => (tile.id === newTile.id ? newTile : tile));
    return newBoard;
  },

  // 更新玩家数据
  updatePlayers(newPlayer) {
    const { players } = this.data;
    let newPlayers = { ...players };
    newPlayers = players.map((player) =>
      player.openId === newPlayer.openId ? newPlayer : player
    );
    return newPlayers;
  },

  // 增加道具
  addItem(player, name) {
    const itemData = player.items.find((item) => item.name === name);
    if (itemData) {
      itemData.count += 1;
    } else {
      player.items.push({
        name,
        count: 1,
      });
    }
  },

  // 消耗道具
  decreaseItem(player, index) {
    if (player.items[index].count > 1) {
      player.items[index].count -= 1;
    } else {
      player.items.splice(index, 1);
    }
  },

  // 使用道具
  async useItem(e) {
    const { item } = e.currentTarget.dataset;
    const { currentPlayerIndex, players } = this.data;
    const player = players[currentPlayerIndex];
    const itemIndex = player.items.findIndex((data) => data.name === item.name);

    if (itemIndex < 0) {
      showToast("未找到该道具！");
      return;
    }

    let message = "";
    switch (item.name) {
      case "双倍卡":
        player.doubleCardActive = true;
        message = `${player.nickName}使用了双倍卡！`;
        this.decreaseItem(player, itemIndex);
        await this.updateRoomData({
          players: this.updatePlayers(player),
          isUpdateCurrentIndex: false,
          message,
        });
        break;
      case "控制骰子":
        wx.showActionSheet({
          itemList: ["1", "2", "3", "4", "5", "6"],
          success: async (res) => {
            const chosenNumber = parseInt(res.tapIndex) + 1;
            message = `${player.nickName}使用了控制骰子！`;
            player.controlDiceValue = chosenNumber;
            this.decreaseItem(player, itemIndex);
            await this.updateRoomData({
              diceResult: chosenNumber,
              players: this.updatePlayers(player),
              isUpdateCurrentIndex: false,
              message,
            });
          },
          fail: (error) => {
            console.error("useItem error:", error);
          },
        });
        break;
      case "防护罩":
        player.shieldActive = true;
        message = `${player.nickName}使用了防护罩！`;
        this.decreaseItem(player, itemIndex);
        await this.updateRoomData({
          players: this.updatePlayers(player),
          isUpdateCurrentIndex: false,
          message,
        });
        break;
    }
  },

  // 是否使用了双倍卡
  checkDoubleCardActive(player, money) {
    let configMoney = money;
    if (player.doubleCardActive) {
      configMoney = money * 2;
      player.doubleCardActive = false;
      return message;
    }

    player.money += configMoney;
    return configMoney;
  },

  // 是否使用了防护罩
  checkShieldActive(player) {
    if (player.shieldActive) {
      player.shieldActive = false;
      const message = `防护罩已生效，${player.nickName}免受罚款！`;
      return message;
    }

    return "";
  },

  // 展示其他玩家提示信息
  showOtherPlayerMessage(roomData) {
    if (!roomData.message) return;
    showToast(roomData.message);
  },

  // 回合切换
  onChangeCurrentPlayerIndex(roomData) {
    console.log("onChangeCurrentPlayerIndex, isMyTurn:", roomData.isMyTurn);
    if (roomData.isMyTurn) {
      showToast("嘿，现在轮到你了！");
    }
    this.setData({
      canRollDice: roomData.isMyTurn,
      countdown: initCountdown,
    });
    const startTurnCountdownTimer = setTimeout(() => {
      clearTimeout(startTurnCountdownTimer);
      this.startTurnCountdown();
    }, START_TURN_COUNT_DOWN_MS);
  },

  // 开始当前玩家回合倒计时
  startTurnCountdown() {
    this.clearTurnCountdown();
    this.countdownTimer = setInterval(() => {
      this.setData({
        countdown: formatTime(this.data.countdown - 1),
      });
      if (this.data.countdown <= 0) {
        clearInterval(this.countdownTimer);
        this.endTurn();
      }
    }, ONE_SECOND_MS);
  },

  // 清理当前玩家回合倒计时
  clearTurnCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.setData({
        countdown: initCountdown,
      });
    }
  },

  // 回合倒计时结束切换下一个玩家
  async endTurn() {
    const { currentPlayerIndex, players } = this.data;
    await this.updateRoomData({
      isUpdateCurrentIndex: true,
      message: `${players[currentPlayerIndex].nickName}超时了！`,
    });
  },

  // 其他玩家正在摇骰子 播放摇骰子动画
  onOtherPlayerRollingDice(roomData) {
    if (roomData.isRollingDice && !roomData.isMyTurn) {
      this.playDiceAnimation(roomData.diceResult);
      this.clearTurnCountdown();
    }
  },

  // 检查游戏状态
  checkGameStatus(roomData) {
    if (roomData.gameStatus === "GAME_OVER") {
      wx.showModal({
        title: "游戏结束",
        content: `恭喜${roomData.winner.nickName}获得胜利！`,
        showCancel: false,
        success: () => {
          this.clearRoomData();
        },
      });
    }
  },

  // 玩家发起投降
  giveUpGame() {
    const { host, userInfo } = this.data;
    if (host.openId !== userInfo.openId) {
      showToast("请联系房主发起投降！");
      return;
    }

    wx.showModal({
      title: "投降输一半",
      content: `确定要投降吗？将会解散该房间！`,
      success: ({ confirm }) => {
        if (confirm) {
          this.clearRoomData();
        }
      },
    });
  },

  // 清理房间数据（解散房间）
  clearRoomData() {
    const { roomId } = this.data;
    wx.cloud.callFunction({
      name: "clearRoomData",
      data: {
        roomId,
      },
      success: (res) => {
        if (res.result.success) {
          this.resetGame();
          showToast("投降成功，房间已解散！");
        } else {
          showToast("投降失败！");
          console.error("clearRoomData error:", res.result);
        }
      },
      fail: (error) => {
        showToast("投降失败！");
        console.error("clearRoomData fail:", error);
      },
    });
  },

  // 重新开始游戏
  resetGame() {
    clearToastQueue();
    this.clearWatcher();
    wx.navigateTo({
      url: "/pages/index/index",
    });
  },
});
