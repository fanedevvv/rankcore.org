const { DiscordAPIError } = require("discord.js");

module.exports = () => {
    // ===============================
    // UNHANDLED PROMISE REJECTIONS
    // ===============================
    process.on("unhandledRejection", (reason) => {
        if (reason instanceof DiscordAPIError) {
            console.warn("[API SHIELD] DiscordAPIError swallowed");
            console.warn(` ├─ Code: ${reason.code}`);
            console.warn(` ├─ Message: ${reason.message}`);
            return;
        }

        if (reason?.name === "AbortError") return;
        if (reason?.message?.includes("ECONNRESET")) return;
        if (reason?.message?.includes("Unknown interaction")) return;

        console.error("[UNHANDLED REJECTION]", reason);
    });

    // ===============================
    // UNCAUGHT EXCEPTIONS
    // ===============================
    process.on("uncaughtException", (err) => {
        if (err instanceof DiscordAPIError) {
            console.warn("[API SHIELD] DiscordAPIError uncaughtException swallowed");
            console.warn(` ├─ Code: ${err.code}`);
            console.warn(` └─ Message: ${err.message}`);
            return;
        }

        console.error("[UNCAUGHT EXCEPTION]", err);
    });


    console.log("[API SHIELD] Global Discord API protection ENABLED");
};