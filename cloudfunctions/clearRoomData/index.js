const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event) => {
  const { roomId } = event;
  try {
    await db
      .collection("rooms")
      .where({
        roomId,
      })
      .remove();
    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error,
    };
  }
};
