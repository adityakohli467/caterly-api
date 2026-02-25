const axios = require('axios');

async function testTransaction() {
    const username = 'sp-2Q406';
    const secret = 'CIP9HC01kiuTDR4XHDUBaHNCzaDjVC8y';

    const payload = {
        amount: 100,
        reference: 'TEST-' + Date.now(),
        customer_ip: '127.0.0.1',
        card_holder: 'Test User',
        card_number: '4111111111111111',
        card_expiry: '12/2026',
        cvv: '123'
    };

    const urls = [
        'https://gateway.pmnts-sandbox.io/v1.0/purchases',
        'https://gateway.pmnts.io/v1.0/purchases',
        'https://gateway.fatzebra.com.au/v1.0/purchases'
    ];

    for (const url of urls) {
        try {
            console.log(`Testing transaction [${url}]...`);
            const response = await axios.post(url, payload, {
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

testTransaction();
