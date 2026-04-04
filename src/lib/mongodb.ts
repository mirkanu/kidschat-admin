import { MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let _prodClient: Promise<MongoClient> | undefined;

/**
 * Returns a connected MongoClient promise. Lazily initialized on first call
 * so the module can be imported at build time without MONGODB_URI present.
 */
export function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    return global._mongoClientPromise;
  }

  if (!_prodClient) {
    _prodClient = new MongoClient(uri).connect();
  }
  return _prodClient;
}

export default getMongoClient;
