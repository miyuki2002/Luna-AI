import { Db, MongoClient } from "mongodb";
import { config as loadEnv } from "dotenv";
import path from "node:path";

if (!process.env.MONGODB_URI) {
  const rootEnvPath = path.resolve(process.cwd(), "..", ".env");
  loadEnv({ path: rootEnvPath });
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

if (!uri) {
  throw new Error(
    "MONGODB_URI chưa được cấu hình. Hãy thêm biến môi trường vào .env.local."
  );
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const client = new MongoClient(uri);
const clientPromise =
  global._mongoClientPromise ?? client.connect();

if (process.env.NODE_ENV !== "production") {
  global._mongoClientPromise = clientPromise;
}

let cachedDb: Db | null = null;

export async function getDb(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }

  const connectedClient = await clientPromise;
  cachedDb = dbName
    ? connectedClient.db(dbName)
    : connectedClient.db();

  return cachedDb;
}
