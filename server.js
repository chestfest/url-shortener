'use strict'

const express = require('express')
const http = require('http')
const shortid = require('shortid')
const favicon = require('serve-favicon')
const mongo = require('mongodb').MongoClient

const app = express()
app.use(favicon(`${__dirname}/favicon.ico`))

const dbUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/data'

function checkUrl(url) {
  const regexp = /^(https?):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/
  return regexp.test(url)
}

function shorten(origUrl, callback) {
  const id = shortid.generate()
  const item = {
    original_url: origUrl,
    id,
  }

  mongo.connect(dbUrl, (err, db) => {
    if (err) throw err
    const urls = db.collection('urls')
    urls.find({
      original_url: {
        $eq: origUrl,
      },
    }).toArray((error, exists) => {
      if (error) throw error
      if (exists.length !== 0)
        callback(exists[0].id)
      else
        urls.insert(item, e => {
          if (e) throw e
          callback(id)
        })
      db.close()
    })
  })
}

function checkDb(shorturl, callback) {
  mongo.connect(dbUrl, (err, db) => {
    if (err) throw err
    const urls = db.collection('urls')
    urls.find({
      id: {
        $eq: shorturl,
      },
    }).toArray((error, orig) => {
      if (error) throw error
      if (orig.length !== 0)
        callback(orig[0].original_url)
      callback(0)
      db.close()
    })
  })
}

app.all('*', (req, res, next) => {
  next()
})
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: `${__dirname}/public/` })
})
app.get('/:shorturl', (req, res) => {
  const shorturl = req.params.shorturl
  checkDb(shorturl, (url) => {
    if (url !== 0) {
      res.redirect(url)
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      const json = JSON.stringify({ error: 'Short URL does not exist, please create one --> minime.herokuapp.com/new/http://yoururl.com' })
      res.end(json)
    }
  })
})
app.get('/new/*', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  const origUrl = req.params[0]

  if (checkUrl(origUrl)) {
    shorten(origUrl, (id) => {
      const shortUrl = `minime.herokuapp.com/${id}`
      const json = JSON.stringify({ original_url: origUrl, short_url: shortUrl })
      res.end(json)
    })
  } else {
    const json = JSON.stringify({ error: 'Bad URL format, make sure it contains http:// or https://' })
    res.end(json)
  }
})

const port = process.env.PORT || 8080
http.createServer(app).listen(port)
console.log(`Server Running on port: ${port}`)
