const EPHEMERAL_FLAG = 1 << 6; // 64

function patchMethod(obj, method) {
    const original = obj[method];

    obj[method] = function (options, ...args) {
        if (options?.ephemeral === true) {
            delete options.ephemeral;
            options.flags ??= EPHEMERAL_FLAG;
        }
        return original.call(this, options, ...args);
    };
}

module.exports = (client) => {
    client.on('interactionCreate', (interaction) => {
        if (!interaction?.reply) return;

        patchMethod(interaction, 'reply');
        patchMethod(interaction, 'editReply');
        patchMethod(interaction, 'followUp');
    });
};
