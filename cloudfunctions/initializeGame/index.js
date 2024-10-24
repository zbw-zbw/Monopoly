const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

// 初始资金
const playerInitMoney = 5000;

// 玩家主题色
const primaryColor = ["tomato", "skyblue", "orange", "yellowgreen"];

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
          players: initPlayers,
          currentPlayerIndex: 0,
          gameStarted: true, // 标记游戏开始
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
