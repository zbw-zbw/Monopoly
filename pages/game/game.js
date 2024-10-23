const unitPrice = 500;

Page({
  data: {
    canRollDice: true,
    diceResult: 0,
    diceImg: "/assets/1.png",
    diceAnimation: {},
    board: [],
    players: [],
    currentPlayerIndex: 0,
    chanceEvents: [
      {
        type: "reward",
        amount: unitPrice,
        message: `你中了彩票，获得 ¥${unitPrice}！`,
      },
      {
        type: "penalty",
        amount: unitPrice,
        message: `你随地扔垃圾，罚款 ¥${unitPrice}！`,
      },
      { type: "teleport", destination: 0, message: "啊哦，你被传送回了起点！" },
      {
        type: "item",
        item: "双倍卡",
        message: "你运气爆棚，捡到了双倍卡！",
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
        message: `你随地扔垃圾，罚款 ¥${unitPrice}！`,
      },
      { type: "skip", message: "你掉进了陷阱，跳过下一轮行动！" },
      { type: "teleport", destination: 0, message: "啊哦，你被传送回了起点！" },
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
      this.setData({ roomId });
      this.loadRoomData(roomId);
      this.watchRoomData(roomId);
      this.initBoard();
    } else {
      wx.showToast({
        title: "房间异常，请稍后再试",
        icon: "none",
      });
      wx.redirectTo({
        url: "/pages/index/index",
      });
    }
  },

  onUnload() {
    if (this.watcher) {
      this.watcher.close();
    }
  },

  loadRoomData(roomId) {
    wx.cloud.callFunction({
      name: "getRoomData",
      data: { roomId },
      success: (res) => {
        const { success, data } = res.result;
        console.log("~getRoomData~, data:", data);
        if (success) {
          this.setData({
            players: data.players,
            currentPlayerIndex: data.currentPlayerIndex,
          });
        }
      },
      fail: (err) => {
        console.error("获取房间数据失败:", err);
      },
    });
  },

  watchRoomData(roomId) {
    const db = wx.cloud.database();
    this.watcher = db
      .collection("rooms")
      .where({ roomId })
      .watch({
        onChange: (snapshot) => {
          if (snapshot.docs.length) {
            const roomData = snapshot.docs[0];
            console.log("roomData update:", roomData);
            this.setData({
              players: roomData.players,
              currentPlayerIndex: roomData.currentPlayerIndex,
            });
          }
        },
        onError: (err) => {
          console.error("实时数据订阅失败:", err);
        },
      });
  },

  initBoard() {
    const board = [];
    const totalTiles = 40;

    for (let i = 0; i < totalTiles; i++) {
      let tile = {
        x: 0,
        y: 0,
        type: "property",
        price: 0,
        bgColor: "#ffffff",
        level: 0,
      };

      switch (true) {
        case i === 0:
          tile.name = "起点";
          tile.type = "start"; // 起点
          tile.bgColor = "#02ffd0";
          tile.price = 1000;
          break;
        case i % 6 === 0:
          tile.name = "商店";
          tile.type = "shop"; // 商店
          tile.bgColor = "#881280";
          break;
        case i % 7 === 0:
          tile.name = "机会";
          tile.type = "chance"; // 机会卡
          tile.bgColor = "#808002";
          break;
        case i % 8 === 0:
          tile.name = "陷阱";
          tile.type = "trap"; // 陷阱
          tile.bgColor = "#1a1aa6";
          break;
        default:
          tile.price = unitPrice; // 空地
          break;
      }

      // 设置坐标
      const gridSize = 30;
      if (i < 10) {
        tile.x = i * gridSize;
        tile.y = 0;
      } else if (i < 20) {
        tile.x = 9 * gridSize;
        tile.y = (i - 10) * gridSize;
      } else if (i < 30) {
        tile.x = (9 - (i - 20)) * gridSize;
        tile.y = 9 * gridSize;
      } else {
        tile.x = 0;
        tile.y = (9 - (i - 30)) * gridSize;
      }

      // 避免在拐角位置渲染重复的格子
      if (i > 0 && ((i % 10 === 0 && i < 40) || (i % 10 === 9 && i >= 30))) {
        continue;
      }

      board.push(tile);
    }

    this.setData({ board });
  },

  rollDice() {
    const { canRollDice } = this.data;
    if (!canRollDice) return;

    this.setData({
      canRollDice: false,
      diceImg: "/assets/x.gif",
    });

    const rollDiceTimer = setTimeout(() => {
      clearTimeout(rollDiceTimer);
      const diceResult = Math.floor(Math.random() * 6) + 1;
      const diceImg = `/assets/${diceResult}.png`;
      this.setData({
        diceResult,
        diceImg,
      });
      const moveTimer = setTimeout(() => {
        clearTimeout(moveTimer);
        this.movePlayer(diceResult);
      }, 200);
    }, 1000);
  },

  movePlayer(diceResult) {
    const { currentPlayerIndex, players, board } = this.data;
    const player = players[currentPlayerIndex];

    // 计算目标位置
    const startPosition = player.position;

    // 双倍卡
    const diceToMove = player.doubleCardActive ? diceResult * 2 : diceResult;
    const targetPosition = (startPosition + diceToMove) % board.length;

    // 逐步动画移动
    this.animatePlayerMovement(startPosition, targetPosition);
  },

  animatePlayerMovement(start, target) {
    const { players, board, currentPlayerIndex } = this.data;
    const player = players[currentPlayerIndex];

    if (start === target) {
      // 动画结束，处理格子事件
      this.handleTileEvent(player, board[player.position]);

      return;
    }

    // 计算当前移动的位置
    const nextPosition = (start + 1) % board.length;
    player.position = nextPosition;

    const duration = 500;
    const animation = wx.createAnimation({
      duration,
      timingFunction: "ease",
    });
    animation
      .left(board[nextPosition].x + "px")
      .top(board[nextPosition].y + "px")
      .step();

    this.setData({
      players,
      playerAnimation: animation.export(),
    });

    setTimeout(() => {
      this.animatePlayerMovement(nextPosition, target);
    }, duration);
  },

  nextPlayer() {
    const { players, currentPlayerIndex } = this.data;
    let nextPlayerIndex = (currentPlayerIndex + 1) % players.length;

    // 查找下一个可以行动的玩家
    while (players[nextPlayerIndex].skipNextTurn) {
      players[nextPlayerIndex].skipNextTurn = false;
      nextPlayerIndex = (nextPlayerIndex + 1) % players.length;
    }

    this.updateRoomData({
      currentPlayerIndex: nextPlayerIndex,
      players,
    });
  },

  updateRoomData(data) {
    const { roomId } = this.data;
    wx.cloud.callFunction({
      name: "updateRoomData",
      data: {
        roomId,
        ...data,
      },
      success: (res) => {
        console.log("updateRoomData:", res.result);
        this.setData({
          ...this.data,
          ...res.result,
          canRollDice: true,
        });
      },
      fail: (error) => {
        console.error("updateRoomData error:", error);
      },
    });
  },

  handleTileEvent(player, tile) {
    const { players, board, chanceEvents, trapEvents } = this.data;
    switch (tile.type) {
      case "start":
        this.handleStartEvent(player, tile);
      case "property":
        this.handlePropertyEvent(player, tile);
        break;
      case "chance":
        this.handleChanceEvent(player, chanceEvents);
        break;
      case "trap":
        this.handleTrapEvent(player, trapEvents);
        break;
      case "shop":
        this.handleShopEvent(player);
        break;
      default:
        break;
    }

    // this.setData({
    //   board,
    //   players,
    // });
  },

  handleStartEvent(player, tile) {
    const { players } = this.data;
    wx.showToast({
      title: `${player.name} 经过了起点，获得￥${tile.price}补贴`,
      icon: "none",
    });
    player.money += tile.price;
    this.setData({ players });
    this.nextPlayer();
  },

  handlePropertyEvent(player, tile) {
    const { players, board } = this.data;
    switch (true) {
      // 经过空地 可占领
      case !tile.owner:
        wx.showModal({
          content: `你要占领此空地吗？价格为 ¥${tile.price}`,
          success: ({ confirm }) => {
            if (confirm) {
              if (player.money >= tile.price) {
                player.money -= tile.price;
                tile.owner = player.id;
                tile.bgColor = player.bgColor;
                tile.level = 1;
                player.ownedPropertiesCount += 1;
              } else {
                wx.showToast({
                  title: "资产不足！",
                  icon: "none",
                });
              }
              this.checkGameOver(players);
              this.setData({ players, board });
            }
          },
          complete: () => {
            this.nextPlayer();
          },
        });
        break;
      // 经过自家领地 可升级
      case tile.owner === player.id:
        const upgradeCost = tile.level * tile.price;
        wx.showModal({
          content: `你要升级此空地吗？当前等级: ${tile.level}，升级费用: ¥${upgradeCost}`,
          success: ({ confirm }) => {
            if (confirm) {
              if (player.money >= upgradeCost) {
                player.money -= upgradeCost;
                if (tile.level < 5) {
                  tile.level += 1;
                  wx.showToast({
                    title: `成功升级到等级 ${tile.level}!`,
                    icon: "none",
                  });
                } else {
                  wx.showToast({
                    title: "已达到最高等级！",
                    icon: "none",
                  });
                }
              } else {
                wx.showToast({
                  title: "资产不足！",
                  icon: "none",
                });
              }
              this.setData({ players, board });
            }
          },
          complete: () => {
            this.nextPlayer();
          },
        });
        break;
      // 经过别家领地 需过路费
      case tile.owner !== player.id:
        const toll = tile.price * tile.level;
        const shieldActive = this.checkShieldActive(player);
        if (!shieldActive) {
          player.money -= toll;
          const owner = players.find((p) => p.id === tile.owner);
          owner.money += toll;
          wx.showToast({
            title: `${player.name} 支付了 ¥${toll} 过路费给 ${owner.name}`,
            icon: "none",
          });
          this.checkGameOver(players);
          this.setData({ players, board });
        }

        this.nextPlayer();
        break;
    }
  },

  handleChanceEvent(player, chanceEvents) {
    const { players } = this.data;
    const event = chanceEvents[Math.floor(Math.random() * chanceEvents.length)];
    wx.showToast({ title: event.message, icon: "none" });
    switch (event.type) {
      case "reward":
        player.money += event.amount;
        break;
      case "penalty":
        const shieldActive = this.checkShieldActive(player);
        if (!shieldActive) player.money -= event.amount;
        break;
      case "teleport":
        player.position = event.destination;
        break;
      case "item":
        this.addItem(player, event.item);
        break;
    }
    this.checkGameOver(players);
    this.setData({ players });
    this.nextPlayer();
  },

  handleTrapEvent(player, trapEvents) {
    const { players } = this.data;
    const event = trapEvents[Math.floor(Math.random() * trapEvents.length)];
    wx.showToast({ title: event.message, icon: "none" });
    switch (event.type) {
      case "penalty":
        const shieldActive = this.checkShieldActive(player);
        if (!shieldActive) player.money -= event.amount;
        break;
      case "skip":
        player.skipNextTurn = true;
        break;
      case "teleport":
        player.position = event.destination;
        break;
    }
    this.setData({ players });
    this.checkGameOver(players);
    this.nextPlayer();
  },

  handleShopEvent(player) {
    const { players, items } = this.data;
    const itemList = items.map(({ name, price }) => `购买${name}(￥${price})`);
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const { tapIndex } = res;
        const { name, price } = items[tapIndex];
        if (player.money >= price) {
          this.addItem(player, name);
          player.money -= price;
          wx.showToast({ title: `成功购买${name}！`, icon: "none" });
        } else {
          wx.showToast({ title: "资产不足！", icon: "none" });
        }
        this.checkGameOver(players);
        this.setData({ players });
      },
      fail: (error) => {
        console.warn("购买失败:", error);
      },
      complete: () => {
        this.nextPlayer();
      },
    });
  },

  addItem(player, name) {
    const itemData = player.items.find((item) => item.name === name);
    if (itemData) {
      itemData.count += 1;
    } else {
      player.items.push({ name, count: 1 });
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
      wx.showToast({ title: "未找到道具", icon: "none" });
    }

    switch (item.name) {
      case "双倍卡":
        currentPlayer.doubleCardActive = true;
        wx.showToast({ title: "双倍卡已激活！", icon: "none" });
        break;
      case "控制骰子":
        wx.showActionSheet({
          itemList: ["1", "2", "3", "4", "5", "6"],
          success: (res) => {
            const chosenNumber = parseInt(res.tapIndex) + 1;
            this.setData({ diceResult: chosenNumber });
            this.movePlayer(chosenNumber);
          },
        });
        break;
      case "防护罩":
        currentPlayer.shieldActive = true;
        wx.showToast({ title: "防护罩已激活！", icon: "none" });
        break;
    }
    this.setData({ players });
  },

  checkShieldActive(player) {
    if (player.shieldActive) {
      player.shieldActive = false;
      wx.showToast({ title: "防护罩已生效，免受罚款！", icon: "none" });
      return true;
    }

    return false;
  },

  checkPlayerBankrupt(player) {
    const { players } = this.data;

    if (player.money < 0) {
      // 已破产的不弹提示
      if (player.isBankrupt) return true;

      wx.showToast({
        title: `${player.name} 破产了！`,
        icon: "none",
      });
      player.isBankrupt = true;
      this.setData({ players });

      return true;
    }

    return false;
  },

  checkGameOver(players) {
    const remainingPlayers = players.filter(
      (player) => !this.checkPlayerBankrupt(player)
    );

    // 如果只剩一名玩家没有破产，则游戏结束
    if (remainingPlayers.length <= 1) {
      const winner = remainingPlayers[0];
      wx.showModal({
        title: "游戏结束",
        content: `${winner.name} 获得胜利！`,
        showCancel: false,
        success: () => {
          this.resetGame();
        },
      });
    }
  },

  resetGame() {
    wx.redirectTo({
      url: "/pages/index/index",
    });
  },
});
