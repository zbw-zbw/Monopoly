const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

const MAX_PLAYERS = 4; // 最大玩家数量

exports.main = async (event) => {
  try {
    const { roomId, user } = event;
    const roomRes = await db
      .collection("rooms")
      .where({
        roomId,
      })
      .get();
    if (roomRes.data.length > 0) {
      const room = roomRes.data[0];
      // 检查用户是否已在房间内
      const isExist = room.players.some(
        (player) => player.openId === user.openId
      );
      if (isExist) {
        return {
          success: true,
          message: "你已在房间内",
          room,
        };
      }
      // 检查房间是否已满
      if (room.players.length >= MAX_PLAYERS) {
        return {
          success: false,
          message: "房间已满",
          room,
        };
      }
      const updatedPlayers = [...room.players, user];
      await db
        .collection("rooms")
        .doc(room._id)
        .update({
          data: {
            players: updatedPlayers,
          },
        });
      return {
        success: true,
        message: "加入房间成功",
        room,
      };
    } else {
      return {
        success: false,
        message: "房间不存在",
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "加入房间失败",
    };
  }
};
