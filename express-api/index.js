const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const AWS = require('aws-sdk');

const PITCHERS_TABLE = process.env.PITCHERS_TABLE;
const IS_OFFLINE = process.env.IS_OFFLINE;

let dynamoDb;
if (IS_OFFLINE === 'true') {
  dynamoDb = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
  });
  console.log(dynamoDb);
} else {
  dynamoDb = new AWS.DynamoDB.DocumentClient();
}

app.use(bodyParser.json({ strict: false }));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
})

app.get('/', function (req, res) {
  res.send('Hello World!');
});

// Get Pitcher endpoint
app.get('/pitcher/:pitcherId', function (req, res) {
  const params = {
    TableName: PITCHERS_TABLE,
    Key: {
      pitcherId: req.params.pitcherId,
    },
  }

  dynamoDb.get(params, (error, result) => {
    if (error) {
      console.log(error);
      req.statusCode(400).json({ error: 'Could not get pitcher data' });
    }
    if (result.Item) {
      const { pitcherId, pitcherName } = result.Item;
      res.json({ pitcherId, pitcherName });
    } else {
      res.status(404).json({ error: "Pitcher not found "});
    }
  });
});

// Get all pitchers endpoint
app.get('/pitchers', function (req, res) {
  const params = {
    TableName: PITCHERS_TABLE,
    ProjectionExpression: "pitcherId, pitcherName"
  };

  dynamoDb.scan(params, function (error, data) {
    if (error) {
      console.error('unable to scan');
      res.status(400).json({ error });
    } else {
      res.json(data.Items);
    }
  });
});

module.exports.handler = serverless(app);