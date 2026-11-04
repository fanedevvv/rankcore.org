const { actionCommand } = require("./actionHelper");

module.exports = {
  async execute(interaction, client) {
    return actionCommand({
      interaction, client,
      userOptionName: "user",
      apiEndpoint:    "tickle",
      actionPast:     "tickled",
      buttonLabel:    "Tickle back",
      buttonId:       "tickle-back",
    });
  },
};