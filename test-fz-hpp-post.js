const axios = require('axios');

async function testHppPost() {
    const urls = [
        'https://pay.pmnts-sandbox.io/',
        'https://pay.pmnts.io/',
        'https://pay.fatzebra.com.au/'
    ];

    for (const url of urls) {
        try {
            console.log(`Testing POST to ${url}...`);
            const response = await axios.post(url, {
                username: 'sp-2Q406',
                amount: '1000',
                reference: 'TEST',
                currency: 'AUD'
            });
            console.log(`SUCCESS [${url}]:`, response.status);
        } catch (error) {
            console.log(`FAILED [${url}]:`, error.response ? `${error.response.status}` : error.message);
        }
    }
}

testHppPost();
