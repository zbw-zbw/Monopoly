const cloud = require("wx-server-sdk");
cloud.init();

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  if (!wxContext.OPENID || !wxContext.APPID) {
    throw new Error("Failed to retrieve OpenID or AppID.");
  }

  return {
    openId: wxContext.OPENID,
    appId: wxContext.APPID,
  };
};
