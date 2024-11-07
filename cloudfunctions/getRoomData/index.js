const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event) => {
  try {
    const { roomId } = event;

    const roomRes = await db
      .collection("rooms")
      .where({
        roomId,
      })
      .get();

    if (roomRes.data.length > 0) {
      const room = roomRes.data[0];

      return {
        success: true,
        message: "获取房间信息成功！",
        data: room,
      };
    }

    return {
      success: false,
      message: "获取房间信息失败！",
    };
  } catch (error) {
    return {
      success: false,
      message: "获取房间信息失败！",
    };
  }
};
