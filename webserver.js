const express    = require('express');
const fs         = require('fs');
const handlebars = require('express-handlebars')
const app        = express();
const multer     = require('multer');
const bodyParser = require('body-parser');

app.engine('handlebars', handlebars());
app.set('view engine', 'handlebars');

const port      = 8080;
const FILE_PATH = 'uploads';

var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, './videos');
    },
    filename: function(req, file, cb) {
        let splitted = file.originalname.split('.');
        let extension = splitted[splitted.length - 1];
        cb(null, generateName(32) + '.' + extension);
    }
});

var upload = multer({
    storage: storage
});


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

const server = app.listen(port, () =>{
  console.log("webserver started");
});

// landing page
app.get('/', function(a_req, a_resp){
  a_resp.render('home');
});

//will display youtube and upload from file fields
app.get('/upload', function(a_req, a_resp){
  a_resp.render('upload');
});

app.post('/uploadVideo', upload.single('file'), function(a_req, a_resp){
  let filename = a_req.file.filename;
  a_resp.redirect('/watch/'+filename);
});

app.post('/selectYoutube', function(a_req, a_resp){
    let url     = a_req.body.vidURL;
    console.log(url);
    let splitURL   = url.split("=")
    let videoToken = splitURL[splitURL.length - 1];
    a_resp.redirect('/watchYT/'+videoToken)

})

app.get('/watch/:videoID', function(a_req, a_resp){
  a_resp.render('watch')
});

app.get('/watchYT/:videoToken', function(a_req, a_resp){
  a_resp.render('watchYT', {
      "videoToken":a_req.params.videoToken
  });
});

function generateName(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
