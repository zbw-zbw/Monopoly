Page({
  data: {
    canRollDice: true,
    diceResult: 0,
    diceImg: "/assets/1.png",
    diceAnimation: {},
    currentPlayerIndex: 0,
    board: [],
    players: [
      {
        id: 1,
        name: "宝文",
        avatar: "/assets/avatar-wen.jpg",
        money: 500,
        position: 0,
        bgColor: "tomato",
        items: [],
        doubleCardActive: false,
        shieldActive: false,
        isBankrupt: false,
      },
      {
        id: 2,
        name: "钦贵",
        avatar: "/assets/avatar-gui.jpg",
        money: 500,
        position: 0,
        bgColor: "skyblue",
        items: [],
        doubleCardActive: false,
        shieldActive: false,
        isBankrupt: false,
      },
      {
        id: 3,
        name: "黄灿",
        avatar: "/assets/avatar-can.jpg",
        money: 500,
        position: 0,
        bgColor: "orange",
        items: [],
        doubleCardActive: false,
        shieldActive: false,
        isBankrupt: false,
      },
    ],
    chanceEvents: [
      {
        type: "reward",
        amount: 1000,
        message: "你找到了隐藏的宝藏，获得了 ¥1000！",
      },
      { type: "penalty", amount: 500, message: "你被罚款了 ¥500！" },
      // { type: "move", steps: 3, message: "你获得了幸运步数，前进3格！" },
      // { type: "move", steps: -2, message: "你不小心摔倒了，后退2格！" },
      { type: "teleport", destination: 0, message: "你被传送回了起点！" },
      { type: "item", item: "双倍卡", message: "你获得了一个双倍卡！" },
      { type: "item", item: "控制骰子", message: "你获得了一个控制骰子！" },
      { type: "item", item: "防护罩", message: "你获得了一个防护罩！" },
    ],
    trapEvents: [
      { type: "penalty", amount: 500, message: "你掉进了陷阱，罚款 ¥500！" },
      { type: "skip", message: "你掉进了陷阱，失去一次行动机会！" },
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

  onLoad() {
    this.initBoard();
  },

  // 登录接口
  login() {
    wx.login({
      success: (res) => {
        if (res.code) {
          console.log("登录成功，code:", res.code);
        } else {
          console.log("登录失败！" + res.errMsg);
        }
      },
      fail: (err) => {
        console.log("wx.login 失败:", err);
      },
    });
  },

  // 获取用户信息
  getUserProfile() {
    wx.getUserProfile({
      desc: "用于完善会员资料",
      success: (res) => {
        const userInfo = res.userInfo;
        console.log("用户信息:", userInfo);
      },
      fail: (err) => {
        console.log("获取用户信息失败:", err);
      },
    });
  },

  // 初始化地图
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
      };

      switch (true) {
        case i === 0:
          tile.name = "起点";
          tile.type = "start"; // 起点
          tile.bgColor = "#ff0757";
          tile.price = 1000;
          break;
        case i % 6 === 0:
          tile.name = "商店";
          tile.type = "shop"; // 商店
          tile.bgColor = "#ec561d";
          break;
        case i % 7 === 0:
          tile.name = "机会";
          tile.type = "chance"; // 机会卡
          tile.bgColor = "#f70ccf";
          break;
        case i % 8 === 0:
          tile.name = "陷阱";
          tile.type = "trap"; // 陷阱
          tile.bgColor = "#1af70c";
          break;
        default:
          // TODO 动态设置价格
          tile.price = 500; // 空地
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
        continue; // 跳过重复的拐角格子
      }

      board.push(tile);
    }

    this.setData({ board });
  },

  // 摇骰子
  rollDice() {
    const { canRollDice, currentPlayerIndex, players } = this.data;
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

  // 玩家移动
  movePlayer(diceResult) {
    const { currentPlayerIndex, players, board } = this.data;
    const player = players[currentPlayerIndex];

    // 计算目标位置
    const startPosition = player.position;
    const targetPosition = (startPosition + diceResult) % board.length;

    // 逐步移动
    this.animatePlayerMovement(startPosition, targetPosition);
  },

  // 逐步动画移动
  animatePlayerMovement(start, target) {
    const { players, board, currentPlayerIndex } = this.data;
    const player = players[currentPlayerIndex];

    if (start === target) {
      // 动画结束，处理格子事件
      this.handleTileEvent(player, board[player.position]);
      this.setData({
        canRollDice: true,
        players,
        currentPlayerIndex: (currentPlayerIndex + 1) % players.length,
      });
      return;
    }

    // 计算当前移动的位置
    const nextPosition = (start + 1) % board.length;
    player.position = nextPosition; // 更新玩家位置

    const duration = 500;

    // 创建动画
    const animation = wx.createAnimation({
      duration,
      timingFunction: "ease",
    });

    // 设置新的位置动画
    animation
      .left(board[nextPosition].x + "px")
      .top(board[nextPosition].y + "px")
      .step();

    this.setData({
      players,
      playerAnimation: animation.export(),
    });

    // 递归调用，以逐步移动
    setTimeout(() => {
      this.animatePlayerMovement(nextPosition, target);
    }, duration); // 延迟500ms进行下一步移动
  },

  // 所有格子事件
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

    this.setData({
      board,
      players,
    });
  },

  // 起点
  handleStartEvent(player, tile) {
    const { players } = this.data;
    wx.showToast({
      title: `${player.name} 经过了起点，获得￥${tile.price}补贴`,
      icon: "none",
    });
    player.money += tile.price;
    this.setData({ players });
  },

  // 空地
  handlePropertyEvent(player, tile) {
    const { players, board } = this.data;
    switch (true) {
      case !tile.owner:
        wx.showModal({
          content: `你要占领此空地吗？价格为 ¥${tile.price}`,
          success: ({ confirm }) => {
            if (confirm) {
              if (player.money >= tile.price) {
                player.money -= tile.price;
                tile.owner = player.id;
                tile.bgColor = player.bgColor;
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
        });
        break;
      case tile.owner !== player.id:
        const toll = tile.price * 0.5; // TODO 动态设置过路费价格
        player.money -= toll;
        const owner = players.find((p) => p.id === tile.owner);
        owner.money += toll;

        wx.showToast({
          title: `${player.name} 支付了 ¥${toll} 过路费给 ${owner.name}`,
          icon: "none",
        });

        this.checkGameOver(players);
        this.setData({ players, board });
        break;
    }
  },

  // 机会
  handleChanceEvent(player, chanceEvents) {
    const { players, board } = this.data;
    const event = chanceEvents[Math.floor(Math.random() * chanceEvents.length)];
    wx.showToast({ title: event.message, icon: "none" });

    // 执行事件效果
    switch (event.type) {
      case "reward":
        player.money += event.amount;
        break;
      case "penalty":
        player.money -= event.amount;
        break;
      case "move":
        player.position =
          (player.position + event.steps + board.length) % board.length;
        break;
      case "teleport":
        player.position = event.destination;
        break;
      case "item":
        player.items.push(event.item);
        break;
    }

    this.checkGameOver(players);
    this.setData({ players });
  },

  // 陷阱
  handleTrapEvent(player, trapEvents) {
    const { players } = this.data;
    const event = trapEvents[Math.floor(Math.random() * trapEvents.length)];
    wx.showToast({ title: event.message, icon: "none" });

    // 执行事件效果
    switch (event.type) {
      case "penalty":
        player.money -= event.amount;
        break;
      case "skip":
        // 此处可以添加跳过行动的逻辑
        break;
      case "teleport":
        player.position = event.destination;
        break;
    }

    this.setData({ players });
    this.checkGameOver(players);
  },

  // 商店
  handleShopEvent(player) {
    const { players, items } = this.data;
    const itemList = items.map(({ name, price }) => `购买${name}(￥${price})`);
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const { tapIndex } = res;
        const { name, price } = items[tapIndex];
        if (player.money >= price) {
          player.items.push(name);
          player.money -= price;
          wx.showToast({ title: `成功购买${name}！`, icon: "none" });
        } else {
          wx.showToast({ title: "资产不足！", icon: "none" });
        }

        this.checkGameOver(players);
        this.setData({ players });
      },
    });
  },

  // 使用道具
  useItem(e) {
    const { item } = e.currentTarget.dataset;
    const { currentPlayerIndex, players } = this.data;
    const currentPlayer = players[currentPlayerIndex];

    switch (item) {
      case "双倍卡":
        currentPlayer.doubleCardActive = true;
        currentPlayer.items = currentPlayer.items.filter((i) => i !== "双倍卡");
        wx.showToast({ title: "双倍卡已激活，下次收入翻倍！", icon: "none" });
        break;
      case "控制骰子":
        wx.showActionSheet({
          itemList: ["1", "2", "3", "4", "5", "6"],
          success: (res) => {
            const chosenNumber = parseInt(res.tapIndex) + 1;
            this.setData({ diceResult: chosenNumber });
            this.movePlayer(chosenNumber);
            currentPlayer.items = currentPlayer.items.filter(
              (i) => i !== "控制骰子"
            );
          },
        });
        break;
      case "防护罩":
        currentPlayer.shieldActive = true;
        currentPlayer.items = currentPlayer.items.filter((i) => i !== "防护罩");
        wx.showToast({ title: "防护罩已激活，下一次将保护你！", icon: "none" });
        break;
    }

    this.setData({ players });
  },

  // 检查玩家是否破产
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

  // 检查游戏是否结束
  checkGameOver(players) {
    setTimeout(() => {
      const remainingPlayers = players.filter(
        (player) => !this.checkPlayerBankrupt(player)
      );

      // 如果只剩一名玩家存活，游戏结束
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
    }, 1000);
  },

  // TODO 重新开始游戏
  resetGame() {
    this.onLoad();
  },
});
