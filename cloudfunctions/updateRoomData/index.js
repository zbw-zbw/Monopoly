const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

const getNextPlayerIndex = (currentPlayerIndex, players) => {
  let nextPlayerIndex = (currentPlayerIndex + 1) % players.length;

  while (
    players[nextPlayerIndex].skipNextTurn ||
    players[nextPlayerIndex].isBankrupt
  ) {
    players[nextPlayerIndex].skipNextTurn = false;
    nextPlayerIndex = (nextPlayerIndex + 1) % players.length;
  }

  return nextPlayerIndex;
};

const checkPlayerBankrupt = (player, board) => {
  if (player.isBankrupt) return true;

  if (player.money < 0) {
    player.isBankrupt = true;

    // 清空玩家的所有资产
    player.money = 0;
    player.items = [];
    player.position = -1;
    player.ownedPropertiesCount = 0;

    // 清空已占领的土地
    board.forEach((tile) => {
      if (tile.owner === player.openId) {
        tile.level = 0;
        tile.owner = null;
        tile.bgColor = "#ffffff";
      }
    });

    return true;
  }

  return false;
};

const checkGameOver = (players, board) => {
  const remainingPlayers = players.filter(
    (player) => !checkPlayerBankrupt(player, board)
  );

  if (remainingPlayers.length <= 1) {
    const winner = remainingPlayers[0];

    return winner;
  }

  return null;
};

exports.main = async (event) => {
  try {
    const { roomId, roomData } = event;

    const {
      players,
      currentPlayerIndex,
      isUpdateCurrentIndex = false,
    } = roomData;

    const data = { ...roomData };

    if (isUpdateCurrentIndex) {
      // 当前回合结束，清空双倍卡效果
      if (data.players[currentPlayerIndex].doubleCardActive) {
        data.players[currentPlayerIndex].doubleCardActive = false;
      }

      // 当前回合结束，清空防护罩效果
      if (data.players[currentPlayerIndex].shieldActive) {
        data.players[currentPlayerIndex].shieldActive = false;
      }

      // 更新当前玩家下标
      const nextPlayerIndex = getNextPlayerIndex(currentPlayerIndex, players);
      data.currentPlayerIndex = nextPlayerIndex;

      // 更新当前回合数
      data.players[currentPlayerIndex].roundsCompleted = true;
      const allPlayersCompleted = data.players.every(
        (player) => player.roundsCompleted
      );

      if (allPlayersCompleted) {
        data.currentRound += 1;
        data.players.forEach((player) => {
          player.roundsCompleted = false;
        });
      }
    }

    const winner = checkGameOver(players, data.board);

    if (winner) {
      data.gameStatus = "GAME_OVER";
      data.winner = winner;
    }
    await db
      .collection("rooms")
      .where({
        roomId,
      })
      .update({
        data,
      });

    return {
      success: true,
      message: "更新房间数据成功！",
    };
  } catch (error) {
    console.log("更新房间数据失败，error:", error);

    return {
      success: false,
      message: "更新房间数据失败！",
    };
  }
};
