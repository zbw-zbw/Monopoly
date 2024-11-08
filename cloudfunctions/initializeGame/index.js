const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

const playerInitMoney = 10000;

const primaryColor = ["tomato", "skyblue", "orange", "yellowgreen"];

const initBoard = () => {
  const board = [];
  const totalTiles = 40;
  const gridSize = 30;
  const shopCount = 2;
  const trapCount = 4;
  const chanceCount = 4;
  const cornerIndices = [0, 10, 20, 30]; // 四个角落的位置

  // 先生成起点格子
  const startTile = {
    id: 0,
    x: 0,
    y: 0,
    type: "start",
    name: "起点",
    bgColor: "#d0406f",
    price: Math.ceil(Math.random() * 3000 + 2000),
    owner: null,
    level: 0,
  };
  board.push(startTile); // 将起点格子固定在第一个位置

  // 生成普通属性格子（跳过角落）
  for (let i = 1; i < totalTiles - 1; i++) {
    // 不包含最后一个格子
    if (cornerIndices.includes(i)) continue; // 跳过角落格子

    let tile = {
      id: i,
      x: 0,
      y: 0,
      type: "property",
      name: "",
      bgColor: "#ffffff",
      price: Math.ceil(Math.random() * 300 + 500),
      owner: null,
      level: 0,
    };

    // 设置格子的坐标
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

  // 随机分配特殊格子，确保不覆盖起点
  const assignSpecialTiles = (type, count, name, bgColor) => {
    let assigned = 0;
    while (assigned < count) {
      const randomIndex = Math.floor(Math.random() * board.length);
      const tile = board[randomIndex];
      // 只分配到普通属性格子上
      if (tile.type === "property") {
        tile.type = type;
        tile.name = name;
        tile.bgColor = bgColor;
        tile.price = 0; // 特殊格子无价格
        assigned++;
      }
    }
  };

  // 分配商店、陷阱和机会格子
  assignSpecialTiles("shop", shopCount, "商店", "#e07147");
  assignSpecialTiles("trap", trapCount, "陷阱", "#64d45d");
  assignSpecialTiles("chance", chanceCount, "机会", "#d854c1");

  return board;
};

exports.main = async (event) => {
  try {
    const { roomId, players } = event;

    const randomIndex = Math.floor(Math.random() * players.length);

    const initPlayers = players.map((player, index) => ({
      ...player,
      money: playerInitMoney,
      ownedPropertiesCount: 0,
      position: 0,
      primaryColor: primaryColor[index],
      items: [],
      doubleCardActive: false,
      shieldActive: false,
      controlDiceValue: 0,
      skipNextTurn: false,
      isBankrupt: false,
      roundsCompleted: false,
    }));

    await db
      .collection("rooms")
      .where({
        roomId,
      })
      .update({
        data: {
          gameStatus: "IN_PROGRESS",
          players: initPlayers,
          currentRound: 1,
          currentPlayerIndex: randomIndex,
          isUpdateCurrentIndex: true,
          board: initBoard(),
        },
      });

    return {
      success: true,
      message: "游戏初始化成功！",
    };
  } catch (error) {
    return {
      success: false,
      message: "游戏初始化失败！",
      error,
    };
  }
};
