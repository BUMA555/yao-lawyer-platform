export default {
  pages: [
    "pages/consult/index",
    "pages/report/index",
    "pages/orders/index",
    "pages/profile/index"
  ],
  window: {
    navigationBarTitleText: "姚律师",
    navigationBarBackgroundColor: "#ffeb3b",
    navigationBarTextStyle: "black",
    backgroundColor: "#ffeb3b"
  },
  tabBar: {
    color: "#050505",
    selectedColor: "#ff3b30",
    backgroundColor: "#fffef2",
    borderStyle: "white",
    list: [
      { pagePath: "pages/consult/index", text: "首页" },
      { pagePath: "pages/report/index", text: "结果" },
      { pagePath: "pages/orders/index", text: "邀请" },
      { pagePath: "pages/profile/index", text: "我的" }
    ]
  }
};
