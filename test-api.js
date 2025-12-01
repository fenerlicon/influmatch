const https = require('https');

const data = JSON.stringify({
    username: 'instagram'
});

const options = {
    hostname: 'starapi1.p.rapidapi.com',
    path: '/instagram/user/get_web_profile_info',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'starapi1.p.rapidapi.com',
        'x-rapidapi-key': '4a2d3dff9cmsh429de7a45970aaep11404ejsn8d86e71717ae',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body:', body);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
