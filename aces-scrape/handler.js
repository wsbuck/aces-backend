const cheerio = require('cheerio');
const AWS = require('aws-sdk');
const fetch = require('node-fetch');

const PITCHERS_TABLE = process.env.PITCHERS_TABLE;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.scrape = async (event, context) => {
  await fetch('https://legacy.baseballprospectus.com/pitchfx/leaderboards/')
  .then(res => res.text())
  .then(data => {
    const $ = cheerio.load(data);
    const headerNamesRow = $('#myTable thead tr th');
    const headerNames = [];
    headerNamesRow.each(function (i, el) {
      headerNames.push($(this).text().trim());
    })
    // console.log(headerNames);

    const playerRows = $("#myTable tbody tr");
    const players = [];
    playerRows.each(function (i, el) {
      let player = $(el).children();
      let playerData = {};
      player.each(function (j, el) {
        let value = $(this).text().trim();
        if (value) {
          playerData[headerNames[j]] = value;
        }
        // playerData[headerNames[j]] = $(this).text().trim();
        // console.log($(this).text().trim());
      });
      let name = playerData['Player'];
      let id = (name.split('')[0] + name.split(' ')[1]).toLowerCase();
      playerData['pitcherId'] = id;
      players.push(playerData);
      // console.log(playerData);
    });
    return players;
  })
  .then(async (players) => {
    for (let player of players) {
      dynamoDb.delete({
        TableName: PITCHERS_TABLE,
        Key: {
          pitcherId: player.pitcherId
        },
      }, function (err, data) {
        if (err) {
          console.log(err);
        }
      });

      let params = {
        TableName: PITCHERS_TABLE,
        Item: player
      }
      const dynamoDbPromise = dynamoDb.put(params).promise();
      await dynamoDbPromise.then(function (data) {
        console.log('success');
      }).catch(function (err) {
        console.log(err);
      });
    };
  });
};