const { actionCommand } = require("./actionHelper");

module.exports = {
  async execute(interaction, client) {
    return actionCommand({
      interaction, client,
      userOptionName: "user",
      apiEndpoint:    "lick",
      actionPast:     "licked",
      buttonLabel:    "Lick back",
      buttonId:       "lick-back",
    });
  },
};