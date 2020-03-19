const express    = require('express');
const fs         = require('fs');
const handlebars = require('express-handlebars')
const app        = express();
app.engine('handlebars', handlebars());
app.set('view engine', 'handlebars');

const port   = 8080;

const server = app.listen(port, () =>{
  console.log("webserver started");
});

// landing page
app.get('/', function(a_req, a_resp){
  a_resp.render('home');
});

app.get('/upload', function(a_req, a_resp){
  a_resp.render('upload');
});

app.get('/watch', function(a_req, a_resp){
  a_resp.render('watch')
});
