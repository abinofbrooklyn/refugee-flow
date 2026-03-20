/**
 * Add optional border region breakdown columns to ibc_crossings.
 * Used by CBP Americas data to show Southwest vs Northern land border split.
 * Nullable — Frontex routes leave these as null (single border_location).
 */
exports.up = async (knex) => {
  await knex.schema.alterTable('ibc_crossings', (t) => {
    t.integer('count_southwest').nullable();
    t.integer('count_northern').nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('ibc_crossings', (t) => {
    t.dropColumn('count_southwest');
    t.dropColumn('count_northern');
  });
};
