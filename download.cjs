const https = require('https');
const fs = require('fs');

const url = "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=2048&auto=format&fit=crop";

if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Failed to download: ${res.statusCode}`);
    process.exit(1);
  }
  const file = fs.createWriteStream('public/default-cover.jpg');
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Download completed');
  });
}).on('error', (err) => {
  console.error(err);
  process.exit(1);
});
