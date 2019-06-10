const cheerio = require('cheerio');
const AWS = require('aws-sdk');

const PITCHERS_TABLE = process.env.PITCHERS_TABLE;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

// dynamoDb.delete({
//   TableName: PITCHERS_TABLE,
//   Key: {
//     pitcherId: '*'
//   }
// });

const params = {
  TableName: PITCHERS_TABLE,
  Item: {
    pitcherId: 'wbuck',
    pitcherName: 'William Buck'
  }
};

dynamoDb.put(params, (error) => {
  if (error) {
    console.log(error);
  }
})

module.exports.scrape = (event, context, callback) => {
  fetch('https://legacy.baseballprospectus.com/pitchfx/leaderboards/')
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
        playerData[headerNames[j]] = $(this).text().trim();
        // console.log($(this).text().trim());
      });
      let name = playerData['Player'];
      let id = (name.split('')[0] + name.split(' ')[1]).toLowerCase();
      playerData['pitcherId'] = id;
      players.push(playerData);
      // console.log(playerData);
    });

    players.forEach((player) => {
      // dynamoDb.delete({
      //   TableName: PITCHERS_TABLE,
      //   Key: {
      //     pitcherId: player.playerId
      //   },
      //   ConditionExpression: "info.playerId == :val",
      //   ExpressionAttributeValues: {
      //     ":val": player.playerId
      //   }
      // }, function (err, data) {
      //   if (err) {
      //     console.log('error' + error);
      //   } else {
      //     console.log('deleted');
      //   }
      // })

      // let params = {
      //   TableName: PITCHERS_TABLE,
      //   Item: player
      // };
      let params = {
        TableName: PITCHERS_TABLE,
        Item: {
          pitcherId: 'testdude',
          pitcherName: 'Test Dude',
        }
      }
      // dynamoDb.put(params, function(err, data) {
      //   if (err) {
      //     console.log('error' + error);
      //   } else {
      //     console.log('sucess');
      //   }
      // });

      let putObjectPromise = dynamoDb.put(params).promise();
      putObjectPromise.then(function (data) {
        console.log('success')
      })
      .catch(function (err) {
        console.log('error');
      })
    });

    // callback(null, players);
    callback(null, 'hello world');
  })
  .catch(callback);
};