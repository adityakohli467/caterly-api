const axios = require('axios');

async function testTokenPurchase() {
    const username = 'sp-2Q406';
    const secret = 'CIP9HC01kiuTDR4XHDUBaHNCzaDjVC8y';

    const payload = {
        amount: 100,
        reference: 'TEST-TOKEN-' + Date.now(),
        customer_ip: '127.0.0.1',
        token: '1234567890', // Random token for testing auth
        cvv: '123'
    };

    const url = 'https://gateway.fatzebra.com.au/v1.0/purchases';

    try {
        const response = await axios.post(url, payload, {
            auth: { username, password: secret }
        });
        console.log('SUCCESS:', response.data);
    } catch (error) {
        console.log('FAILED:', error.response ? `${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message);
    }
}

testTokenPurchase();
