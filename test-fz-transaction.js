const axios = require('axios');

async function testTransaction() {
    const username = 'sp-2Q406';
    const secret = 'CIP9HC01kiuTDR4XHDUBaHNCzaDjVC8y';

    const payload = {
        amount: 100, // 1 dollar
        reference: 'TEST-' + Date.now(),
        customer_ip: '127.0.0.1',
        card_holder: 'Test User',
        card_number: '4111111111111111', // Test VISA
        card_expiry: '12/2026',
        cvv: '123'
    };

    try {
        const response = await axios.post('https://gateway.pmnts-sandbox.io/v1.0/purchases', payload, {
            auth: {
                username: username,
                password: secret
            }
        });
        console.log('API SUCCESS:', response.data);
    } catch (error) {
        console.log('API FAILED:', error.response ? `${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message);
    }
}

testTransaction();
