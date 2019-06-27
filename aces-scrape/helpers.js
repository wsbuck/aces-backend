const cheerio = require('cheerio');
const fetch = require('node-fetch');
const AWS = require('aws-sdk');

const acesPublished = require('./aces_published.json');

const PITCHERS_TABLE = process.env.PITCHERS_TABLE;
const BUCKET_NAME = process.env.BUCKET_NAME;
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const S3 = new AWS.S3();

async function publishLastUpdate() {
  const publishJSON = {
    lastUpdate: new Date().toLocaleDateString()
  };
  const putParams = {
    Bucket: BUCKET_NAME,
    Key: 'lastUpdate.json',
    ContentType: 'application/json',
    Body: JSON.stringify(publishJSON),
    ACL: 'public-read'
  };
  await S3.upload(putParams).promise();
}

function percentRank(sortedArr, v) {
  const N = sortedArr.length;
  for (var i = 0; i < N; i++) {
    if (v <= sortedArr[i]) {
      return (i / (N - 1));
    }
  }
  return 1;
}

async function scrapeWebsite(pitchType) {
  let url = `https://legacy.baseballprospectus.com/pitchfx/leaderboards/index.php?hand=&reportType=pfx&prp=P&month=&year=2019&pitch=${pitchType}&ds=velo&lim=0`;
  const players = [];
  let playersFinal = [];
  await fetch(url)
    .then(res => res.text())
    .then(data => {
      const $ = cheerio.load(data);
      const headerNamesRow = $('#myTable thead tr th');
      const headerNames = [];
      headerNamesRow.each(function (i, el) {
        headerNames.push($(this).text().trim());
      });

      const playerRows = $("#myTable tbody tr");
      const allWhiffsPct = [];
      // const players = [];
      playerRows.each(function (i, el) {
        let player = $(el).children();
        let playerData = {};
        player.each(function (j, el) {
          let value = $(this).text().trim();
          if (value) {
            playerData[headerNames[j]] = value;
          }
        });
        let name = playerData['Player'];
        let id = (name.split('')[0] + name.split(' ')[1]).toLowerCase();
        playerData['pitcherId'] = id;
        playerData['pitcherName'] = name;
        playerData['type'] = pitchType;
        delete playerData['Player'];

        // Calculate [Swings], [Whiffs], and [Whiffs%]
        playerData['Num'] = parseInt(playerData['Num']);
        playerData['Swings'] = (parseFloat(playerData['Sw Rate'])
          / 100.0 * playerData['Num']);
        playerData['Whiffs'] = (parseFloat(playerData['Swings'])
          * (parseFloat(playerData['Whf/Sw']) / 100.0));
        playerData['Whiffs%'] = (playerData['Whiffs'] / playerData['Num']);
        allWhiffsPct.push(playerData['Whiffs%']);

        // ACES
        let acesIndex = acesPublished.findIndex((p) => {
          return p.pitcherId == playerData['pitcherId'];
        });
        playerData['ACES'] = acesIndex > -1 ? acesPublished[acesIndex][pitchType] : 0;

        players.push(playerData);
      });
      allWhiffsPct.sort((a, b) => a - b);
      players.map(playerData => {
        let whiffPct = playerData['Whiffs%'];
        playerData['Whiffs%Rank'] = percentRank(allWhiffsPct, whiffPct);
      });
      // console.log(players);
      // return players;
    });

  const playerOutcomes = [];
  let outcomesUrl = `https://legacy.baseballprospectus.com/pitchfx/leaderboards/index.php?hand=&reportType=outcome&prp=P&month=&year=2019&pitch=${pitchType}&ds=velo&lim=0`;
  await fetch(outcomesUrl)
    .then(res => res.text())
    .then(data => {
      const $ = cheerio.load(data);
      const headerNamesRow = $('#myTable thead tr th');
      const headerNames = [];
      headerNamesRow.each(function (i, el) {
        headerNames.push($(this).text().trim());
      });

      const playerRows = $("#myTable tbody tr");
      // const players = [];
      playerRows.each(function (i, el) {
        let player = $(el).children();
        let playerData = {};
        player.each(function (j, el) {
          let value = $(this).text().trim();
          if (value) {
            playerData[headerNames[j]] = value;
          }
        });
        let name = playerData['Player'];
        let id = (name.split('')[0] + name.split(' ')[1]).toLowerCase();
        playerData['pitcherId'] = id;
        playerData['pitcherName'] = name;
        playerData['type'] = pitchType;
        delete playerData['Player'];
        // console.log(playerData);
        playerData['Called S'] = parseInt(playerData['Called S']);

        playerOutcomes.push(playerData);
      });
      
      const allCSW = [];
      playersFinal = players.map(player => {
        let outcome = playerOutcomes.find(pOut => {
          return pOut.pitcherId == player.pitcherId;
        });
        if (outcome['Num'] > 0) {
          outcome['CSW'] = (outcome['Called S'] + player['Whiffs']) / outcome['Num'];
        } else {
          outcome['CSW'] = 0;
        }
        allCSW.push(outcome['CSW']);
        return { ...player, ...outcome };
      });

      allCSW.sort((a, b) => a - b);
      playersFinal.map(playerData => {
        let CSW = playerData['CSW'];
        playerData['CSWRank'] = percentRank(allCSW, CSW);
      });

    });
  return playersFinal;
}

async function getAllPlayers() {
  const playerObjects = [];
  let allPlayers = await scrapeWebsite('ALL');
  let fourPlayers = await scrapeWebsite('FA');
  let sinkerPlayers = await scrapeWebsite('SI');
  let cutterPlayers = await scrapeWebsite('FC');
  let curvePlayers = await scrapeWebsite('CU');
  let sliderPlayers = await scrapeWebsite('SL');
  let changePlayers = await scrapeWebsite('CH');

  for (let player of allPlayers) {
    let playerObject = {
      pitcherId: player.pitcherId,
      pitcherName: player.pitcherName,
      All: player,
      Fourseam: fourPlayers.find(p => p.pitcherId === player.pitcherId),
      Sinker: sinkerPlayers.find(p => p.pitcherId === player.pitcherId),
      Cutter: cutterPlayers.find(p => p.pitcherId === player.pitcherId),
      Curve: curvePlayers.find(p => p.pitcherId === player.pitcherId),
      Slider: sliderPlayers.find(p => p.pitcherId === player.pitcherId),
      Change: changePlayers.find(p => p.pitcherId === player.pitcherId),
    };
    Object.keys(playerObject).forEach(key => {
      if (playerObject[key] === undefined) {
        // delete playerObject[key];
        playerObject[key] = { Num: 0 };
      }
    });
    playerObjects.push(playerObject);
  }
  return playerObjects;
}

async function delFromDb(delArray) {
  const deleteParams = {
    RequestItems: {
      [PITCHERS_TABLE]: delArray
    }
  };

  const delProm = dynamoDb.batchWrite(deleteParams).promise();
  await delProm.then(function (data) {
    console.log('Del Success');
  }).catch(function (err) {
    console.log(err);
  });
}

async function putToDb(putArray) {
  const putParams = {
    RequestItems: {
      [PITCHERS_TABLE]: putArray
    }
  };

  const putProm = dynamoDb.batchWrite(putParams).promise();
  await putProm.then(function (data) {
    console.log('Put Success!');
  }).catch(function (err) {
    console.log(err);
  });
}

module.exports = {
  scrapeWebsite,
  getAllPlayers,
  delFromDb,
  putToDb,
  publishLastUpdate
};