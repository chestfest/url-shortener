'use strict' //TODO BABEL

const path = require('path')
const express = require('express')
const http = require('http')
const shortid = require('shortid')
const mongo = require('mongodb').MongoClient

const app = express()

const dbUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/data'

function checkUrl(url){
  let regexp = /^(https?):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
  return regexp.test(url);
}

function shorten(origUrl, callback){

  //create id
  let id = shortid.generate() //TODO while loop id is already used or if $eq in db
  console.log(id)

  let item = {
    "original_url": origUrl,
    "id": id
  }

  mongo.connect(dbUrl, (err, db) => { //mongo db origUrl and id   CHECK IF USED
    if (err) throw err
    let urls = db.collection('urls')
    urls.find({
      "original_url": {
        $eq: origUrl
      }
    }).toArray((err, exists) => {
      if (err) throw err
      if (exists.length != 0){
        console.log("orig url alread exists, its id was: "+exists[0].id)
        callback(exists[0].id)//give already created id
        db.close()
      }
      else{
        urls.insert(item, (err, data) => {// if not in docs
          if (err) throw err
          console.log(JSON.stringify(item))
          callback(id)
          db.close()
        })
      }
    })
  })
}

function checkDb(shorturl, callback){
  console.log(shorturl);
  mongo.connect(dbUrl, (err, db) => {
    if (err) throw err
    let urls = db.collection('urls') //move to top
    urls.find({ //CHECK
      id: {
          $eq: shorturl
        }
      }).toArray((err, orig) => {
      if (err) throw err
      if (orig.length != 0){
        console.log("orig url:" + orig[0].original_url);
        callback(orig[0].original_url)//callback("http://" + orig[0].original_url)
        db.close()
      }
      if (orig.length == 0){
        console.log("dont exist fam");
        db.close()
        callback(0);
      }
    })
  })
}

app.all("*", (req, res, next) => {
  next()
});
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: __dirname + '/public/' })
});
app.get("/:shorturl", (req, res) => {
  let shorturl = req.params.shorturl
  //if in db redirect
  checkDb(shorturl, (url) => {
    if (url!=0){
      console.log("redirect");
      res.redirect(url)//TODO Change to longurl from db
    }
    else{
      res.writeHead(200, { "Content-Type": "application/json" });
      let json = JSON.stringify({"error" : "Short URL does not exist, please create one --> minime.herokuapp.com/new/http://yoururl.com"})
      res.end(json)
    }
  })
});
app.get("/new/*", (req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  let origUrl = req.params[0]

  if (checkUrl(origUrl)){
    shorten(origUrl, (id) => {
      console.log(id)
      let shortUrl = "minime.herokuapp.com/" + id //TODO make first part of url dynamic for forks
      let json = JSON.stringify({"original_url": origUrl, "short_url": shortUrl})
      res.end(json)
    })
  }
  else {
    let json = JSON.stringify({"error" : "Bad URL format, make sure it contains http:// or https://"})
    res.end(json)
  }
});

const port = process.env.PORT || 8080;
http.createServer(app).listen(port)
console.log("Server Running on port: " + port)
