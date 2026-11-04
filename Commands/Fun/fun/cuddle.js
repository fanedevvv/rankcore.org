const { actionCommand } = require("./actionHelper");

module.exports = {
  async execute(interaction, client) {
    return actionCommand({
      interaction, client,
      userOptionName: "user",
      apiEndpoint:    "cuddle",
      actionPast:     "cuddled",
      buttonLabel:    "Cuddle back",
      buttonId:       "cuddle-back",
    });
  },
};