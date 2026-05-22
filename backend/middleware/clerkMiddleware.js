const { clerkClient } = require('@clerk/clerk-sdk-node');
const User = require('../models/userModel');
const generateToken = require('../utils/generateToken');

// Middleware to verify Clerk token and login/register the user in our DB
const clerkAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no Clerk token' });
  }

  try {
    // 1. Verify token with Clerk
    const client = clerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const decodedToken = await client.verifyToken(token);
    const clerkUserId = decodedToken.sub;

    // 2. Get user details from Clerk
    const clerkUser = await client.users.getUser(clerkUserId);
    const email = clerkUser.emailAddresses[0].emailAddress;
    const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();

    // 3. Find or Create User in our DB
    let user = await User.findOne({ clerkId: clerkUserId });
    
    if (!user) {
      // Check if user exists by email (if they registered via custom JWT previously)
      user = await User.findOne({ email });
      
      if (user) {
        // Link Clerk ID to existing user
        user.clerkId = clerkUserId;
        await user.save();
      } else {
        // Create brand new user
        user = await User.create({
          name: name || 'Clerk User',
          email,
          clerkId: clerkUserId
        });
      }
    }

    // 4. Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Clerk Auth Error:', error);
    res.status(401).json({ message: 'Not authorized, invalid Clerk token' });
  }
};

module.exports = { clerkAuth };
