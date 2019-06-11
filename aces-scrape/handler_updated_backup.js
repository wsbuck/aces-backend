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
        for (let player of players) {
          // console.log(player);
          dynamoDb.delete({
            TableName: PITCHERS_TABLE,
            Key: {
              pitcherId: player.pitcherId
            },
          }, function (err, data) {
            if (err) {
              console.error(err);
            }
          });

          let params = {
            TableName: PITCHERS_TABLE,
            Item: player
          }
          const dynamoDbPromise = dynamoDb.put(params).promise();
          await dynamoDbPromise
          .catch(err => console.error(err));
          // await dynamoDbPromise.then(function (data) {
          //   console.log('success');
          // }).catch(function (err) {
          //   console.error(err);
          // });
        };
      })
      .catch(error => console.error(error));
  }
};