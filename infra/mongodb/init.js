const database = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE);
database.createUser({
  user: process.env.MONGO_APP_USERNAME,
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: 'readWrite', db: database.getName() }],
});
for (const collectionName of ['languages', 'zones', 'pois', 'analytics_events', 'poi_density_hourly']) {
  database.createCollection(collectionName);
}
