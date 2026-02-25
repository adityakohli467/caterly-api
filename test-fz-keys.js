const axios = require('axios');

async function testKeys() {
    const username = 'sp-2Q406';
    const secret = 'CIP9HC01kiuTDR4XHDUBaHNCzaDjVC8y';

    const urls = [
        'https://gateway.pmnts-sandbox.io/v1.0/ping',
        'https://gateway.pmnts.io/v1.0/ping',
        'https://gateway.sandbox.fatzebra.com.au/v1.0/ping',
        'https://gateway.fatzebra.com.au/v1.0/ping'
    ];

    for (const url of urls) {
        try {
            console.log(`Testing ${url}...`);
            const response = await axios.get(url, {
                auth: {
                    username: username,
                    password: secret
                }
            });
            console.log(`SUCCESS [${url}]:`, response.data);
        } catch (error) {
            console.log(`FAILED [${url}]:`, error.response ? `${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message);
        }
    }
}

testKeys();
