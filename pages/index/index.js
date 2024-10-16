Page({
  data: {
    diceResult: 0,
    diceAnimation: {},
    currentPlayerIndex: 2,
    players: [
      {
        id: 1,
        name: "宝文",
        money: 1500,
        position: 0,
        bgColor: "skyblue",
        items: [],
        doubleCardActive: false,
        shieldActive: false,
      },
      {
        id: 2,
        name: "钦贵",
        money: 1500,
        position: 0,
        bgColor: "yellowgreen",
        items: [],
        doubleCardActive: false,
        shieldActive: false,
      },
      {
        id: 3,
        name: "黄灿",
        money: 1500,
        position: 0,
        bgColor: "saddlebrown",
        items: [],
        doubleCardActive: false,
        shieldActive: false,
      },
    ],
    board: [],
    chanceEvents: [
      {
        type: "reward",
        amount: 100,
        message: "你找到了隐藏的宝藏，获得了 ¥100！",
      },
      { type: "penalty", amount: 50, message: "你被罚款了 ¥50！" },
      { type: "move", steps: 3, message: "你获得了幸运步数，前进3格！" },
      { type: "move", steps: -2, message: "你不小心摔倒了，后退2格！" },
      { type: "teleport", destination: 0, message: "你被传送回了起点！" },
      { type: "item", item: "双倍卡", message: "你获得了一个双倍卡！" },
      { type: "item", item: "控制骰子", message: "你获得了一个控制骰子！" },
      { type: "item", item: "防护罩", message: "你获得了一个防护罩！" },
    ],
    trapEvents: [
      { type: "penalty", amount: 50, message: "你掉进了陷阱，罚款 ¥50！" },
      { type: "skip", message: "你掉进了陷阱，失去一次行动机会！" },
      { type: "teleport", destination: 0, message: "你被传送回了起点！" },
    ],
  },

  onLoad() {
    this.initBoard();
  },

  // 初始化地图格子布局，形成一条完整路线
  initBoard() {
    const board = [];
    const totalTiles = 40;

    for (let i = 0; i < totalTiles - 1; i++) {
      let tile = {
        x: 0,
        y: 0,
        type: "property",
        price: 0,
        bgColor: "#ffffff",
      };

      // 使用 switch 优化格子类型的设置
      switch (true) {
        case i === 0:
          tile.type = "start"; // 起点
          tile.bgColor = "#ff0757";
          break;
        case i % 6 === 0:
          tile.type = "shop"; // 商店
          tile.bgColor = "#ec561d";
          break;
        case i % 7 === 0:
          tile.type = "chance"; // 机会卡
          tile.bgColor = "#f70ccf";
          break;
        case i % 8 === 0:
          tile.type = "trap"; // 陷阱
          tile.bgColor = "#1af70c";
          break;
        default:
          tile.price = (i + 1) * 10; // 地产
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

      board.push(tile);
    }

    this.setData({ board });
  },

  // 摇骰子
  rollDice() {
    const diceResult = Math.floor(Math.random() * 6) + 1;

    // 定义骰子动画
    const animation = wx.createAnimation({
      duration: 500,
      timingFunction: "ease",
    });

    animation.rotate(360).step().scale(1.5).step().scale(1).step();

    this.setData({
      diceResult,
      diceAnimation: animation.export(),
    });

    // 继续处理玩家移动逻辑
    this.movePlayer(diceResult);
  },

  // 玩家移动
  movePlayer(diceResult) {
    const { currentPlayerIndex, players, board } = this.data;
    const player = players[currentPlayerIndex];

    // 计算目标位置
    const startPosition = player.position;
    const targetPosition = (startPosition + diceResult) % board.length;

    // 逐步移动
    this.animatePlayerMovement(startPosition, targetPosition, 0);
  },

  // 逐步动画移动
  animatePlayerMovement(start, target, step) {
    const { players, board, currentPlayerIndex } = this.data;
    const player = players[currentPlayerIndex];

    if (start === target) {
      // 动画结束，处理格子事件
      this.handleTileEvent(player, board[player.position]);
      this.setData({
        players,
        currentPlayerIndex: (currentPlayerIndex + 1) % players.length,
      });
      return;
    }

    // 计算当前移动的位置
    const nextPosition = (start + 1) % board.length;
    player.position = nextPosition; // 更新玩家位置

    // 创建动画
    const animation = wx.createAnimation({
      duration: 500,
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
      this.animatePlayerMovement(nextPosition, target, step + 1);
    }, 500); // 延迟500ms进行下一步移动
  },

  // 所有格子事件
  handleTileEvent(player, tile) {
    const { players, board, chanceEvents, trapEvents } = this.data;

    switch (tile.type) {
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
        console.log(`${player.name} 来到了特殊格子。`);
    }

    // 最后再次更新数据以确保所有更改都被应用
    this.setData({
      players,
      board,
    });
  },

  // 土地格子
  handlePropertyEvent(player, tile) {
    const { players, board } = this.data;
    switch (true) {
      case !tile.owner: // 如果没有所有者
        wx.showModal({
          title: "占领空地",
          content: `你要占领此空地吗？价格为 ¥${tile.price}`,
          success: ({ confirm }) => {
            if (confirm) {
              if (player.money >= tile.price) {
                player.money -= tile.price;
                tile.owner = player.id;
                // 更新该空地的背景色
                tile.bgColor = player.bgColor;
              } else {
                wx.showToast({
                  title: "金钱不足！",
                  icon: "none",
                });
              }
              this.setData({ players, board });
            }
          },
        });
        break;
      case tile.owner !== player.id: // 如果地块有其他玩家的所有者
        const toll = tile.price * 0.1; // 例如过路费为地块价格的10%
        player.money -= toll;
        const owner = players.find((p) => p.id === tile.owner);
        owner.money += toll;

        wx.showToast({
          title: `${player.name} 支付了 ¥${toll} 过路费给 ${owner.name}`,
          icon: "none",
        });

        this.setData({ players, board });
        break;
    }
  },

  // 机会格子
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

    this.setData({ players });
  },

  // 陷阱格子
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
  },

  // 商店格子
  handleShopEvent(player) {
    const { players } = this.data;
    wx.showActionSheet({
      itemList: ["购买双倍卡", "购买控制骰子", "购买防护罩"],
      success: (res) => {
        let cost;
        switch (res.tapIndex) {
          case 0:
            cost = 50;
            if (player.money >= cost) {
              player.items.push("双倍卡");
              player.money -= cost;
              wx.showToast({ title: "成功购买双倍卡！", icon: "none" });
            } else {
              wx.showToast({ title: "金钱不足！", icon: "none" });
            }
            break;
          case 1:
            cost = 30;
            if (player.money >= cost) {
              player.items.push("控制骰子");
              player.money -= cost;
              wx.showToast({ title: "成功购买控制骰子！", icon: "none" });
            } else {
              wx.showToast({ title: "金钱不足！", icon: "none" });
            }
            break;
          case 2:
            cost = 40;
            if (player.money >= cost) {
              player.items.push("防护罩");
              player.money -= cost;
              wx.showToast({ title: "成功购买防护罩！", icon: "none" });
            } else {
              wx.showToast({ title: "金钱不足！", icon: "none" });
            }
            break;
          default:
            break;
        }
        this.setData({ players });
      },
      fail: () => {
        wx.showToast({ title: "操作取消！", icon: "none" });
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
});
