const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event) => {
  const { roomId, ...data } = event;
  await db.collection("rooms").where({ roomId }).update({ data });

  return {
    success: true,
    data,
  };
};
