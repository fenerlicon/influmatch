
const https = require('https');

const USER_ID = 1588644560;
const ROCKET_KEY = 'Xssgoym3xV1cSl6TX7MwRg';

const data = JSON.stringify({
    id: Number(USER_ID),
    count: 2
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
                const item = items[0].media ? items[0].media : items[0];
                console.log('play_count:', item.play_count);
                console.log('view_count:', item.view_count);
                console.log('video_view_count:', item.video_view_count);
            }
        } catch (e) { console.log(e); }
    });
});
req.write(data);
req.end();
