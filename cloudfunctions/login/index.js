// 云函数 - login
const cloud = require("wx-server-sdk");

cloud.init();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
  };
};
