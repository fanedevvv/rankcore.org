const { actionCommand } = require("./actionHelper");

module.exports = {
  async execute(interaction, client) {
    return actionCommand({
      interaction, client,
      userOptionName: "user",
      apiEndpoint:    "hug",
      actionPast:     "hugged",
      buttonLabel:    "Hug back",
      buttonId:       "hug-back",
    });
  },
};