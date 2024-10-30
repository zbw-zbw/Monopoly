const unitPrice = 500;

const toastQueue = [];
const toastDuration = 1500;

const showToast = (message) => {
  toastQueue.push(message);
  if (toastQueue.length === 1) {
    showNextToast();
  }
};

const showNextToast = () => {
  if (toastQueue.length === 0) return;

  const message = toastQueue[0];
  wx.showToast({
    title: message,
    icon: "none",
    duration: toastDuration,
    success: () => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        toastQueue.shift();
        showNextToast();
      }, toastDuration);
    },
  });
};

Page({
  data: {
    roomId: null,
    userInfo: {},
    players: [],
    myPlayerData: {},
    board: [],
    currentPlayerIndex: -1,
    canRollDice: false,
    isRollingDice: false,
    diceImg: "/assets/dice-1.png",
    diceResult: 0,
    gameStatus: "IN_PROGRESS",
    chanceEvents: [
      {
        type: "reward",
        amount: unitPrice,
        message: `中了彩票，获得${unitPrice}元！`,
      },
      {
        type: "penalty",
        amount: unitPrice,
        message: `随地扔垃圾，罚款${unitPrice}元！`,
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
    ],
    trapEvents: [
      {
        type: "penalty",
        amount: unitPrice,
        message: `随地扔垃圾，罚款${unitPrice}元！`,
      },
      { type: "skip", message: "掉进了陷阱，跳过下一轮行动！" },
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
  },

  onLoad(options) {
    const roomId = options.roomId;
    if (roomId) {
      this.initialData(roomId);
      this.initialRoomData(roomId);
    } else {
      showToast("游戏异常，请稍后再试！");
      this.resetGame();
    }
  },

  onUnload() {
    if (this.watcher) {
      this.watcher.close();
    }
  },

  initialData(roomId) {
    const userInfo = JSON.parse(wx.getStorageSync("userInfo"));
    this.setData({
      roomId,
      userInfo,
    });
  },

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

  updateRoomData(data) {
    const { roomId, currentPlayerIndex, players } = this.data;
    const roomData = {
      currentPlayerIndex,
      players: data.players || players,
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

  watchRoomData(roomId) {
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
      // this.showOtherPlayerMessage(roomData);
      this.onChangeCurrentPlayerIndex(roomData);
      this.onOtherPlayerRollingDice(roomData);
      this.checkGameStatus(roomData);
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
      if (message !== lastMessage) {
        this.showOtherPlayerMessage(roomData);
      }

      if (currentPlayerIndex !== lastCurrentPlayerIndex) {
        this.onChangeCurrentPlayerIndex(roomData);
      }

      if (isRollingDice !== lastIsRollingDice && isRollingDice) {
        this.onOtherPlayerRollingDice(roomData);
      }

      if (gameStatus !== lastGameStatus) {
        this.checkGameStatus(roomData);
      }
    }

    this.lastRoomData = roomData;
    this.setData({
      ...roomData,
    });
  },

  rollDice() {
    const { canRollDice } = this.data;
    if (!canRollDice) {
      showToast("别着急，现在还没轮到你！");

      return;
    }

    this.playDiceAnimation();
  },

  playDiceAnimation(result) {
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
      this.updateRoomData({
        isRollingDice: true,
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
      });
      this.movePlayer(diceResult, isMyTurn);
    }, 1000);
  },

  movePlayer(diceResult, isMyTurn) {
    const { currentPlayerIndex, players, board } = this.data;
    const player = players[currentPlayerIndex];
    const startPosition = player.position;
    const diceToMove = player.doubleCardActive ? diceResult * 2 : diceResult;
    const targetPosition = (startPosition + diceToMove) % board.length;
    this.animatePlayerMovement(startPosition, targetPosition, isMyTurn);
  },

  animatePlayerMovement(start, target, isMyTurn) {
    const { players, board, currentPlayerIndex } = this.data;
    const player = players[currentPlayerIndex];

    if (start === target) {
      isMyTurn && this.handleTileEvent(player, board[player.position]);

      return;
    }

    const nextPosition = (start + 1) % board.length;
    player.position = nextPosition;
    const duration = 500;
    const animation = wx.createAnimation({
      duration,
      timingFunction: "ease",
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
    }, duration);
  },

  handleTileEvent(player, tile) {
    const { chanceEvents, trapEvents } = this.data;
    switch (tile.type) {
      case "start":
        this.handleStartEvent(player, tile);
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

  handleStartEvent(player, tile) {
    const message = `${player.name} 经过了起点，获得 ${tile.price} 元补贴`;
    player.money += tile.price;
    this.updateRoomData({
      players: this.updatePlayers(player),
      isUpdateCurrentIndex: true,
      message,
    });
  },

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
          message = `${player.nickName} 购买了 ${name}`;
        } else {
          showToast("资产不足！");
        }
      },
      fail: (error) => {
        console.warn("购买失败:", error);
      },
      complete: () => {
        this.updateRoomData({
          players: this.updatePlayers(player),
          isUpdateCurrentIndex: true,
          message,
        });
      },
    });
  },

  handleChanceEvent(player, chanceEvents) {
    const event = chanceEvents[Math.floor(Math.random() * chanceEvents.length)];
    let message = event.message;
    switch (event.type) {
      case "reward":
        player.money += event.amount;
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
    }
    this.updateRoomData({
      players: this.updatePlayers(player),
      isUpdateCurrentIndex: true,
      message,
    });
  },

  handleTrapEvent(player, trapEvents) {
    const event = trapEvents[Math.floor(Math.random() * trapEvents.length)];
    let message = `${player.nickName}${event.message}`;
    showToast(message);
    switch (event.type) {
      case "penalty":
        const shieldActiveMessage = this.checkShieldActive(player);
        if (shieldActive) {
          message = shieldActiveMessage;
        } else {
          player.money -= event.amount;
        }
        break;
      case "skip":
        player.skipNextTurn = true;
        break;
      case "teleport":
        player.position = event.destination;
        break;
    }
    this.updateRoomData({
      players: this.updatePlayers(player),
      isUpdateCurrentIndex: true,
      message,
    });
  },

  handlePropertyEvent(player, tile) {
    const { players } = this.data;
    switch (true) {
      // 经过空地 可占领
      case !tile.owner && !tile.level:
        let buyMessage = "";
        wx.showModal({
          content: `你要占领此空地吗？费用：${tile.price} 元！`,
          success: ({ confirm }) => {
            if (confirm) {
              if (player.money >= tile.price) {
                player.money -= tile.price;
                tile.owner = player.openId;
                tile.bgColor = player.primaryColor;
                tile.level = 1;
                player.ownedPropertiesCount += 1;
                buyMessage = `${player.nickName} 占领了此空地！`;
              } else {
                showToast("兄弟，你的钱不够！");
              }
            }
          },
          complete: () => {
            this.updateRoomData({
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
          content: `你要升级此领地吗？费用: ${upgradeCost} 元！`,
          success: ({ confirm }) => {
            if (confirm) {
              if (player.money >= upgradeCost) {
                player.money -= upgradeCost;
                if (tile.level < 5) {
                  tile.level += 1;
                  upgradeMessage = `${player.nickName} 成功将此领地升到 ${tile.level} 级！`;
                } else {
                  showToast("已达到最高等级！");
                }
              } else {
                showToast("兄弟，你的钱不够！");
              }
            }
          },
          complete: () => {
            this.updateRoomData({
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
          payMessage = `${player.nickName} 支付了 ${toll} 元过路费给 ${owner.nickName}`;
        }
        this.updateRoomData({
          players: this.updatePlayers(player),
          isUpdateCurrentIndex: true,
          message: payMessage,
        });
        break;
    }
  },

  updateBoard(newTile) {
    const { board } = this.data;
    let newBoard = { ...board };
    newBoard = board.map((tile) => (tile.id === newTile.id ? newTile : tile));

    return newBoard;
  },

  updatePlayers(newPlayer) {
    const { players } = this.data;
    let newPlayers = { ...players };
    newPlayers = players.map((player) =>
      player.openId === newPlayer.openId ? newPlayer : player
    );

    return newPlayers;
  },

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

  useItem(e) {
    const { item } = e.currentTarget.dataset;
    const { currentPlayerIndex, players } = this.data;
    const player = players[currentPlayerIndex];
    const itemIndex = player.items.findIndex((data) => data.name === item.name);

    if (itemIndex > -1) {
      if (player.items[itemIndex].count > 1) {
        player.items[itemIndex].count -= 1;
      } else {
        player.items.splice(itemIndex, 1);
      }
    } else {
      showToast("未找到该道具！");

      return;
    }

    let message = "";
    switch (item.name) {
      case "双倍卡":
        player.doubleCardActive = true;
        message = `${player.nickName} 使用了双倍卡！`;
        this.updateRoomData({
          players: this.updatePlayers(player),
          message,
        });
        break;
      case "控制骰子":
        wx.showActionSheet({
          itemList: ["1", "2", "3", "4", "5", "6"],
          success: (res) => {
            const chosenNumber = parseInt(res.tapIndex) + 1;
            message = `${player.nickName} 使用了控制骰子！`;
            player.controlDiceValue = chosenNumber;
            this.updateRoomData({
              diceResult: chosenNumber,
              players: this.updatePlayers(player),
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
        message = `${player.nickName} 使用了防护罩！`;
        this.updateRoomData({
          players: this.updatePlayers(player),
          message,
        });
        break;
    }
  },

  // 是否使用了防护罩
  checkShieldActive(player) {
    if (player.shieldActive) {
      player.shieldActive = false;
      const message = `防护罩已生效，${player.nickName} 免受罚款！`;

      return message;
    }

    return "";
  },

  // 同步其他玩家触发的提示信息
  showOtherPlayerMessage(roomData) {
    if (roomData.message) {
      showToast(roomData.message);
    }
  },

  // 回合轮换
  onChangeCurrentPlayerIndex(roomData) {
    if (!roomData.isUpdateCurrentIndex) return;

    console.log("onChangeCurrentPlayerIndex, isMyTurn:", roomData.isMyTurn);
    if (roomData.isMyTurn) {
      showToast("嘿，现在轮到你了！");

      this.setData({
        canRollDice: true,
      });
    }
  },

  // 其他玩家正在摇骰子
  onOtherPlayerRollingDice(roomData) {
    if (roomData.isRollingDice && !roomData.isMyTurn) {
      this.playDiceAnimation(roomData.diceResult);
    }
  },

  // 游戏结束
  checkGameStatus(roomData) {
    if (roomData.gameStatus === "over") {
      wx.showModal({
        title: "游戏结束",
        content: `恭喜 ${roomData.winner.nickName} 胜利！`,
        showCancel: false,
        success: () => {
          this.resetGame();
        },
      });
    }
  },

  // 投降
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

  clearRoomData() {
    const { roomId } = this.data;
    wx.cloud.callFunction({
      name: "clearRoomData",
      data: { roomId },
      success: (res) => {
        if (res.result.success) {
          this.resetGame();
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

  resetGame() {
    wx.redirectTo({
      url: "/pages/index/index",
    });
  },
});
