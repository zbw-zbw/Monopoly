const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event) => {
  const { openId, avatarUrl, nickName } = event;

  try {
    const userQuery = await db
      .collection("users")
      .where({
        openId,
      })
      .get();

    if (userQuery.data.length > 0) {
      const userId = userQuery.data[0]._id;
      await db.collection("users").doc(userId).update({
        data: {
          avatarUrl,
          nickName,
        },
      });

      return {
        success: true,
        message: "更新用户信息成功！",
      };
    } else {
      await db.collection("users").add({
        data: {
          openId,
          avatarUrl,
          nickName,
        },
      });

      return {
        success: true,
        message: "添加新用户成功！",
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "操作失败！",
    };
  }
};
