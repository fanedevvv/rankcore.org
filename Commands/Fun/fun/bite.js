const { actionCommand } = require("./actionHelper");

module.exports = {
  async execute(interaction, client) {
    return actionCommand({
      interaction, client,
      userOptionName: "user",
      apiEndpoint:    "bite",
      actionPast:     "bit",
      buttonLabel:    "Bite back",
      buttonId:       "bite-back",
    });
  },
};