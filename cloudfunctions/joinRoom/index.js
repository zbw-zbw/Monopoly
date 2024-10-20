// 云函数 - joinRoom
const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event) => {
  const { roomId, userInfo } = event;
  const roomRes = await db.collection("rooms").where({ roomId }).get();
  if (roomRes.data.length > 0) {
    const room = roomRes.data[0];
    const updatedPlayers = [...room.players, userInfo];

    await db
      .collection("rooms")
      .doc(room._id)
      .update({
        data: { players: updatedPlayers },
      });

    return { success: true, players: updatedPlayers };
  } else {
    return { success: false, message: JSON.stringify(roomRes) };
  }
};
