const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

const getNextPlayerIndex = (currentPlayerIndex, players) => {
  let nextPlayerIndex = (currentPlayerIndex + 1) % players.length;

  while (players[nextPlayerIndex].skipNextTurn) {
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
    const { roomId, isUpdateCurrentIndex = false, ...data } = event;
    const { players, currentPlayerIndex } = data;
    const updateData = data;

    if (isUpdateCurrentIndex) {
      const nextPlayerIndex = getNextPlayerIndex(currentPlayerIndex, players);
      updateData.currentPlayerIndex = nextPlayerIndex;
    }

    const winner = checkGameOver(players);
    if (winner) {
      updateData.gameStatus = "OVER";
      updateData.winner = winner;
    }

    await db
      .collection("rooms")
      .where({
        roomId,
      })
      .update({
        data: updateData,
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
