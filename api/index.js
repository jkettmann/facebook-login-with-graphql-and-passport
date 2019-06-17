import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import uuid from 'uuid/v4';
import passport from 'passport';
import FacebookStrategy from 'passport-facebook';
import { ApolloServer } from 'apollo-server-express';
import User from './User';
import typeDefs from './typeDefs';
import resolvers from './resolvers';

const PORT = 4000;
const SESSION_SECRECT = 'bad secret';

const facebookOptions = {
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: 'http://localhost:4000/auth/facebook/callback',
  profileFields: ['id', 'email', 'first_name', 'last_name'],
};

const facebookCallback = (accessToken, refreshToken, profile, done) => {
  const users = User.getUsers();
  const matchingUser = users.find(user => user.facebookId === profile.id);

  if (matchingUser) {
    done(null, matchingUser);
    return;
  }

  const newUser = {
    id: uuid(),
    facebookId: profile.id,
    firstName: profile.name.givenName,
    lastName: profile.name.familyName,
    email: profile.emails && profile.emails[0] && profile.emails[0].value,
  };
  users.push(newUser);
  done(null, newUser);
};

passport.use(new FacebookStrategy(
  facebookOptions,
  facebookCallback,
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const users = User.getUsers();
  const matchingUser = users.find(user => user.id === id);
  done(null, matchingUser);
});

const app = express();

app.use(session({
  genid: (req) => uuid(),
  secret: SESSION_SECRECT,
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', {
  successRedirect: 'http://localhost:4000/graphql',
  failureRedirect: 'http://localhost:4000/graphql',
}));

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => ({
    getUser: () => req.user,
    logout: () => req.logout(),
  }),
  playground: {
    settings: {
      'request.credentials': 'same-origin',
    },
  },
});

server.applyMiddleware({ app });

app.listen({ port: PORT }, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}`);
});