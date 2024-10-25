const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

const playerInitMoney = 5000;

const primaryColor = ["tomato", "skyblue", "orange", "yellowgreen"];

const initBoard = () => {
  const board = [];
  const totalTiles = 40;
  const gridSize = 30;
  const tilePrice = 500;

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
        tile.type = "start";
        tile.bgColor = "#d0406f";
        tile.price = 1000;
        break;
      case i % 6 === 0:
        tile.name = "商店";
        tile.type = "shop";
        tile.bgColor = "#e07147";
        break;
      case i % 7 === 0:
        tile.name = "机会";
        tile.type = "chance";
        tile.bgColor = "#d854c1";
        break;
      case i % 8 === 0:
        tile.name = "陷阱";
        tile.type = "trap";
        tile.bgColor = "#64d45d";
        break;
      default:
        tile.price = tilePrice;
        break;
    }

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

  return board;
};

exports.main = async (event) => {
  const { roomId, players } = event;

  // 初始化玩家信息
  const initPlayers = players.map((player, index) => ({
    ...player,
    money: playerInitMoney,
    ownedPropertiesCount: 0,
    position: 0,
    primaryColor: primaryColor[index],
    items: [],
    doubleCardActive: false,
    shieldActive: false,
    skipNextTurn: false,
    isBankrupt: false,
  }));

  try {
    // 更新房间数据
    await db
      .collection("rooms")
      .where({ roomId })
      .update({
        data: {
          gameStatus: "started",
          players: initPlayers,
          currentPlayerIndex: 0,
          board: initBoard(),
        },
      });

    return {
      success: true,
      message: "玩家信息初始化成功",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};
