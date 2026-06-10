# Setup Guide — Content Platform v2

## Local Development

```bash
cd "C:/Users/Admin/Documents/My Workspace/content2"

# Install dependencies
npm install

# Create .env.local from example
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL, NEXTAUTH_SECRET

# Generate Prisma client
npm run db:generate

# Push schema to DB (creates tables)
npm run db:push

# Seed initial data (superadmin + project)
npx tsx prisma/seed.ts

# Run dev server
npm run dev
# → http://localhost:3001
```

## Server Deploy (VPS 173.242.62.180)

### 1. Nginx vhost
```nginx
# /etc/nginx/sites-available/content2.fineko.space
server {
    listen 80;
    server_name content2.fineko.space;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        # SSE: disable buffering!
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/content2.fineko.space /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d content2.fineko.space
```

### 2. Create MySQL DB
```sql
-- на fineko.mysql.tools
CREATE DATABASE fineko_content2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'fineko_content2'@'%' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT ALL ON fineko_content2.* TO 'fineko_content2'@'%';
```

### 3. Clone & deploy
```bash
cd /var/www
git clone https://github.com/San4ez-mc/content2.git content2.fineko.space
cd content2.fineko.space
npm install
cp .env.example .env.local
# Fill .env.local
npm run db:push
npx tsx prisma/seed.ts
npm run build
pm2 start "npm start" --name content2
pm2 save
```

### 4. Cron for scheduler
```bash
# Add to crontab -e
# Every day at 09:03, 12:03, 18:03 Kyiv (UTC+3 = UTC+0:00, 06:03, 09:03, 15:03)
3 6 * * * curl -s -X POST https://content2.fineko.space/api/scheduler/run -H "x-scheduler-token: fnk_scheduler_2026"
3 9 * * * curl -s -X POST https://content2.fineko.space/api/scheduler/run -H "x-scheduler-token: fnk_scheduler_2026"
3 15 * * * curl -s -X POST https://content2.fineko.space/api/scheduler/run -H "x-scheduler-token: fnk_scheduler_2026"
```

## Webhook endpoints (for Flows)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/webhooks/generation-event` | POST | Image/text generation status |
| `/api/webhooks/chat-reply` | POST | AI chat response |
| `/api/webhooks/notify` | POST | General notification |
| `/api/scheduler/run` | POST | Trigger scheduled sending |

Auth: `x-webhook-token: fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw`
