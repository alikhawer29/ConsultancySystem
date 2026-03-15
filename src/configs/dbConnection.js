const mongoose = require('mongoose')
const socketController = require('../controllers/socket.controller')
const { verifyToken } = require("../helpers/token")

const connectDatabase = async (dbName, connectionString) => {
    try {
        await mongoose.connect(connectionString, {
            dbName,
            useNewUrlParser: true,
            useUnifiedTopology: true
        })
        console.log("Database connected successfully!")
    } catch (e) {
        console.log("Error while connecting to Database", e)
    }
}

const connectSocket = async (io) => {
    try {

        io.on('connection', async (socket) => {

            let token = socket.handshake.query.token;
            let decoded = await verifyToken(token)

            if (decoded) {
                socket.user_id = decoded.id
                console.log("Socket Connection Successfully Created", socket.id, socket.user_id)
                socketController(socket, io)
            }

            socket.on('disconnect', () => {
                console.log('Socket Connection Successfully Disconnected', socket.id)
            });

        })

    } catch (e) {
        console.log("Error while connecting to Sockets", e)
    }
}

module.exports = {
    connectDatabase,
    connectSocket
}