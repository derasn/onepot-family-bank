const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const { checkConnection } = require('./config/db');
const { initializeDatabase } = require('./config/dbInit');

const PORT = process.env.PORT || 5000;

async function startServer() {
  console.log('----------------------------------------------------');
  console.log(' 🍲 Starting OnePot Family Bank API Server...');
  console.log('----------------------------------------------------');

  try {
    const isDbAlive = await checkConnection();
    if (isDbAlive) {
      console.log('✅ Connected to MySQL database successfully.');
      try {
        await initializeDatabase();
      } catch (err) {
        console.warn('⚠️ DB Auto-migration warning:', err.message);
      }
    } else {
      console.warn('⚠️ Note: MySQL database not reachable on startup.');
      console.warn('   Ensure your MySQL server is running and check DB_PASSWORD in backend/.env.');
      console.warn('   You can run "npm run db:init" once your credentials are confirmed.');
    }
  } catch (err) {
    console.warn('⚠️ Database check encountered:', err.message);
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 OnePot API Server running on port ${PORT}`);
    console.log(`📍 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📍 Auth Routes:  http://localhost:${PORT}/api/auth`);
    console.log(`📍 Family:       http://localhost:${PORT}/api/family`);
    console.log(`📍 Bowls:        http://localhost:${PORT}/api/bowls`);
    console.log(`📍 Expenses:     http://localhost:${PORT}/api/expenses`);
    console.log('----------------------------------------------------');
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received. Shutting down server gracefully...');
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

startServer();

