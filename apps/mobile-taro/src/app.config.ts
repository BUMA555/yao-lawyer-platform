export default {
  pages: [
    "pages/consult/index",
    "pages/consult/scenes/index",
    "pages/consult/intake/index",
    "pages/report/index",
    "pages/report/deep/index",
    "pages/orders/index",
    "pages/profile/index"
  ],
  window: {
    navigationBarTitleText: "姚律师",
    navigationBarBackgroundColor: "#eaea00",
    navigationBarTextStyle: "black",
    backgroundColor: "#f6f6f6"
  },
  tabBar: {
    color: "#080808",
    selectedColor: "#bb0100",
    backgroundColor: "#fffdfa",
    borderStyle: "black",
    list: [
      { pagePath: "pages/consult/index", text: "问姚律师" },
      { pagePath: "pages/report/index", text: "结果" },
      { pagePath: "pages/orders/index", text: "算力" },
      { pagePath: "pages/profile/index", text: "我的" }
    ]
  }
};
