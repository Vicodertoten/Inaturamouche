import Dexie from 'dexie';

export const DB_NAME = 'inaturamouche-collection';
export const DB_VERSION = 3;

const db = new Dexie(DB_NAME);

db.version(DB_VERSION).stores({
  species:
    'id, name, preferred_common_name, iconic_taxon_id, rank, *ancestor_ids, square_url, small_url, medium_url, thumbnail',
  stats: 'id, seenCount, correctCount, lastSeenAt, accuracy',
  taxon_groups: 'id, name, rank, parent_id',
});

export const speciesTable = db.table('species');
export const statsTable = db.table('stats');
export const taxonGroupsTable = db.table('taxon_groups');

export default db;
