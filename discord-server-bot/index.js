require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const FileStore = require('session-file-store')(session);
const path = require('path');
const client = require('./bot/client');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const wsServer = require('./ws/server');

if (
  !process.env.DISCORD_CLIENT_ID ||
  !process.env.DISCORD_CLIENT_SECRET ||
  !process.env.SESSION_SECRET
) {
  console.error(
    '[Web] Error: Required environment variables for dashboard authentication are missing.'
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: `http://localhost:${PORT}/auth/discord/callback`,
      scope: ['identify', 'guilds'],
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }
  )
);

app.use(
  session({
    store: new FileStore({ path: path.join(__dirname, '.sessions'), ttl: 86400 }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.client = client;
  next();
});

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
  } else {
    res.sendFile(path.join(__dirname, 'login.html'));
  }
});

app.post('/api/log-error', (req, res) => {
  console.error('[Frontend Error]', req.body);
  res.status(204).send();
});

const server = app.listen(PORT, () => {
  console.log(`[Web] Dashboard is running at http://localhost:${PORT}`);
});

wsServer.init(server);

// UI improvement: Broadcast new messages to the dashboard
client.on('messageCreate', (message) => {
  if (message.author.bot) return; // Ignore bot messages

  const messageData = {
    id: message.id,
    content: message.content,
    author: {
      id: message.author.id,
      username: message.author.username,
      avatarURL: message.author.displayAvatarURL(),
    },
    timestamp: message.createdAt,
    guildId: message.guild.id,
    channelId: message.channel.id,
  };

  wsServer.broadcastNewMessage(messageData);
});

client.login(process.env.DISCORD_TOKEN);
