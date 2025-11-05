import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { User } from '@elearning/models';

// Serialize user ID into the session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Use LocalStrategy on the `identifier` field (email or phone)
passport.use(
  new LocalStrategy(
    {
      usernameField: 'identifier',
      passwordField: 'password',
    },
    async (identifier, password, done) => {
      try {
        // Look up user by identifier (either email or phone)
        const user = await User.findOne({ identifier });
        if (!user) {
          return done(null, false, { message: 'User not found' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: 'Incorrect password' });
        }

        // Success
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

export default passport;
