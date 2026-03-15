const multer = require("multer");
const path = require("path")

const storage = (folder) =>
    multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, `uploads/${folder}`);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
            cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
        },
    });

const fileFilter = (req, file, cb) => {
    cb(null, true);
};

const upload = (path) => {
    return multer({
        storage: storage(path),
        fileFilter,
        limits: { fileSize: 100 * 1024 * 1024 },
    })
}

module.exports = upload;