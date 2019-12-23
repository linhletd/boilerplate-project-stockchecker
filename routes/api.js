/*
*
*
*       Complete the API routing below
*
*
const https = require('https')
const options = {
  hostname: 'financialmodelingprep.com',
  port: 443,
  path: '/api/v3/stock/real-time-price/AAPL',
  method: 'GET'
}

const req = https.request(options, (res) => {
  var dataQueue = "";    
    res.on("data", function (d) {
        dataQueue += d;
    });
    res.on("end", function () {
        console.log(dataQueue, typeof JSON.parse(dataQueue));
    });
})

req.on('error', (error) => {
  console.error(error)
})

req.end()
***********
let ipadress = req.headers["x-forwarded-for"].split(",")[0]
***********
https://financialmodelingprep.com/api/v3/stock/real-time-price
*/

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb');
var https       = require('https');

function reqStockPriceInfo(symbol){
  const options = {
  hostname: 'financialmodelingprep.com',
  port: 443,
  path: '/api/v3/stock/real-time-price/'+symbol,
  method: 'GET'
}
return new Promise((resolve, reject) => {
const req = https.request(options, (res) => {
var dataQueue = "";    
res.on("data", function (d) {
    dataQueue += d;
});
res.on("end", function () {
  if(symbol){
    resolve(JSON.parse(dataQueue))
  }
  else{
    resolve(JSON.parse(dataQueue).stockList);
  }
  
});
})

req.on('error', (error) => {
console.error(error);
reject(error);
})

req.end()
})

}
const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});

module.exports = function (app) {
  MongoClient.connect(CONNECTION_STRING, (err, client) => {
  let likesCollection = client.db('testdb').collection('likes');
  let stocksPriceCollection = client.db('testdb').collection('stockprices');
    
  app.route('/api/stock-prices')
    .get(function (req, res){
      let query = req.query;
      let ip = req.headers["x-forwarded-for"].split(",")[0];
      let stockSet = typeof query.stock === "string"? [].concat(query.stock) : query.stock;
     

    if(stockSet.length != 0){
      let PArray = []
      function helper(collection, data){
        PArray.push(new Promise((resolve, reject) =>{
          collection.aggregate([
            {$match:{stock: data.symbol}},
            {$group:{
              _id:data.symbol,
              likestotal: {$sum: "$like"}
            }},
            {$project: {_id: 0,likestotal: 1, stock: data.symbol}}
          
          ], (err, result) => {
            if(err){
              reject(err);
            }
              //check if result is null???
            if(result.length){
                resolve(Object.assign(result[0],{price: data.price}))
              }
            else {
                resolve({likestotal: 0, stock: data.symbol, price: data.price})
              }
          })
        }));
        if(PArray.length === stockSet.length){
            Promise.all(PArray)
            .then((values) => {
              res.json(values)
            },(err) => {res.send("err")})
        }
      }
      let docs = stockSet.map((stock) => ({ip: ip, stock: stock.toUpperCase(), like: 1}));
      for(let i = 0; i < stockSet.length; i++){
        reqStockPriceInfo(stockSet[i]).then((data) => {
          if(req.query.like == "true"){
            likesCollection.findOneAndReplace(docs[i],docs[i],{upsert: true}, (err, item) => {
            helper(likesCollection, data);
            })
          }
          else {
            helper(likesCollection, data);
          }
        },(err) => {  
          res.send("err");
      }
        )
      }

    }
    else if(!Object.keys(query).length){
      reqStockPriceInfo("")
        .then((data) =>{
            // console.log(dt);
            res.json(data)
        },(err) => {res.send("error")})
    }
      
    });
})
  
    
};
