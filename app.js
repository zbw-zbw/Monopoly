// app.js
App({
  onLaunch() {
    wx.cloud.init({
      env: "monopoly-0gubxyye976c735f", // 云环境 ID
      traceUser: true,
    });
  },
});
