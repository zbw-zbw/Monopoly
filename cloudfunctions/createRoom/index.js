const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

function generateRoomId() {
  return Math.random().toString(36).substr(2, 9); // 随机生成 9 位字符串
}

exports.main = async (event) => {
  const roomId = generateRoomId(); // 使用随机生成的房间ID
  const userInfo = event.userInfo;

  const roomData = {
    roomId,
    host: userInfo,
    players: [userInfo],
  };

  await db.collection("rooms").add({ data: roomData });

  return { roomId, players: roomData.players };
};
