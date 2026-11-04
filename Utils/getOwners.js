const OwnerSchema = require("../Schemas/owner.js");

const PERMANENT_OWNER = process.env.OWNER_ID;

module.exports = async function getOwners() {
    let data = await OwnerSchema.findOne();

    if (!data) {
        data = await OwnerSchema.create({
            owners: [PERMANENT_OWNER].filter(Boolean),
        });
        return data.owners;
    }

    // Force permanent owner to always exist
    if (PERMANENT_OWNER && !data.owners.includes(PERMANENT_OWNER)) {
        data.owners.push(PERMANENT_OWNER);
        await data.save();
    }

    return data.owners;
};
