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

const checkPlayerBankrupt = (player) => {
  if (player.money < 0) {
    if (player.isBankrupt) return true;
    player.isBankrupt = true;
    return true;
  }
  return false;
};

const checkGameOver = (players) => {
  const remainingPlayers = players.filter(
    (player) => !checkPlayerBankrupt(player)
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
    const winner = checkGameOver(players);
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
      message: "更新房间数据成功",
    };
  } catch (error) {
    console.log("更新房间数据失败，error:", error);
    return {
      success: false,
      message: "更新房间数据失败",
    };
  }
};
