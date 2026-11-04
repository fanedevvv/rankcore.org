const { Schema, model } = require('mongoose');

// Maps Discord role IDs to dashboard sections they can access.
// Users with MANAGE_GUILD always have full access.
// Users without MANAGE_GUILD can access only the sections their roles permit.
// The permissions array allows finer-grained action-level control within a section
// (e.g. view error logs but not clear them).
const dashboardRolesSchema = new Schema({
  guildId: { type: String, required: true, unique: true },

  // Array of role permission entries
  roles: [{
    roleId:   { type: String, required: true },
    roleName: { type: String, default: '' },        // cached for display
    sections: { type: [String], default: [] },       // sidebar page IDs they can access
    // Fine-grained action permissions per section.
    // If empty/missing for a section, all actions are allowed (backwards compat).
    permissions: [{
      section: { type: String, required: true },
      actions: { type: [String], default: [] },      // allowed action keys; [] = all
    }],
  }],
}, { timestamps: true });

module.exports = model('DashboardRoles', dashboardRolesSchema);