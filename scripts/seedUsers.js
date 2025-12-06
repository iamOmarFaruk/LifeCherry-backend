const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const User = require('../models/User');

const starterUsers = [
  {
    name: 'Anika Rahman',
    email: 'anika.rahman@lifecherry.app',
    photoURL: 'https://i.pravatar.cc/150?img=31',
  },
  {
    name: 'Farhan Islam',
    email: 'farhan.islam@lifecherry.app',
    photoURL: 'https://i.pravatar.cc/150?img=32',
  },
  {
    name: 'Nabila Khan',
    email: 'nabila.khan@lifecherry.app',
    photoURL: 'https://i.pravatar.cc/150?img=33',
  },
  {
    name: 'Tahmid Hasan',
    email: 'tahmid.hasan@lifecherry.app',
    photoURL: 'https://i.pravatar.cc/150?img=34',
  },
  {
    name: 'Mahin Chowdhury',
    email: 'mahin.chowdhury@lifecherry.app',
    photoURL: 'https://i.pravatar.cc/150?img=35',
  },
  {
    name: 'Priya Sultana',
    email: 'priya.sultana@lifecherry.app',
    photoURL: 'https://i.pravatar.cc/150?img=36',
  },
  {
    name: 'Arif Haque',
    email: 'arif.haque@lifecherry.app',
    photoURL: 'https://i.pravatar.cc/150?img=37',
  },
  {
    name: 'Afia Akter',
    email: 'afia.akter@lifecherry.app',
    photoURL: 'https://i.pravatar.cc/150?img=38',
  },
  {
    name: 'Rehan Ahmed',
    email: 'rehan.ahmed@lifecherry.app',
    photoURL: 'https://i.pravatar.cc/150?img=39',
  },
  {
    name: 'Sumaiya Rahim',
    email: 'sumaiya.rahim@lifecherry.app',
    photoURL: 'https://i.pravatar.cc/150?img=40',
  },
];

const run = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const results = await Promise.all(
    starterUsers.map(async ({ name, email, photoURL }) => {
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

      return {
        email,
        upserted: result.upsertedCount > 0,
        modified: result.modifiedCount > 0,
      };
    })
  );

  console.table(results);
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
