const remindSchema = require("../Schemas/remindSchema");

module.exports = (client) => {
  setInterval(async () => {
    try {
      const reminders = await remindSchema.find();
      if (!reminders || reminders.length === 0) return;

      reminders.forEach(async (reminder) => {
        if (reminder.Time > Date.now()) return;

        const user = await client.users.fetch(reminder.User).catch(() => null);
        if (!user) {
          // If the user is not found, delete the reminder
          await remindSchema.deleteMany({
            Time: reminder.Time,
            User: reminder.User,
            Remind: reminder.Remind,
          });
          return;
        }

        // Send the reminder DM
        await user
          .send({
            content: `${user}, you asked me to remind you about: \`${reminder.Remind}\``,
          })
          .catch(() => {
            // If the DM fails, delete the reminder
            remindSchema.deleteMany({
              Time: reminder.Time,
              User: user.id,
              Remind: reminder.Remind,
            });
          });

        // Delete the reminder after sending
        await remindSchema.deleteMany({
          Time: reminder.Time,
          User: user.id,
          Remind: reminder.Remind,
        });
      });
    } catch (error) {
      console.error("Error in reminder system:", error);
    }
  }, 1000 * 5); // Check every 5 seconds
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */