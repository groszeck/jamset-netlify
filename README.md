import { migrate, closeClient } from './netlify/functions/neonclient.js';
await migrate();
await closeClient();