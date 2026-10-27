#!/bin/bash
set -e
cd /var/www/content2.fineko.space
OLD=$(git rev-parse HEAD)
git pull origin main
NEW=$(git rev-parse HEAD)
npm install --production=false
npx prisma generate
# db push лише коли справді змінилась схема: інакше він чіпає сторонні таблиці в БД (напр. _redate_backup_20260629 з даними)
# і зупиняє деплой запитом про втрату даних. Прапорець --accept-data-loss тут НЕ додавати без рішення власника.
if [ "$OLD" != "$NEW" ] && git diff --name-only "$OLD" "$NEW" | grep -q '^prisma/schema.prisma$'; then
  npx prisma db push
else
  echo "схема не змінювалась: db push пропущено"
fi
npm run build
pm2 restart content2
echo ✅ Deploy done
