
const https = require('https');

const USER_ID = 1588644560;
const ROCKET_KEY = 'Xssgoym3xV1cSl6TX7MwRg';

const data = JSON.stringify({
    id: Number(USER_ID),
    count: 5
});

const options = {
    hostname: 'v1.rocketapi.io',
    path: '/instagram/user/get_clips',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${ROCKET_KEY}`,
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(body);
            const items = json.response?.body?.items || [];
            if (items.length > 0) {
                console.log('Items Found:', items.length);
                items.forEach((item, index) => {
                    const media = item.media ? item.media : item;
                    console.log(`[${index}] Media Type: ${media.media_type}, PlayCount: ${media.play_count}, ViewCount: ${media.view_count}`);
                });
            }
        } catch (e) { console.log(e); }
    });
});
req.write(data);
req.end();
