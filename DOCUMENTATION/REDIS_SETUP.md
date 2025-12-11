# Running Reports Module with Redis (BullMQ)

## ✅ Installation Complete

The following packages have been installed:

- `@nestjs/bull`
- `bull`
- `@types/bull`

The BullMQ integration is now active in the Reports module.

---

## 🐳 Running with Docker

### Prerequisites

Ensure your external Redis instance is running and accessible.

### Start API Service

```bash
docker compose up -d
```

This will start:

- **aostp-api** on port 3000 (connects to external Redis)

### Check Services Status

```bash
docker compose ps
```

### View Logs

```bash
# API logs
docker compose logs -f aostp-api
```

### Stop Services

```bash
docker compose down
```

---

## 💻 Running Locally (Development)

### Connect to External Redis

Make sure your `.env` file has the correct Redis connection:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

Then run the API:

```bash
npm run start:dev
```

### If Running API in Docker with External Redis

Update your `.env` to use host gateway:

```env
REDIS_HOST=host.docker.internal
REDIS_PORT=6379
```

The API container is configured with `extra_hosts` to access services on the host machine.

---

## 🧪 Testing BullMQ Integration

### 1. Verify Redis Connection

```bash
# Test external Redis connection
redis-cli ping
# Should return: PONG

# Or if Redis requires authentication
redis-cli -a YOUR_PASSWORD ping
```

### 2. Check API Startup Logs

Look for successful connection messages in the API logs:

```
[Nest] INFO [BullModule] Successfully connected to Redis
```

### 3. Monitor Queue Jobs

```bash
# Connect to Redis CLI
redis-cli

# Check queue keys
KEYS bull:reports-queue:*

# Monitor queue activity
MONITOR
```

---

## 📊 Using the Queue Endpoints

The Reports module now processes reports synchronously by default. For async processing (optional), you can extend the controller to add async endpoints.

### Current Endpoints (Synchronous)

All existing endpoints work as before:

- `GET /reports/payments`
- `GET /reports/packing-lists`
- `GET /reports/customer-league`
- `GET /reports/shipping-method`
- `GET /reports/general`
- `GET /reports/pickups`
- `GET /reports/warehouses`

### Background Processing

The queue infrastructure is ready. To enable background processing, see `DOCUMENTATION/BULLMQ_INSTALLATION.md` for adding async endpoints.

---

## 🔧 Configuration

### Environment Variables

| Variable     | Default     | Description                                                  |
| ------------ | ----------- | ------------------------------------------------------------ |
| `REDIS_HOST` | `localhost` | Redis hostname (use `host.docker.internal` if API in Docker) |
| `REDIS_PORT` | `6379`      | Redis port                                                   |

### Docker Environment

When running the API in Docker with external Redis, use:

```env
REDIS_HOST=host.docker.internal
REDIS_PORT=6379
```

The `docker-compose.yml` includes `extra_hosts` configuration to enable host network access.

---

## 🐛 Troubleshooting

### "Error: connect ECONNREFUSED"

**Cause:** Redis is not running or connection settings are wrong.

**Solution:**

```bash
# Check if Redis is running
redis-cli ping

# Check Redis status
sudo systemctl status redis
# or
sudo service redis status

# Ensure correct REDIS_HOST in .env
# For local dev: REDIS_HOST=localhost
# For API in Docker: REDIS_HOST=host.docker.internal
```

### "Queue is not ready"

**Cause:** BullModule initialization failed.

**Solution:**

- Check Redis connection in app logs
- Verify `REDIS_HOST` and `REDIS_PORT` in `.env`
- Ensure Redis is healthy: `docker-compose ps`

### API won't start

**Cause:** Cannot connect to Redis.

**Solution:**

```bash
# Verify Redis is accessible
redis-cli ping

# Check .env has correct REDIS_HOST
cat .env | grep REDIS_HOST

# Then start API
npm run start:dev
```

---

## 📈 Monitoring Queue Health

### Redis Commander (Optional UI)

To monitor Redis with a web UI:

```bash
# Run Redis Commander
docker run -d \
  --name redis-commander \
  -p 8081:8081 \
  -e REDIS_HOSTS=local:host.docker.internal:6379 \
  --add-host=host.docker.internal:host-gateway \
  rediscommander/redis-commander:latest
```

Then access: `http://localhost:8081`

### Bull Board (Optional Dashboard)

See `DOCUMENTATION/BULLMQ_INSTALLATION.md` for Bull Board setup to monitor jobs via web UI.

---

## 🚀 Quick Start Commands

```bash
# Development (local)
npm run start:dev

# Production with Docker
docker compose up -d

# Check everything is working
curl http://localhost:3000/health
redis-cli ping
```

---

## ✅ Verification Checklist

- [ ] External Redis is running and accessible: `redis-cli ping`
- [ ] `.env` has correct REDIS_HOST and REDIS_PORT
- [ ] API starts without errors: `npm run start:dev`
- [ ] Reports endpoints are accessible: `curl http://localhost:3000/reports/payments`
- [ ] No BullMQ errors in logs
- [ ] Queue keys exist in Redis: `redis-cli KEYS bull:reports-queue:*`

---

## 📚 Related Documentation

- Full API docs: `DOCUMENTATION/REPORTS_DOCUMENTATION.md`
- BullMQ setup: `DOCUMENTATION/BULLMQ_INSTALLATION.md`
- Quick reference: `DOCUMENTATION/REPORTS_QUICK_REFERENCE.md`
