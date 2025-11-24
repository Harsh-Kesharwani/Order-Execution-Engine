# Order Execution Engine - Mock DEX Router

A TypeScript-based order execution system that simulates decentralized exchange (DEX) routing with real-time WebSocket status updates and concurrent order processing.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Order Type Selection](#order-type-selection)
- [System Architecture](#system-architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [WebSocket Integration](#websocket-integration)
- [Testing](#testing)
- [Design Decisions](#design-decisions)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Demo Video](#demo-video)

---

## Overview

This project implements a production-ready order execution engine that processes market orders through simulated DEX routing. The system compares prices across Raydium and Meteora pools, selects optimal execution venues, and provides real-time status updates via WebSocket connections.

**Key Features:**
- Market order execution with instant price matching
- Multi-DEX routing (Raydium & Meteora simulation)
- Real-time order status streaming via WebSockets
- Concurrent order processing (up to 10 simultaneous orders)
- Queue-based architecture with retry logic
- Full order history persistence

---

## Order Type Selection

**Selected Order Type: Market Order**

Market orders were chosen for this implementation because they represent the most straightforward execution model—immediate execution at the best available price. This allows the demonstration of core routing logic without the complexity of price monitoring or event triggers.

**Extension Path:**
- **Limit Orders**: Add price threshold monitoring and conditional execution triggers. Orders would remain in a "watching" state until market price meets the specified limit.
- **Sniper Orders**: Integrate token launch detection mechanisms and migration event listeners, executing trades immediately upon detecting new liquidity pool creation.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Client Application                     │
│              (Postman / Frontend / Mobile)                │
└───────────────┬─────────────────┬────────────────────────┘
                │                 │
         HTTP POST               WebSocket
                │                 │
┌───────────────▼─────────────────▼────────────────────────┐
│              Fastify Server (Port 3000)                   │
│  ┌────────────────────┐      ┌─────────────────────┐    │
│  │   REST Endpoints   │      │  WebSocket Handler  │    │
│  │  /api/orders/...   │      │   Subscribe/Emit    │    │
│  └──────────┬─────────┘      └──────────┬──────────┘    │
└─────────────┼────────────────────────────┼───────────────┘
              │                            │
              ▼                            ▼
┌─────────────────────────┐    ┌──────────────────────┐
│     BullMQ Queue        │◄───┤   Redis (Message     │
│   (Order Processing)    │    │    Bus & Cache)      │
└──────────┬──────────────┘    └──────────────────────┘
           │
           │ Process Order
           ▼
┌─────────────────────────────────────────────────────────┐
│              Mock DEX Router Service                     │
│  ┌──────────────────┐      ┌─────────────────────┐     │
│  │ Raydium Quotes   │      │  Meteora Quotes     │     │
│  │ (Simulated)      │      │  (Simulated)        │     │
│  └──────────────────┘      └─────────────────────┘     │
│              Route Selection & Execution                 │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
           ┌────────────────────────┐
           │   PostgreSQL Database  │
           │   (Order History &     │
           │    Status Tracking)    │
           └────────────────────────┘
```

**Data Flow:**
1. Client submits order via POST request → Server validates & returns orderId
2. Order enqueued in BullMQ → Worker picks up job
3. Worker queries both DEX routers → Compares prices
4. Best route selected → Transaction simulated
5. Status updates published to Redis → WebSocket broadcasts to subscribers
6. Final state persisted to PostgreSQL

---

## Prerequisites

Ensure the following are installed on your system:

- **Node.js** >= 18.x
- **npm** >= 9.x
- **Docker** & **Docker Compose**
- **Git**

---

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/Harsh-Kesharwani/Order-Execution-Engine.git
cd Order-Execution-Engine
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Initialize Infrastructure

Start Redis and PostgreSQL using Docker Compose:

```bash
docker-compose up -d
```

Verify containers are running:

```bash
docker ps
# Should show: postgres, redis
```

---

## Configuration

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# PostgreSQL Database
PG_HOST=localhost
PG_PORT=5432
PG_USER=order_user
PG_PASSWORD=order_pass
PG_DATABASE=orders_db

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Queue Settings
MAX_CONCURRENT_ORDERS=10
ORDER_RETRY_ATTEMPTS=3
ORDER_RETRY_DELAY_MS=1000

# Mock DEX Settings
RAYDIUM_LATENCY_MS=200
METEORA_LATENCY_MS=200
EXECUTION_DELAY_MS=2500
```

---

## Running the Application

### Development Mode

**Terminal 1** - Start the API server:
```bash
npm run dev
```

**Terminal 2** - Start the order worker:
```bash
npm run worker
```

### Production Mode

```bash
npm run build
npm start
```

The API will be available at: `http://localhost:3000`

### Health Check

Verify the server is running:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-25T10:30:00.000Z"
}
```

---

## API Documentation

### 1. Execute Market Order

**Endpoint:** `POST /api/orders/execute`

**Request Body:**
```json
{
  "tokenIn": "USDC",
  "tokenOut": "SOL",
  "amount": 100,
  "side": "buy",
  "type": "market",
  "slippageBps": 100,
  "delayMs": 3000
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tokenIn` | string | Yes | Input token symbol |
| `tokenOut` | string | Yes | Output token symbol |
| `amount` | number | Yes | Order size |
| `side` | string | Yes | "buy" or "sell" |
| `type` | string | Yes | "market" (only supported type) |
| `slippageBps` | number | No | Max slippage in basis points (default: 100) |
| `delayMs` | number | No | Processing delay for testing (default: 0) |

**Response:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Status Codes:**
- `200` - Order created successfully
- `400` - Invalid request parameters
- `500` - Server error

---

### 2. Get Order Status

**Endpoint:** `GET /api/orders/:orderId`

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tokenIn": "USDC",
  "tokenOut": "SOL",
  "amount": 100,
  "side": "buy",
  "type": "market",
  "status": "confirmed",
  "createdAt": "2025-11-25T10:30:00.000Z",
  "txHash": "5vK2nZm8XfJ9...",
  "executedPrice": 98.50,
  "selectedDex": "raydium",
  "statusHistory": [
    {"status": "pending", "timestamp": "2025-11-25T10:30:00.000Z"},
    {"status": "routing", "timestamp": "2025-11-25T10:30:01.000Z"},
    {"status": "building", "timestamp": "2025-11-25T10:30:02.000Z"},
    {"status": "submitted", "timestamp": "2025-11-25T10:30:03.000Z"},
    {"status": "confirmed", "timestamp": "2025-11-25T10:30:05.000Z"}
  ]
}
```

---

## WebSocket Integration

### Connection

**Endpoint:** `ws://localhost:3000/api/orders/execute`

### Subscribe to Order Updates

After connecting, send:
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Real-time Status Events

You'll receive status updates as the order progresses:

```json
{"orderId": "550e8400...", "status": "pending", "timestamp": "2025-11-25T10:30:00.000Z"}
{"orderId": "550e8400...", "status": "routing", "timestamp": "2025-11-25T10:30:01.000Z", "dexQuotes": {"raydium": 98.50, "meteora": 98.30}}
{"orderId": "550e8400...", "status": "building", "timestamp": "2025-11-25T10:30:02.000Z", "selectedDex": "raydium"}
{"orderId": "550e8400...", "status": "submitted", "timestamp": "2025-11-25T10:30:03.000Z"}
{"orderId": "550e8400...", "status": "confirmed", "timestamp": "2025-11-25T10:30:05.000Z", "txHash": "5vK2nZm8XfJ9..."}
```

### Error Handling

If order fails:
```json
{
  "orderId": "550e8400...",
  "status": "failed",
  "timestamp": "2025-11-25T10:30:04.000Z",
  "error": "Slippage tolerance exceeded"
}
```

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Test Coverage

```bash
npm run test:coverage
```

### Test Suites

| Test Suite | Coverage | Tests |
|------------|----------|-------|
| **DEX Router** | Routing logic, price comparison, slippage validation | 4 tests |
| **Order Queue** | Job creation, concurrency, retry logic | 3 tests |
| **API Endpoints** | Order creation, validation, retrieval | 3 tests |
| **WebSocket** | Connection, subscription, status streaming | 4 tests |

**Total:** 14+ unit and integration tests

---

## Design Decisions

### 1. Framework Selection: Fastify

**Rationale:** Fastify provides native WebSocket support through plugins, excellent performance characteristics, and a clean schema validation system. Its lightweight nature makes it ideal for high-throughput order processing.

### 2. Queue System: BullMQ + Redis

**Rationale:** BullMQ offers production-grade features including:
- Automatic retry with exponential backoff
- Job prioritization
- Concurrency control
- Job progress tracking
- Failed job handling

Redis serves dual purposes: message broker for BullMQ and pub/sub channel for WebSocket events.

### 3. Mock Implementation Strategy

**Rationale:** Mock DEX router allows focus on:
- System architecture and design patterns
- Error handling and edge cases
- Real-time communication patterns
- Testing without network dependencies

Price simulation includes realistic variance (2-5% difference between DEXs) and network latency (200-300ms).

### 4. Status Progression Model

```
pending → routing → building → submitted → confirmed
                                         ↓
                                      failed
```

**Rationale:** This mirrors real-world exchange order lifecycles, providing transparency into each execution phase. Failed orders persist with error details for debugging.

### 5. Database Schema Design

**Orders Table:**
- Immutable order properties (tokens, amount, type)
- Current status tracking
- Execution results (txHash, price, DEX)

**Status History:**
- Separate table for temporal tracking
- Allows order replay and analytics
- Enables SLA monitoring

### 6. Concurrency Management

**Settings:**
- Max concurrent orders: 10
- Target throughput: 100 orders/minute
- Retry attempts: 3 with exponential backoff

**Rationale:** Balances system throughput with resource constraints. Settings are configurable via environment variables.

### 7. Error Recovery Strategy

**Retry Logic:**
1. First retry: 1 second delay
2. Second retry: 2 seconds delay
3. Third retry: 4 seconds delay
4. After 3 failures: Mark as "failed" with reason

**Rationale:** Transient network issues often resolve quickly. Exponential backoff prevents overwhelming DEX endpoints while maximizing success rate.

---

## Project Structure

```
order-execution-engine/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── orders.ts          # REST endpoints
│   │   │   └── websocket.ts       # WebSocket handlers
│   │   └── server.ts              # Fastify app setup
│   ├── services/
│   │   ├── dexRouter.ts           # Mock DEX routing logic
│   │   ├── orderQueue.ts          # BullMQ queue setup
│   │   └── orderWorker.ts         # Background job processor
│   ├── database/
│   │   ├── client.ts              # PostgreSQL connection
│   │   ├── migrations/            # Database schema
│   │   └── repositories/
│   │       └── orderRepository.ts # Order CRUD operations
│   ├── types/
│   │   └── order.ts               # TypeScript interfaces
│   └── utils/
│       ├── validators.ts          # Input validation
│       └── logger.ts              # Logging utility
├── tests/
│   ├── unit/
│   │   ├── dexRouter.test.ts
│   │   └── validators.test.ts
│   └── integration/
│       ├── api.test.ts
│       └── websocket.test.ts
├── docker-compose.yml             # Redis + PostgreSQL
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Deployment

### Deployment URL
**Live API:** `https://your-deployment-url.com`

### Recommended Platforms
- **Render** (Free tier with PostgreSQL + Redis add-ons)
- **Railway** (Auto-deployment from GitHub)
- **Fly.io** (Global edge deployment)

### Environment Variables for Production
Ensure these are set in your hosting platform:
```
PORT=3000
NODE_ENV=production
PG_HOST=<production-db-host>
PG_USER=<production-db-user>
PG_PASSWORD=<production-db-password>
REDIS_HOST=<production-redis-host>
```

---

## Demo Video

**YouTube Link:** [Order Execution Engine Demo](https://youtube.com/...)

**Video Contents:**
- System architecture walkthrough
- Submitting 5 concurrent orders via Postman
- Real-time WebSocket status updates
- DEX routing decision logs
- Queue processing visualization
- Error handling demonstration

**Duration:** 2 minutes

---

## Postman Collection

Import the collection to test all endpoints:

**Collection Links:**
- [REST API Collection](https://www.postman.com/...)
- [WebSocket Collection](https://www.postman.com/...)

**Pre-configured Requests:**
- ✅ Execute Market Order (POST)
- ✅ Get Order Status (GET)
- ✅ WebSocket Subscribe
- ✅ Health Check

**Collection Variables:**
| Variable | Value |
|----------|-------|
| `base_url` | `http://localhost:3000` |
| `ws_url` | `ws://localhost:3000` |
| `orderId` | (auto-populated from POST response) |

---

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run worker` | Start background order processor |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run lint` | Check code style |
| `npm run format` | Auto-format code with Prettier |

---

## Troubleshooting

### Issue: "Redis connection refused"
**Solution:** Ensure Docker containers are running:
```bash
docker-compose up -d
docker ps  # Verify redis is running
```

### Issue: "PostgreSQL authentication failed"
**Solution:** Check `.env` credentials match `docker-compose.yml` settings

### Issue: "WebSocket connection timeout"
**Solution:** Ensure both API server AND worker are running in separate terminals

### Issue: "Tests failing with timeout errors"
**Solution:** Increase Jest timeout in `jest.config.js`:
```javascript
testTimeout: 10000
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## License

MIT License - see LICENSE file for details

---

## Contact

**Developer:** Harsh Kesharwani 
**Email:** harshkesharwani777@gmail.com 

---

## Acknowledgments

- Raydium DEX documentation
- Meteora protocol guides
- Fastify WebSocket plugin maintainers
- BullMQ team for excellent queue library
