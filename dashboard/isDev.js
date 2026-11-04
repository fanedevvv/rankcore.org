// middleware/isDev.js
const getOwners = require("../Utils/getOwners");

module.exports = async (req, res, next) => {
  if (!req.user) return res.status(401).send("Not authenticated");

  try {
    const owners = await getOwners();
    if (!owners.includes(req.user.id)) {
      return res.status(403).send("Access denied");
    }
    next();
  } catch (err) {
    console.error("Failed to verify owner:", err);
    res.status(500).send("Server error");
  }
};
