import { app } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);

const server = app.listen(PORT, () => {
  console.info(`Auction House API running on http://localhost:${PORT}`);
});

const shutdown = () => {
  server.close(() => {
    process.exitCode = 0;
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
