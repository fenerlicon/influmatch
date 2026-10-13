const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// NativeWind v4: className stilleri hem telefonda hem tarayıcı simülatöründe aynı uygulanır.
const config = getDefaultConfig(__dirname);

// Tarayıcı simülatörü (expo start --web) /api/mobile isteklerini kendi adresine atar; burada web sunucusuna
// iletilir. Böylece canlı sitede CORS açmaya gerek kalmaz. Hedef: SIM_API_TARGET (ör. http://localhost:3000),
// yoksa canlı site. Yalnızca geliştirme sunucusunda çalışır, uygulama paketine girmez.
const SIM_API_TARGET = (process.env.SIM_API_TARGET || 'https://influmatch.net').replace(/\/+$/, '');

config.server = {
    ...config.server,
    enhanceMiddleware: (middleware) => (req, res, next) => {
        if (!req.url.startsWith('/api/mobile/')) return middleware(req, res, next);

        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', async () => {
            try {
                const headers = { 'content-type': req.headers['content-type'] || 'application/json' };
                if (req.headers.authorization) headers.authorization = req.headers.authorization;
                const hasBody = !['GET', 'HEAD'].includes(req.method);
                const upstream = await fetch(SIM_API_TARGET + req.url, {
                    method: req.method,
                    headers,
                    body: hasBody ? Buffer.concat(chunks) : undefined,
                });
                res.statusCode = upstream.status;
                res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
                res.end(Buffer.from(await upstream.arrayBuffer()));
            } catch (e) {
                res.statusCode = 502;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ error: `Simülatör yönlendiricisi ${SIM_API_TARGET} adresine ulaşamadı.` }));
            }
        });
    },
};

module.exports = withNativeWind(config, { input: './global.css' });
