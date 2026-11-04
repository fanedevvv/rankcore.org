/**
 * migration_reactionroles.js
 *
 * One-time migration script: converts old flat `rrs` documents
 * (Guild, Message, Emoji, Role) into the new grouped `rr_groups` schema.
 *
 * Run ONCE:
 *   node scripts/migration_reactionroles.js
 *
 * Safe to re-run – skips groups that already exist.
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const { ReactionRoleGroup } = require('../Schemas/reactionrole');

// Legacy schema (read-only)
const LegacyRR = mongoose.model(
  'rrs',
  new mongoose.Schema({ Guild: String, Message: String, Emoji: String, Role: String, Channel: String })
);

async function migrate() {
  await mongoose.connect(process.env.mongodbURL);
  console.log('Connected to MongoDB');

  const all = await LegacyRR.find({});
  console.log(`Found ${all.length} legacy reaction role entries`);

  // Group by Guild+Message
  const map = new Map();
  for (const doc of all) {
    const key = `${doc.Guild}::${doc.Message}`;
    if (!map.has(key)) {
      map.set(key, { Guild: doc.Guild, Message: doc.Message, Channel: doc.Channel || null, entries: [] });
    }
    map.get(key).entries.push({ emoji: doc.Emoji, role: doc.Role });
  }

  console.log(`Grouped into ${map.size} unique messages`);

  let created = 0;
  let skipped = 0;

  for (const [, grp] of map) {
    const exists = await ReactionRoleGroup.findOne({ Guild: grp.Guild, Message: grp.Message });
    if (exists) { skipped++; continue; }

    await ReactionRoleGroup.create({
      Guild:           grp.Guild,
      Channel:         grp.Channel || 'unknown',
      Message:         grp.Message,
      Label:           'Migrated Reaction Role',
      Mode:            'normal',
      RoleLimit:       0,
      CooldownSeconds: 0,
      Entries:         grp.entries,
    });
    created++;
  }

  console.log(`Migration complete: ${created} groups created, ${skipped} already existed`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});