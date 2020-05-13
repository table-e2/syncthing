import express from 'express'
// import fs from 'fs';
import handlebars from 'express-handlebars'
const app = express()
app.engine('handlebars', handlebars())
app.set('view engine', 'handlebars')

const port = process.argv[3] !== undefined ? Number(process.argv[3]) : 8000
app.listen(port, () => {
    console.log('server started')
})

// landing page
app.get('/', function (_aReq, aResp) {
    aResp.render('home')
})

app.use('/static', express.static('static'))
app.use('/js', express.static('js'))
