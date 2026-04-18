export default {
  pages: [
    "pages/consult/index",
    "pages/report/index",
    "pages/orders/index",
    "pages/profile/index"
  ],
  window: {
    navigationBarTitleText: "姚律师",
    navigationBarBackgroundColor: "#ffffff",
    navigationBarTextStyle: "black",
    backgroundColor: "#f5f6f8"
  },
  tabBar: {
    color: "#8c8c8c",
    selectedColor: "#1677ff",
    backgroundColor: "#ffffff",
    borderStyle: "black",
    list: [
      { pagePath: "pages/consult/index", text: "首页" },
      { pagePath: "pages/report/index", text: "结果" },
      { pagePath: "pages/orders/index", text: "邀请" },
      { pagePath: "pages/profile/index", text: "我的" }
    ]
  },
  style: "v2",
  useExtendedLib: {
    weui: true
  }
};
