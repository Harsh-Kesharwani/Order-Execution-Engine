// src/workers/index.ts
import 'dotenv/config';

// just importing this file registers the BullMQ worker
import './orderWorker';

console.log('Order worker started');
