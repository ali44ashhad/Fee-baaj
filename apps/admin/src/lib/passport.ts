import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { Admin } from '@elearning/models';

passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    const admin = await Admin.findById(id);
    done(null, admin);
});

passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
        try {
            const admin = await Admin.findOne({ email });
            if (!admin) return done(null, false, { message: 'Admin not found' });
            const isMatch = await bcrypt.compare(password, admin.password);
            if (!isMatch) return done(null, false, { message: 'Incorrect password' });
            return done(null, admin);
        } catch (error) {
            return done(error);
        }
    }),
);

export default passport;
