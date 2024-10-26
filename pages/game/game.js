const unitPrice = 500;

Page({
  data: {
    myPlayerData: {},
    canRollDice: false,
    diceImg: "/assets/dice-1.png",
    chanceEvents: [
      {
        type: "reward",
        amount: unitPrice,
        message: `你中了彩票，获得${unitPrice}元！`,
      },
      {
        type: "penalty",
        amount: unitPrice,
        message: `你随地扔垃圾，罚款${unitPrice}元！`,
      },
      { type: "teleport", destination: 0, message: "你被传送回了起点！" },
      {
        type: "item",
        item: "双倍卡",
        message: "你运气爆棚，捡到了双倍卡！",
      },
      {
        type: "item",
        item: "控制骰子",
        message: "你运气爆棚，捡到了控制骰子！",
      },
      {
        type: "item",
        item: "防护罩",
        message: "你运气爆棚，捡到了防护罩！",
      },
    ],
    trapEvents: [
      {
        type: "penalty",
        amount: unitPrice,
        message: `你随地扔垃圾，罚款${unitPrice}元！`,
      },
      { type: "skip", message: "你掉进了陷阱，跳过下一轮行动！" },
      { type: "teleport", destination: 0, message: "你被传送回了起点！" },
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
      wx.showToast({
        title: "游戏异常，请稍后再试",
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
          console.log("初始化房间数据成功:", data);
          this.watchRoomData(roomId);
        }
      },
      fail: (error) => {
        console.error("获取房间数据失败:", error);
      },
    });
  },

  updateRoomData(data) {
    const { roomId, currentPlayerIndex, players } = this.data;
    const newData = {
      roomId,
      currentPlayerIndex,
      players: data.players || players,
      ...data,
    };
    wx.cloud.callFunction({
      name: "updateRoomData",
      data: newData,
      success: (res) => {
        if (res.result.success) {
          console.log("房间数据更新成功:", res.result);
        } else {
          console.error("房间数据更新失败:", res.result);
        }
      },
      fail: (error) => {
        console.error("房间数据更新失败:", error);
      },
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
            const { userInfo, currentPlayerIndex } = this.data;
            const myPlayerData = roomData.players.find(
              (player) => player.openId === userInfo.openId
            );
            console.log("监听到房间玩家数据更新:", roomData);
            const currentPlayer = roomData.players[roomData.currentPlayerIndex];
            const isMyTurn = currentPlayer.openId === userInfo.openId;

            // 游戏结束
            if (roomData.gameStatus === "over") {
              this.onGameOver(roomData);
            }

            // 回合轮换
            if (roomData.currentPlayerIndex !== currentPlayerIndex) {
              this.onChangeCurrentPlayerIndex(isMyTurn);
            }

            // TODO 摇骰子动画

            this.setData({
              ...roomData,
              myPlayerData,
            });
          }
        },
        onError: (error) => {
          console.error("监听房间数据失败:", error);
        },
      });
  },

  rollDice() {
    const { canRollDice } = this.data;
    if (!canRollDice) {
      wx.showToast({
        title: "现在不是你的回合！",
        icon: "none",
      });
      return;
    }

    this.playDiceAnimation();
  },

  playDiceAnimation() {
    this.setData({
      canRollDice: false,
      diceImg: "/assets/roll-dice.gif",
    });
    const rollDiceTimer = setTimeout(() => {
      clearTimeout(rollDiceTimer);
      const diceResult = Math.floor(Math.random() * 6) + 1;
      const diceImg = `/assets/dice-${diceResult}.png`;
      this.setData({
        isRollingDice: false,
        diceResult,
        diceImg,
      });
      this.movePlayer(diceResult);
    }, 1000);
  },

  movePlayer(diceResult) {
    const { currentPlayerIndex, players, board } = this.data;
    const player = players[currentPlayerIndex];
    const startPosition = player.position;
    const diceToMove = player.doubleCardActive ? diceResult * 2 : diceResult;
    const targetPosition = (startPosition + diceToMove) % board.length;
    this.animatePlayerMovement(startPosition, targetPosition);
  },

  animatePlayerMovement(start, target) {
    const { players, board, currentPlayerIndex } = this.data;
    const player = players[currentPlayerIndex];

    if (start === target) {
      this.handleTileEvent(player, board[player.position]);
      // this.updateRoomData({
      //   players: this.updatePlayers(player),
      // });

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
      this.animatePlayerMovement(nextPosition, target);
    }, duration);
  },

  handleTileEvent(player, tile) {
    const { chanceEvents, trapEvents } = this.data;
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
  },

  handleStartEvent(player, tile) {
    wx.showToast({
      title: `${player.name} 经过了起点，获得${tile.price}元补贴`,
      icon: "none",
    });
    player.money += tile.price;
    this.updateRoomData({
      players: this.updatePlayers(player),
      isUpdateCurrentIndex: true,
    });
  },

  handlePropertyEvent(player, tile) {
    const { players } = this.data;
    switch (true) {
      // 经过空地 可占领
      case !tile.owner:
        wx.showModal({
          content: `你要占领此空地吗？需花费：${tile.price}元`,
          success: ({ confirm }) => {
            if (confirm) {
              if (player.money >= tile.price) {
                player.money -= tile.price;
                tile.owner = player.openId;
                tile.bgColor = player.primaryColor;
                tile.level = 1;
                player.ownedPropertiesCount += 1;
              } else {
                wx.showToast({
                  title: "资产不足！",
                  icon: "none",
                });
              }
            }
          },
          complete: () => {
            this.updateRoomData({
              players: this.updatePlayers(player),
              board: this.updateBoard(tile),
              isUpdateCurrentIndex: true,
            });
          },
        });
        break;
      // 经过自家领地 可升级
      case tile.owner === player.openId:
        const upgradeCost = tile.level * tile.price;
        wx.showModal({
          content: `你要升级此领地吗？需花费: ${upgradeCost}元`,
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
            }
          },
          complete: () => {
            this.updateRoomData({
              players: this.updatePlayers(player),
              board: this.updateBoard(tile),
              isUpdateCurrentIndex: true,
            });
          },
        });
        break;
      // 经过别家领地 需过路费
      case tile.owner !== player.openId:
        const toll = tile.price * tile.level;
        const shieldActive = this.checkShieldActive(player);
        if (!shieldActive) {
          player.money -= toll;
          const owner = players.find((p) => p.openId === tile.owner);
          owner.money += toll;
          wx.showToast({
            title: `${player.nickName} 支付了 ${toll} 元过路费给 ${owner.nickName}`,
            icon: "none",
          });
        }

        this.updateRoomData({
          players: this.updatePlayers(player),
          isUpdateCurrentIndex: true,
        });
        break;
    }
  },

  handleChanceEvent(player, chanceEvents) {
    const event = chanceEvents[Math.floor(Math.random() * chanceEvents.length)];
    wx.showToast({
      title: event.message,
      icon: "none",
    });
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
    this.updateRoomData({
      players: this.updatePlayers(player),
      isUpdateCurrentIndex: true,
    });
  },

  handleTrapEvent(player, trapEvents) {
    const event = trapEvents[Math.floor(Math.random() * trapEvents.length)];
    wx.showToast({
      title: event.message,
      icon: "none",
    });
    switch (event.type) {
      case "penalty":
        const shieldActive = this.checkShieldActive(player);
        if (!shieldActive) {
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
    });
  },

  handleShopEvent(player) {
    const { items } = this.data;
    const itemList = items.map(({ name, price }) => `购买${name}（${price}元)`);
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const { tapIndex } = res;
        const { name, price } = items[tapIndex];
        if (player.money >= price) {
          this.addItem(player, name);
          player.money -= price;
          wx.showToast({
            title: `成功购买${name}！`,
            icon: "none",
          });
        } else {
          wx.showToast({
            title: "资产不足！",
            icon: "none",
          });
        }
      },
      fail: (error) => {
        console.warn("购买失败:", error);
      },
      complete: () => {
        this.updateRoomData({
          players: this.updatePlayers(player),
          isUpdateCurrentIndex: true,
        });
      },
    });
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
    console.log(item);
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
      wx.showToast({
        title: "未找到道具",
        icon: "none",
      });
    }

    switch (item.name) {
      case "双倍卡":
        player.doubleCardActive = true;
        wx.showToast({
          title: "双倍卡已激活！",
          icon: "none",
        });
        this.updateRoomData({
          players: this.updatePlayers(player),
        });
        break;
      case "控制骰子":
        wx.showActionSheet({
          itemList: ["1", "2", "3", "4", "5", "6"],
          success: (res) => {
            const chosenNumber = parseInt(res.tapIndex) + 1;
            this.movePlayer(chosenNumber);
            this.updateRoomData({
              diceResult: chosenNumber,
              players: this.updatePlayers(player),
            });
          },
        });
        break;
      case "防护罩":
        player.shieldActive = true;
        wx.showToast({
          title: "防护罩已激活！",
          icon: "none",
        });
        this.updateRoomData({
          players: this.updatePlayers(player),
        });
        break;
    }
  },

  checkShieldActive(player) {
    if (player.shieldActive) {
      player.shieldActive = false;
      wx.showToast({
        title: "防护罩已生效，免受罚款！",
        icon: "none",
      });
      return true;
    }

    return false;
  },

  onChangeCurrentPlayerIndex(isMyTurn) {
    console.log("回合轮换，是否轮到我的回合:", isMyTurn);
    if (isMyTurn) {
      wx.showToast({
        title: `现在轮到你的回合！`,
        icon: "none",
      });
      this.setData({
        canRollDice: true,
      });
    }
  },

  onGameOver(roomData) {
    console.log("游戏结束", roomData);
    wx.showModal({
      title: "游戏结束",
      content: `恭喜 ${roomData.winner.name} 胜利！`,
      showCancel: false,
      success: () => {
        this.resetGame();
      },
    });
  },

  resetGame() {
    wx.redirectTo({
      url: "/pages/index/index",
    });
  },
});
