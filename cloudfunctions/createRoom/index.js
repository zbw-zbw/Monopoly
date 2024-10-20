// 云函数 - createRoom
const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event) => {
  const roomId = Date.now(); // 生成房间ID
  const userInfo = event.userInfo;

  const roomData = {
    roomId,
    host: userInfo,
    players: [userInfo],
  };

  await db.collection("rooms").add({ data: roomData });

  return { roomId, players: roomData.players };
};
