Page({
  data: {
    diceResult: 0,
    currentPlayerIndex: 0,
    players: [
      {
        id: 1,
        name: "张宝文",
        money: 1500,
        position: 0,
        items: [],
        doubleCardActive: false,
        shieldActive: false, // 防护罩状态
      },
      {
        id: 2,
        name: "张钦贵",
        money: 1500,
        position: 0,
        items: [],
        doubleCardActive: false,
        shieldActive: false,
      },
      {
        id: 3,
        name: "黄灿",
        money: 1500,
        position: 0,
        items: [],
        doubleCardActive: false,
        shieldActive: false,
      },
    ],

    board: [
      { type: "start", name: "起点" },
      { type: "property", name: "公园大道", price: 100 },
      { type: "chance", name: "机会" },
      { type: "property", name: "中心街", price: 80 },
      { type: "trap", name: "陷阱" },
      { type: "shop", name: "道具店" },
      { type: "property", name: "海滩路", price: 120 },
      { type: "property", name: "山谷小径", price: 90 },
    ],

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

  rollDice() {
    const diceResult = Math.floor(Math.random() * 6) + 1;

    const { players, currentPlayerIndex } = this.data;
    const currentPlayer = players[currentPlayerIndex];

    // 添加道具使用逻辑
    this.useItems(currentPlayer);

    // 执行正常的掷骰子逻辑
    this.setData({
      diceResult,
    });
    this.movePlayer(diceResult);
  },

  useItems(currentPlayer) {
    if (currentPlayer.items.includes("双倍卡")) {
      wx.showModal({
        title: "使用道具",
        content: "你想要使用双倍卡吗？",
        success: ({ confirm }) => {
          if (confirm) {
            currentPlayer.doubleCardActive = true; // 激活双倍卡
            currentPlayer.items = currentPlayer.items.filter(
              (item) => item !== "双倍卡"
            ); // 从道具中移除双倍卡
            wx.showToast({ title: "双倍卡已激活！", icon: "none" });
          }
        },
      });
    }

    if (currentPlayer.doubleCardActive) {
      wx.showToast({ title: "双倍卡生效！", icon: "none" });
      currentPlayer.doubleIncome = true; // 标记下一个回合收入翻倍
      currentPlayer.doubleCardActive = false; // 使用后禁用双倍卡
    }

    // 检查玩家是否有控制骰子道具
    if (currentPlayer.items.includes("控制骰子")) {
      wx.showModal({
        title: "使用控制骰子",
        content: `${currentPlayer.name}，你有一个控制骰子道具，你想使用它来选择骰子的点数吗？`,
        success: ({ confirm }) => {
          if (confirm) {
            wx.showActionSheet({
              itemList: ["1", "2", "3", "4", "5", "6"],
              success: (res) => {
                const chosenNumber = parseInt(res.tapIndex) + 1;
                this.setData({
                  diceResult: chosenNumber,
                });
                // 移除控制骰子道具
                currentPlayer.items = currentPlayer.items.filter(
                  (item) => item !== "控制骰子"
                );
                this.movePlayer(chosenNumber);
              },
              fail: () => {
                wx.showToast({
                  title: "操作取消，使用随机点数",
                  icon: "none",
                });
                this.movePlayer(diceResult);
              },
            });
          } else {
          }
        },
      });
    }
  },

  movePlayer(diceResult) {
    const { currentPlayerIndex, players, board } = this.data;
    const player = players[currentPlayerIndex];

    // 更新玩家位置
    player.position = (player.position + diceResult) % board.length;

    // 打印玩家当前位置
    console.log(`${player.name} 移动到位置 ${player.position}`);

    // 处理玩家到达的格子事件
    const currentTile = board[player.position];
    this.handleTileEvent(player, currentTile);

    // 如果使用了双倍卡，重置标志
    if (player.doubleIncome) {
      player.doubleIncome = false; // 重置状态
      player.money += diceResult; // 在此处给玩家额外的钱（假设按照掷骰子点数获得收入）
    }

    // 更新玩家数据并切换到下一个玩家
    this.setData({
      players,
      currentPlayerIndex: (currentPlayerIndex + 1) % players.length,
    });
  },

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

  handlePropertyEvent(player, tile) {
    const { players, board } = this.data;
    switch (true) {
      case !tile.owner: // 如果没有所有者
        wx.showModal({
          title: "购买地块",
          content: `${player.name}，你想购买 ${tile.name} 吗？价格为 ¥${tile.price}`,
          success: ({ confirm }) => {
            if (confirm) {
              if (player.money >= tile.price) {
                player.money -= tile.price;
                tile.owner = player.id;
                wx.showToast({
                  title: "购买成功！",
                  icon: "none",
                });
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
});
