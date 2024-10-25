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

  // 如果只剩一名玩家没有破产，则游戏结束
  if (remainingPlayers.length <= 1) {
    const winner = remainingPlayers[0];

    return {
      gameStatus: "over",
      winner,
    };
  }

  return {};
};

exports.main = async (event) => {
  const { roomId, isUpdateCurrentIndex = false, ...data } = event;
  const { players, currentPlayerIndex } = data;
  const updateData = data;

  if (isUpdateCurrentIndex) {
    const nextPlayerIndex = getNextPlayerIndex(currentPlayerIndex, players);
    updateData.currentPlayerIndex = nextPlayerIndex;
  }

  const { gameStatus, winner } = checkGameOver(players);
  if (winner) {
    updateData.gameStatus = gameStatus;
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
    data,
  };
};
