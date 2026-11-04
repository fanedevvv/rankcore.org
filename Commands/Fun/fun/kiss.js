const { actionCommand } = require("./actionHelper");

module.exports = {
  async execute(interaction, client) {
    return actionCommand({
      interaction, client,
      userOptionName: "user",
      apiEndpoint:    "kiss",
      actionPast:     "kissed",
      buttonLabel:    "Kiss back",
      buttonId:       "kiss-back",
    });
  },
};