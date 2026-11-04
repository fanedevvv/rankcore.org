const { actionCommand } = require("./actionHelper");

module.exports = {
  async execute(interaction, client) {
    return actionCommand({
      interaction, client,
      userOptionName: "user",
      apiEndpoint:    "pat",
      actionPast:     "patted",
      buttonLabel:    "Pat back",
      buttonId:       "pat-back",
    });
  },
};