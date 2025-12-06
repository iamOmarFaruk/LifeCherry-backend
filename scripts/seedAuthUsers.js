const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { admin } = require('../config/firebase');
const User = require('../models/User');

const PASSWORD = 'dummylogin';

const starterUsers = [
  { name: 'Anika Rahman', email: 'anika.rahman@lifecherry.app', photoURL: 'https://i.pravatar.cc/150?img=31' },
  { name: 'Farhan Islam', email: 'farhan.islam@lifecherry.app', photoURL: 'https://i.pravatar.cc/150?img=32' },
  { name: 'Nabila Khan', email: 'nabila.khan@lifecherry.app', photoURL: 'https://i.pravatar.cc/150?img=33' },
  { name: 'Tahmid Hasan', email: 'tahmid.hasan@lifecherry.app', photoURL: 'https://i.pravatar.cc/150?img=34' },
  { name: 'Mahin Chowdhury', email: 'mahin.chowdhury@lifecherry.app', photoURL: 'https://i.pravatar.cc/150?img=35' },
  { name: 'Priya Sultana', email: 'priya.sultana@lifecherry.app', photoURL: 'https://i.pravatar.cc/150?img=36' },
  { name: 'Arif Haque', email: 'arif.haque@lifecherry.app', photoURL: 'https://i.pravatar.cc/150?img=37' },
  { name: 'Afia Akter', email: 'afia.akter@lifecherry.app', photoURL: 'https://i.pravatar.cc/150?img=38' },
  { name: 'Rehan Ahmed', email: 'rehan.ahmed@lifecherry.app', photoURL: 'https://i.pravatar.cc/150?img=39' },
  { name: 'Sumaiya Rahim', email: 'sumaiya.rahim@lifecherry.app', photoURL: 'https://i.pravatar.cc/150?img=40' },
];

const ensureFirebaseUser = async ({ name, email, photoURL }) => {
  try {
    const existing = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(existing.uid, {
      displayName: name,
      photoURL,
      password: PASSWORD,
      emailVerified: true,
    });
    return { uid: existing.uid, created: false };
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const created = await admin.auth().createUser({
      email,
      password: PASSWORD,
      displayName: name,
      photoURL,
      emailVerified: true,
    });
    return { uid: created.uid, created: true };
  }
};

const upsertDbUser = async ({ name, email, photoURL }) => {
  const result = await User.updateOne(
    { email: email.toLowerCase() },
    {
      $set: {
        name,
        email: email.toLowerCase(),
        photoURL,
        role: 'user',
        isPremium: false,
      },
    },
    { upsert: true }
  );
  return { upserted: result.upsertedCount > 0, modified: result.modifiedCount > 0 };
};

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set in .env');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const rows = [];
  for (const user of starterUsers) {
    const fb = await ensureFirebaseUser(user);
    const db = await upsertDbUser(user);
    rows.push({ email: user.email, firebaseCreated: fb.created, dbUpserted: db.upserted, dbModified: db.modified });
  }

  console.table(rows);
};

run()
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  });
