const https = require('https');
const fs = require('fs');
const path = require('path');

const images = [
  {
    url: 'https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=1200&h=800&fit=crop',
    filename: 'checkers.jpg'
  },
  {
    url: 'https://images.unsplash.com/photo-1528819622765-d6bcf132f793?w=1200&h=800&fit=crop',
    filename: 'chess.jpg'
  },
  {
    url: 'https://images.unsplash.com/photo-1586165368502-1bad197a6461?w=1200&h=800&fit=crop',
    filename: 'go.jpg'
  },
  {
    url: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=1200&h=800&fit=crop',
    filename: 'poker.jpg'
  }
];

const downloadImage = (url, filename) => {
  return new Promise((resolve, reject) => {
    const filepath = path.join(__dirname, '../public/images', filename);
    const file = fs.createWriteStream(filepath);

    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${filename}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
};

const downloadAllImages = async () => {
  try {
    for (const image of images) {
      await downloadImage(image.url, image.filename);
    }
    console.log('All images downloaded successfully!');
  } catch (error) {
    console.error('Error downloading images:', error);
  }
};

downloadAllImages(); 