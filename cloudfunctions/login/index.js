const cloud = require("wx-server-sdk");

cloud.init();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  if (!wxContext.OPENID || !wxContext.APPID) {
    throw new Error("Failed to retrieve OpenID or AppID.");
  }
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
  };
};
