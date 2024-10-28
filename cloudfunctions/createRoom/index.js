const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

function generateRoomId() {
  return Math.random().toString(36).substr(2, 9);
}

exports.main = async (event) => {
  const { user } = event;
  // FIXME: 内测房间 ID
  const roomId = "内测玩家专属房间";
  // const roomId = generateRoomId();

  const roomData = {
    roomId,
    host: user,
    players: [
      {
        ...user,
        isHost: true,
      },
    ],
    gameStatus: "NOT_START",
  };

  // 检查房间是否已存在
  try {
    const existingRoom = await db
      .collection("rooms")
      .where({
        roomId,
      })
      .get();
    if (existingRoom.data.length) {
      return {
        success: true,
        message: "房间已存在",
        data: {
          roomId,
        },
      };
    } else {
      await db.collection("rooms").add({
        data: roomData,
      });

      return {
        success: true,
        message: "创建房间成功",
        data: {
          roomId,
        },
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "创建房间失败",
    };
  }
};
