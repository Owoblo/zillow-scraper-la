#!/usr/bin/env node

// Redis Setup Script for Enterprise System
import Redis from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
};

async function setupRedis() {
  console.log('🔧 Setting up Redis for enterprise system...');
  
  const redis = new Redis(redisConfig);
  
  try {
    // Test connection
    await redis.ping();
    console.log('✅ Redis connection successful');
    
    // Clear existing queues (for fresh start)
    const keys = await redis.keys('bull:*');
    if (keys.length > 0) {
      console.log(`🧹 Clearing ${keys.length} existing queue keys...`);
      await redis.del(...keys);
      console.log('✅ Existing queues cleared');
    }
    
    // Set up initial configuration
    await redis.set('enterprise:setup:timestamp', Date.now());
    await redis.set('enterprise:setup:version', '1.0.0');
    
    console.log('✅ Redis setup completed successfully');
    console.log('📊 Redis info:');
    console.log(`   - Host: ${redisConfig.host}`);
    console.log(`   - Port: ${redisConfig.port}`);
    console.log(`   - Password: ${redisConfig.password ? 'Set' : 'Not set'}`);
    
  } catch (error) {
    console.error('❌ Redis setup failed:', error.message);
    console.log('\n💡 To fix this:');
    console.log('1. Install Redis: brew install redis (macOS) or apt-get install redis (Ubuntu)');
    console.log('2. Start Redis: redis-server');
    console.log('3. Or use Docker: docker run -d -p 6379:6379 redis:alpine');
    process.exit(1);
  } finally {
    await redis.disconnect();
  }
}

// Run setup
setupRedis();
