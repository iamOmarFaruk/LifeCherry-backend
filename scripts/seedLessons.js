const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Lesson = require('../models/Lesson');
const User = require('../models/User');

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

const lessons = [
  {
    title: 'Saying No Made Space For Yes',
    description:
      'For years I said yes to everything until burnout forced a reset. Learning to say no to misaligned work and draining social plans created room for deep work, real rest, and relationships that matter.',
    category: 'Personal Growth',
    emotionalTone: 'Realization',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'free',
    isFeatured: true,
    isReviewed: true,
  },
  {
    title: 'Failure Was A Draft, Not The Final',
    description:
      'I treated my first startup collapse like a verdict. Reframing it as a draft let me mine the data, rebuild my routines, and ship a calmer second attempt that actually served customers.',
    category: 'Career',
    emotionalTone: 'Motivational',
    image: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'free',
    isFeatured: true,
    isReviewed: true,
  },
  {
    title: 'Letting Go To Grow',
    description:
      'Ending a five-year relationship felt like failure. It became a start line. The quiet after goodbye let me hear my own voice, choose healthier friendships, and rebuild self-respect.',
    category: 'Relationships',
    emotionalTone: 'Realization',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'premium',
    isFeatured: false,
    isReviewed: true,
  },
  {
    title: 'Rest Became My Productivity Stack',
    description:
      'I once worshipped all-nighters. Burnout taught me that sleep, walks, and boundaries are performance multipliers. Now my calendar protects recovery as fiercely as meetings.',
    category: 'Mindset',
    emotionalTone: 'Gratitude',
    image: 'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'free',
    isFeatured: true,
    isReviewed: true,
  },
  {
    title: 'The Mistake That Pointed North',
    description:
      'Leaving a prestigious program felt reckless. It redirected me toward design, where curiosity and craft finally aligned. Regret turned into a compass for future choices.',
    category: 'Mistakes Learned',
    emotionalTone: 'Realization',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'free',
    isFeatured: false,
    isReviewed: true,
  },
  {
    title: 'Gratitude As A Lens',
    description:
      'A simple practice of listing three good things each morning shrank my anxiety. The facts of my life did not change; the frame I viewed them through did.',
    category: 'Personal Growth',
    emotionalTone: 'Gratitude',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'premium',
    isFeatured: false,
    isReviewed: true,
  },
  {
    title: 'Communication Saved Us',
    description:
      'We drifted into parallel lives until a counselor gave us scripts for honest listening. Naming resentments without blame turned roommates back into partners.',
    category: 'Relationships',
    emotionalTone: 'Motivational',
    image: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'free',
    isFeatured: false,
    isReviewed: true,
  },
  {
    title: 'Quitting The Dream Job',
    description:
      'I left a glossy title that looked great on LinkedIn but hollowed me out. Trading prestige for autonomy restored my health and let me build work that matches my values.',
    category: 'Career',
    emotionalTone: 'Realization',
    image: 'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'premium',
    isFeatured: false,
    isReviewed: true,
  },
  {
    title: 'Adversity Clarified My Priorities',
    description:
      'A health scare forced me to audit everything. I cut busywork, deepened friendships, and found meaning in mentoring others walking similar roads.',
    category: 'Mindset',
    emotionalTone: 'Motivational',
    image: 'https://images.unsplash.com/photo-1493836512294-502baa1986e2?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'free',
    isFeatured: true,
    isReviewed: true,
  },
  {
    title: 'Forgiving Myself To Move Forward',
    description:
      'I carried guilt from early parenting mistakes. Owning them, apologizing, and choosing better patterns freed me from shame and rebuilt trust at home.',
    category: 'Personal Growth',
    emotionalTone: 'Sad',
    image: 'https://images.unsplash.com/photo-1476234251651-f353703a034d?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'free',
    isFeatured: false,
    isReviewed: true,
  },
  {
    title: 'Escaping The Comparison Trap',
    description:
      'A 30-day social detox revealed how much joy I traded for scrolling. Returning with boundaries let me use social media as a tool instead of a mirror.',
    category: 'Mindset',
    emotionalTone: 'Realization',
    image: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'free',
    isFeatured: false,
    isReviewed: true,
  },
  {
    title: 'Money Could Not Buy Calm',
    description:
      'I chased salary until my health buckled. Shifting to work that traded some income for sane hours gave me back sleep, friendships, and a steady pulse.',
    category: 'Mistakes Learned',
    emotionalTone: 'Realization',
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'premium',
    isFeatured: false,
    isReviewed: true,
  },
  {
    title: 'Mentorship Over Metrics',
    description:
      'My best career move was seeking mentors, not raises. Honest feedback and shared playbooks cut years off my learning curve.',
    category: 'Career',
    emotionalTone: 'Motivational',
    image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'free',
    isFeatured: true,
    isReviewed: true,
  },
  {
    title: 'Boundaries Brought Back Joy',
    description:
      'I stopped being available 24/7 to clients. Surprisingly, respect increased and projects improved because everyone planned better.',
    category: 'Personal Growth',
    emotionalTone: 'Realization',
    image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'free',
    isFeatured: false,
    isReviewed: true,
  },
  {
    title: 'Choosing Community Over Comfort',
    description:
      'Joining a local maker group felt awkward at first. It became my support system during layoffs and fueled collaborations I never expected.',
    category: 'Relationships',
    emotionalTone: 'Motivational',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'free',
    isFeatured: false,
    isReviewed: true,
  },
  {
    title: 'Slow Mornings, Better Decisions',
    description:
      'Replacing doomscrolling with a 20-minute walk and journal made my days calmer. Decisions moved from reactive to intentional.',
    category: 'Mindset',
    emotionalTone: 'Gratitude',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'premium',
    isFeatured: false,
    isReviewed: true,
  },
  {
    title: 'Rebuilding After A Career Pivot',
    description:
      'Starting over in my thirties scared me. Informational interviews and small freelance projects lowered the risk and proved I could learn new tools fast.',
    category: 'Career',
    emotionalTone: 'Motivational',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'free',
    isFeatured: false,
    isReviewed: true,
  },
  {
    title: 'Listening As Leadership',
    description:
      'As a new manager I over-explained. When I started asking open questions first, my team solved problems faster and trust grew.',
    category: 'Career',
    emotionalTone: 'Realization',
    image: 'https://images.unsplash.com/photo-1483478550801-ceba5fe50e8e?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'free',
    isFeatured: true,
    isReviewed: true,
  },
  {
    title: 'The Power Of Tiny Habits',
    description:
      'Five-minute habits rebuilt my confidence after burnout. One push-up, one paragraph, one message to a friend—it stacked into momentum.',
    category: 'Personal Growth',
    emotionalTone: 'Motivational',
    image: 'https://images.unsplash.com/photo-1481833761820-0509d3217039?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'free',
    isFeatured: true,
    isReviewed: true,
  },
  {
    title: 'Naming The Fear, Shrinking The Fear',
    description:
      'Writing down exactly what I was afraid of before a big pitch reduced the monster to a checklist. Most risks were manageable once named.',
    category: 'Mindset',
    emotionalTone: 'Realization',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop',
    visibility: 'public',
    accessLevel: 'premium',
    isFeatured: false,
    isReviewed: true,
  },
];

const assignCreators = () => {
  return lessons.map((lesson, idx) => {
    const user = starterUsers[idx % starterUsers.length];
    return {
      ...lesson,
      creatorEmail: user.email.toLowerCase(),
      creatorName: user.name,
      creatorPhoto: user.photoURL,
    };
  });
};

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set in .env');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // ensure users exist for creators
  await User.bulkWrite(
    starterUsers.map((u) => ({
      updateOne: {
        filter: { email: u.email.toLowerCase() },
        update: {
          $set: {
            name: u.name,
            email: u.email.toLowerCase(),
            photoURL: u.photoURL,
            role: 'user',
            isPremium: false,
          },
        },
        upsert: true,
      },
    }))
  );

  const payload = assignCreators();
  const operations = payload.map((lesson) => ({
    updateOne: {
      filter: { title: lesson.title, creatorEmail: lesson.creatorEmail },
      update: { $set: lesson },
      upsert: true,
    },
  }));

  const result = await Lesson.bulkWrite(operations);
  console.log('Lessons upserted:', result.upsertedCount || 0, 'modified:', result.modifiedCount || 0);
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
