const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event) => {
  const { openid, avatarUrl, nickName } = event;

  try {
    // 查询用户是否已存在
    const userQuery = await db
      .collection("users")
      .where({
        openid,
      })
      .get();

    if (userQuery.data.length > 0) {
      // 更新用户信息
      const userId = userQuery.data[0]._id;
      await db.collection("users").doc(userId).update({
        data: {
          avatarUrl,
          nickName,
        },
      });
      return {
        success: true,
        message: "更新用户信息成功",
      };
    } else {
      // 新增用户信息
      await db.collection("users").add({
        data: {
          openid,
          avatarUrl,
          nickName,
        },
      });
      return {
        success: true,
        message: "添加新用户成功",
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "操作失败",
      error,
    };
  }
};
