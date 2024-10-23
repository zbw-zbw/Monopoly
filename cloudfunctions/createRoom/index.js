const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

function generateRoomId() {
  return Math.random().toString(36).substr(2, 9);
}

exports.main = async (event) => {
  // FIXME: 内测房间 ID
  const roomId = "内测玩家专属房间";
  // const roomId = generateRoomId();

  const userInfo = event.userInfo;
  const roomData = {
    roomId,
    host: userInfo,
    players: [userInfo],
  };

  // 检查房间是否已存在
  const existingRoom = await db.collection("rooms").where({ roomId }).get();
  if (!existingRoom.data.length) {
    await db.collection("rooms").add({ data: roomData });
  }

  return roomData;
};
