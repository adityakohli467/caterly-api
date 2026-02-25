const axios = require('axios');
const fs = require('fs');

async function testKeys() {
    const username = 'sp-2Q406';
    const secret = 'CIP9HC01kiuTDR4XHDUBaHNCzaDjVC8y';

    const urls = [
        'https://gateway.pmnts-sandbox.io/v1.0/ping',
        'https://gateway.pmnts.io/v1.0/ping',
        'https://gateway.sandbox.fatzebra.com.au/v1.0/ping',
        'https://gateway.fatzebra.com.au/v1.0/ping'
    ];

    let results = [];

    for (const url of urls) {
        try {
            const response = await axios.get(url, {
                auth: {
                    username: username,
                    password: secret
                },
                timeout: 5000
            });
            results.push({ url, status: 'SUCCESS', data: response.data });
        } catch (error) {
            results.push({
                url,
                status: 'FAILED',
                error: error.response ? `${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message
            });
        }
    }

    fs.writeFileSync('fz-test-detailed.json', JSON.stringify(results, null, 2));
    console.log('Results written to fz-test-detailed.json');
}

testKeys();
