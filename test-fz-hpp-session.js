const axios = require('axios');

async function testHppSession() {
    const username = 'sp-2Q406';
    const secret = 'CIP9HC01kiuTDR4XHDUBaHNCzaDjVC8y';

    const payload = {
        amount: 1000,
        reference: 'HPP-TEST-' + Date.now(),
        customer_ip: '127.0.0.1',
        capture: false, // Don't try to capture yet
        return_url: 'http://localhost:3006/payment/success'
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

testHppSession();
