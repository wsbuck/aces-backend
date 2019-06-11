const AWS = require('aws-sdk');

const { scrapeWebsite } = require('./helpers');

const PITCHERS_TABLE = process.env.PITCHERS_TABLE;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const pitchTypes = [
  {
    pitchName: 'All',
    pitchValue: 'ALL'
  },
  {
    pitchName: 'Fourseam',
    pitchValue: 'FA'
  },
  {
    pitchName: 'Sinker',
    pitchValue: 'SI'
  },
  {
    pitchName: 'Cutter',
    pitchValue: 'FC'
  },
  {
    pitchName: 'Curve',
    pitchValue: 'CU'
  },
  {
    pitchName: 'Slider',
    pitchValue: 'SL'
  },
  {
    pitchName: 'Change',
    pitchValue: 'CH'
  },
  {
    pitchName: 'Splitter',
    pitchValue: 'FS'
  },
  // {
  //   pitchName: 'Screwball',
  //   pitchValue: 'SB'
  // },
  // {
  //   pitchName: 'Knuckleball',
  //   pitchValue: 'KN'
  // },
];

module.exports.scrape = async (event, context) => {
  let url;

  for (let pitch of pitchTypes) {
    url = `https://legacy.baseballprospectus.com/pitchfx/leaderboards/index.php?hand=&reportType=pfx&prp=P&month=&year=2019&pitch=${pitch.pitchValue}&ds=velo&lim=0`;

    await scrapeWebsite(url, pitch.pitchName)
      .then(async players => {
        const deleteItems = [];
        const putItems = [];
        for (let player of players) {
          // dynamoDb.delete({
          //   TableName: PITCHERS_TABLE,
          //   Key: {
          //     pitcherId: player.pitcherId
          //   },
          // }, function (err, data) {
          //   if (err) {
          //     console.error(err);
          //   }
          // });
          let deleteItem = {
            DeleteRequest: {
              Key: {
                pitcherId: player.pitcherId
              }
            }
          };
          deleteItems.push(deleteItem);

          // let params = {
          //   TableName: PITCHERS_TABLE,
          //   Item: player
          // }
          // const dynamoDbPromise = dynamoDb.put(params).promise();
          // await dynamoDbPromise
          // .catch(err => console.error(err));
          let putItem = {
            PutRequest: {
              Item: player
            }
          };
          putItems.push(putItem);
        };

        let deleteParams = {
          RequestItems: {
            PITCHERS_TABLE: deleteItems
          }
        };
        let delProm = dynamoDB.batchWrite(deleteParams).promise();
        await delProm.then(function (data) {
          console.log('Del Success');
        }).catch(function (err) {
          console.log('Del Error!');
        });
        // dynamoDb.batchWrite(deleteParams, function(err, data) {
        //   if (err) {
        //     console.log(error);
        //   } else {
        //     console.log('Deleted ' + putItems.length + ' items!');
        //   }
        // });

        let putParams = {
          RequestItems: {
            PITCHERS_TABLE: putItems
          }
        };
        let putProm = dynamoDB.batchWrite(putParams).promise();
        await putProm.then(function (data) {
          console.log('Put Success!');
        }).catch(function (err) {
          console.log('Put Error!');
        });
        
        // dynamoDb.batchWrite(putParams, function(err, data) {
        //   if (err) {
        //     console.log(error);
        //   } else {
        //     console.log('Added ' + putItems.length + ' items!');
        //   }
        // });
      })
      .catch(error => console.error(error));
  }
};