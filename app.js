const { isProtected, credentials } = require('./src/configs/ssl')
const express = require('express')
const http = require('http')
const https = require('https')
const cookieParser = require("cookie-parser")
const cors = require('cors')
const path = require('path')
const logger = require('morgan')
const dotenv = require('dotenv')
const routes = require('./src/routes')
const { connectDatabase, connectSocket } = require('./src/configs/dbConnection')
const { makeFolders } = require('./src/helpers/image')
const { setIO } = require('./src/helpers/socket')
const { webhook } = require('./src/helpers/stripe')
const { seedAdmin } = require('./src/seeders')
const { startBookingStatusCron } = require('./src/cron/bookingStatusCron')

dotenv.config()

const
    PORT = parseInt(process.env.PORT),
    dbName = process.env.APP_NAME,
    connectionString = process.env.DB_CONNECTION_STRING

if (!connectionString || !dbName) {
    console.log("Connection String or Database Name not provided!")
    process.exit(1)
}

if (!PORT) {
    console.log("Port is not defined!")
    process.exit(1)
}

let app = express()

app.post(
    "/stripe-webhook",
    express.raw({ type: "application/json" }),
    webhook
);

app.use(logger('dev'))
app.use(express.json({ limit: "350mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors())

app.use(`/${process.env.APP_NAME}/v1/api`, routes)
app.use('/uploads', express.static(path.join(__dirname, "uploads")));

// Create server based on SSL configuration
let server;
if (isProtected && credentials) {
    // HTTPS server for production (iOS compatible)
    server = https.createServer(credentials, app);
    console.log('🔒 HTTPS server enabled');
} else {
    // HTTP server for development
    server = http.createServer(app);
    console.log('⚠️  HTTP server enabled (not recommended for production/iOS)');
}

let io = setIO(server)

const serverHandler = async () => {
    try {
        console.log(`Server started 🚀 Running on port ${PORT}.`)
        makeFolders()
        await connectDatabase(dbName, connectionString)
        await connectSocket(io)
        await seedAdmin()
        startBookingStatusCron() // Start cron job
    } catch (e) {
        console.log("Error while connecting server :: ", e)
    }
}

server.listen(PORT, serverHandler)