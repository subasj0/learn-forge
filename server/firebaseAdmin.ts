import { readFileSync } from 'fs';
import path from 'path';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const firebaseConfig = JSON.parse(readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

function getCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return cert(JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')));
  }

  return applicationDefault();
}

const app = getApps()[0] || initializeApp({
  credential: getCredential(),
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
});

const firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);
firestore.settings({ ignoreUndefinedProperties: true });

export const adminAuth = getAuth(app);
export const adminDb = firestore;
export const adminStorage = getStorage(app).bucket(firebaseConfig.storageBucket);
