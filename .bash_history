gemini
cd /data/data/com.termux/files/home/discord-server-bot
pm2 restart discord-bot
pm2 logs discord-bot
gemini
cd /data/data/com.termux/files/home/discord-server-bot
pm2 restart discord-bot
pm2 start index.js --name discord-bot
pm2 logs discord-bot
rm -f package-lock.json  # 念のため削除
zip -r TarouBot2.zip . -x "node_modules/*" -x "package-lock.json" -x ".git/*" -x ".env"rm -f package-lock.json  # 念のため削除
zip -r TarouBot2.zip . -x "node_modules/*" -x "package-lock.json" -x ".git/*" -x ".env"
mv TarouBot2.zip /storage/emulated/0/Download/
pm2 restart discord-bot
rm -f package-lock.json  # 念のため削除
zip -r TarouBot2.zip . -x "node_modules/*" -x "package-lock.json" -x ".git/*" -x ".env"
mv TarouBot2.zip /storage/emulated/0/Download/
zip -r TarouBot2.zip . -x "node_modules/*" -x "package-lock.json" -x ".git/*" -x ".env"
mv TarouBot2.zip /storage/emulated/0/Download/
exit
cd /data/data/com.termux/files/home/discord-server-bot
pm2 restart discord-bot
gemini
