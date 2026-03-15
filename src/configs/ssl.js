// src/configs/ssl.js - Alternative approach
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

dotenv.config()

const isProtected = process.env.PROTECTED === 'true' || process.env.PROTECTED === true

const getCredentials = () => {
    if (isProtected) {
        try {
            // Direct absolute path to SSL directory
            const sslPath = '/home/customdevnewonli/public_html/ssl';

            console.log('🔍 Using direct SSL path:', sslPath);

            const keyPath = path.join(sslPath, 'customdevnewonli.key');
            const certPath = path.join(sslPath, 'customdevnewonli.crt');
            const caPath = path.join(sslPath, 'customdevnewonli.ca');

            const credentials = {
                key: fs.readFileSync(keyPath, "utf8"),
                cert: fs.readFileSync(certPath, "utf8"),
                ca: fs.readFileSync(caPath, "utf8")
            };

            console.log('✅ SSL certificates loaded successfully from direct path');
            return credentials;
        } catch (error) {
            console.error('❌ Error loading SSL certificates with direct path:', error.message);
            return null;
        }
    }
    return null;
};

module.exports = {
    isProtected,
    credentials: getCredentials()
};