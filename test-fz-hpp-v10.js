const axios = require('axios');

async function testHppV10() {
    const url = 'https://pay.pmnts.io/v1.0/';
    try {
        const response = await axios.post(url, {
            username: 'sp-2Q406',
            amount: '1000',
            reference: 'TEST',
            currency: 'AUD'
        });
        console.log('SUCCESS:', response.status);
    } catch (error) {
        console.log('FAILED:', error.response ? error.response.status : error.message);
    }
}

testHppV10();
