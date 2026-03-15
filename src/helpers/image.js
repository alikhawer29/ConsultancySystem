const directory = require('path')
const fs = require('fs')

const makeFolders = (() => {

    const uploadFolder = directory.join(__dirname, "../../uploads")

    if (!fs.existsSync(uploadFolder)) {
        fs.mkdirSync(uploadFolder)
    }

    const userFolder = directory.join(__dirname, "../../uploads/user")
    const documentsFolder = directory.join(__dirname, "../../uploads/documents")
    const chatFolder = directory.join(__dirname, "../../uploads/chat")
    const contentFolder = directory.join(__dirname, "../../uploads/content")
    const serviceFolder = directory.join(__dirname, "../../uploads/service")

    if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder)
    }

    if (!fs.existsSync(documentsFolder)) {
        fs.mkdirSync(documentsFolder)
    }

    if (!fs.existsSync(chatFolder)) {
        fs.mkdirSync(chatFolder)
    }

    if (!fs.existsSync(contentFolder)) {
        fs.mkdirSync(contentFolder)
    }

    if (!fs.existsSync(serviceFolder)) {
        fs.mkdirSync(serviceFolder)
    }

})

const removeImage = ((path) => {
    const root = directory.join(__dirname, "../../")
    if (path && fs.existsSync(root + path)) {
        fs.unlinkSync(root + path)
    }
})

module.exports = { removeImage, makeFolders }