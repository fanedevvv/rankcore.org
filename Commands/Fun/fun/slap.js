const { actionCommand } = require("./actionHelper");

module.exports = {
  async execute(interaction, client) {
    return actionCommand({
      interaction, client,
      userOptionName: "target",
      apiEndpoint:    "slap",
      actionPast:     "slapped",
      buttonLabel:    "Slap back",
      buttonId:       "slap-back",
    });
  },
};