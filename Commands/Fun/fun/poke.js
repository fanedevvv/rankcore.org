const { actionCommand } = require("./actionHelper");

module.exports = {
  async execute(interaction, client) {
    return actionCommand({
      interaction, client,
      userOptionName: "user",
      apiEndpoint:    "poke",
      actionPast:     "poked",
      buttonLabel:    "Poke back",
      buttonId:       "poke-back",
    });
  },
};