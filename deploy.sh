#!/bin/bash
set -e
cd /var/www/content2.fineko.space
git pull origin main
npm install --production=false
npx prisma generate
npx prisma db push
npm run build
pm2 restart content2
echo ✅ Deploy done
