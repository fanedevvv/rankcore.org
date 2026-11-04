// ─────────────────────────────────────────────────────────────────────────────
// ticketManage.js — DEPRECATED / SUPERSEDED
//
// This file was the original monolithic interactionCreate handler for the
// ticket-manage-menu select menu. It has been replaced by the modular
// handleManageMember() function in ticketManagement.js, which is registered
// via the ticketActions/index.js router.
//
// This file is intentionally left as a no-op to avoid duplicate event
// registration and conflicts with the new system. Do NOT re-enable it.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // No-op: handled by ticketActions/index.js → ticketManagement.js
        return;
    }
};