const fs = require('fs');
try {
    const content = fs.readFileSync('c:/Users/Arda Furkan Aslanbaş/influmatch/messages/en_US.json', 'utf8');
    JSON.parse(content);
    console.log('Valid JSON');
} catch (e) {
    console.error(e.message);
}
