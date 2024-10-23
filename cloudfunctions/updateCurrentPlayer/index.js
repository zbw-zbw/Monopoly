const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event) => {
  const { roomId, currentPlayerIndex } = event;

  try {
    await db.collection("rooms").doc(roomId).update({
      data: {
        currentPlayerIndex,
      },
    });

    return {
      success: true,
      currentPlayerIndex,
    };
  } catch (error) {
    console.error("Error updating current player:", error);
    return {
      success: false,
      error,
    };
  }
};
