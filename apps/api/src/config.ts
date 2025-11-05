import * as env from 'dotenv';

env.config();

export default {
  api: {
    port: process.env.PORT,
    name: process.env.APP_NAME,
    url: process.env.APP_URL,
  },

  web: {
    url: process.env.WEB_URL || 'http://localhost:3000',
  },

  db: {
    name: process.env.DB_NAME,
    url: process.env.DB_URL,
  }, 

  jwt: {
    expiresAt: parseInt(process.env.JWT_EXPIRES_IN || '24'),
    secret: process.env.JWT_SECRET || 'testingdev123',
  },

  mail: {
    service: process.env.MAIL_SERVICE,
    username: process.env.MAIL_USERNAME,
    password: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM,
  },
  bunny:{
    BUNNY_HOST_NAME: process.env.BUNNY_HOST_NAME,
    BUNNY_IMG_HOSTNAME: process.env.BUNNY_IMG_HOSTNAME,
    BUNNY_IMAGE_STORAGE_API_KEY: process.env.BUNNY_IMAGE_STORAGE_API_KEY,
    BUNNY_STORAGE_ZONE: process.env.BUNNY_STORAGE_ZONE,
    BUNNY_VIDEO_LIBRARY_ID: process.env.BUNNY_VIDEO_LIBRARY_ID,
    BUNNY_STREAM_API_KEY: process.env.BUNNY_STREAM_API_KEY,
    BUNNY_STREAM_VIDEO_TOKEN: process.env.BUNNY_STREAM_VIDEO_TOKEN
  },
};
