const axios = require('axios');

async function testV1() {
    const username = 'sp-2Q406';
    const secret = 'CIP9HC01kiuTDR4XHDUBaHNCzaDjVC8y';

    try {
        const response = await axios.get('https://gateway.pmnts-sandbox.io/v1/ping', {
            auth: { username, password: secret }
        });
        console.log('V1 SUCCESS:', response.data);
    } catch (error) {
        console.log('V1 FAILED:', error.response ? error.response.status : error.message);
    }
}

testV1();
