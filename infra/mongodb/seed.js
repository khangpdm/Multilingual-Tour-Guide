const database = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE);
database.auth(process.env.MONGO_APP_USERNAME, process.env.MONGO_APP_PASSWORD);
const seedTag = 'tourism-local-demo-v1';
const timestamp = new Date();
const vietnamese = {
  language: 'Ti\u1ebfng Vi\u1ec7t',
  riverside: 'Khu ven s\u00f4ng (demo)',
  oldTown: 'Khu ph\u1ed1 c\u0169 (demo)',
  park: 'C\u00f4ng vi\u00ean ven s\u00f4ng (demo)',
  square: 'Qu\u1ea3ng tr\u01b0\u1eddng (demo)',
  museum: 'B\u1ea3o t\u00e0ng nh\u1ecf (demo)',
  cafe: 'Qu\u00e1n c\u00e0 ph\u00ea (demo)',
  description: 'D\u1eef li\u1ec7u gi\u1ea3 l\u1eadp \u0111\u1ec3 ki\u1ec3m th\u1eed. Kh\u00f4ng ph\u1ea3i th\u00f4ng tin du l\u1ecbch th\u1ef1c t\u1ebf.',
};
const languages = [
  { _id: 'vi', code: 'vi', name: 'Vietnamese', native_name: vietnamese.language, is_active: true, is_default: true, display_order: 1 },
  { _id: 'en', code: 'en', name: 'English', native_name: 'English', is_active: true, is_default: false, display_order: 2 },
  { _id: 'ja', code: 'ja', name: 'Japanese', native_name: '\u65e5\u672c\u8a9e', is_active: true, is_default: false, display_order: 3 },
];
if (database.languages.findOne({ is_default: true })) languages[0].is_default = false;
const zones = [
  { _id: 'demo_zone_riverside', zone_id: 'demo_zone_riverside', name: vietnamese.riverside, map_region: { bbox: [106.710, 10.770, 106.720, 10.780], min_zoom: 13, max_zoom: 18 }, is_active: true, poi_count: 2 },
  { _id: 'demo_zone_old_town', zone_id: 'demo_zone_old_town', name: vietnamese.oldTown, map_region: { bbox: [106.695, 10.770, 106.705, 10.780], min_zoom: 13, max_zoom: 18 }, is_active: true, poi_count: 2 },
];
function content(name, text) {
  return { name, address: 'Demo location - not a real destination', text, audio_url: null, audio_sha256: null, audio_source: null, is_edited: false, updated_at: timestamp };
}
const definitions = [
  ['demo_poi_park', zones[0]._id, vietnamese.park, 'Riverside park (demo)', '\u516c\u5712 (demo)', 'park', 106.714, 10.774],
  ['demo_poi_square', zones[0]._id, vietnamese.square, 'Town square (demo)', '\u5e83\u5834 (demo)', 'landmark', 106.716, 10.776],
  ['demo_poi_museum', zones[1]._id, vietnamese.museum, 'Small museum (demo)', '\u535a\u7269\u9928 (demo)', 'museum', 106.699, 10.774],
  ['demo_poi_cafe', zones[1]._id, vietnamese.cafe, 'Coffee shop (demo)', '\u30ab\u30d5\u30a7 (demo)', 'cafe', 106.701, 10.776],
];
const pois = definitions.map(([poiId, zoneId, nameVi, nameEn, nameJa, category, longitude, latitude]) => ({
  _id: poiId,
  poi_id: poiId,
  zone_id: zoneId,
  category,
  location: { type: 'Point', coordinates: [longitude, latitude] },
  geofence_radius_m: 30,
  qr_code: `DEMO-${poiId}`,
  status: 'active',
  images: [],
  content: {
    vi: content(nameVi, vietnamese.description),
    en: content(nameEn, 'Fictional test data. This is not a real travel destination.'),
    ja: content(nameJa, '\u30c6\u30b9\u30c8\u7528\u306e\u67b6\u7a7a\u306e\u30c7\u30fc\u30bf\u3067\u3059\u3002'),
  },
  last_modified_by: 'local-demo-seed',
}));
for (const [collectionName, documents] of [['languages', languages], ['zones', zones], ['pois', pois]]) {
  const result = database.getCollection(collectionName).bulkWrite(documents.map(document => ({
    updateOne: {
      filter: { _id: document._id },
      update: { $setOnInsert: { ...document, is_demo: true, seed_tag: seedTag, created_at: timestamp, updated_at: timestamp } },
      upsert: true,
    },
  })));
  print(`${collectionName}: inserted=${result.upsertedCount}, matched=${result.matchedCount}`);
}
